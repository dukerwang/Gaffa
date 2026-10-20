import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BY_SLUG } from '@/lib/clubs/registry';
import { fetchAllPages } from '@/lib/supabase/pagination';
import type { MatchLayout } from './fitFormation';

/** A Premier League match the Lineup Builder can build an XI for. */
export interface BuilderFixture {
  season: string;
  /** FPL's fixture id. Unique only within `season`, so links carry both. */
  id: number;
  gameweek: number;
  home: string; // club slug
  away: string; // club slug
  homeName: string;
  awayName: string;
  kickoff: string | null;
  finished: boolean;
  /** Null until played. */
  homeScore: number | null;
  awayScore: number | null;
}

export type MatchSide = 'home' | 'away';

/** Where a side's opening XI comes from. */
export interface SideSource {
  /** `started`: this match's real starting XI. `last`: the club's most recent one, for a match not yet played. */
  kind: 'started' | 'last';
  /** The starters, in no particular order; the builder lays them out with fitFormation. */
  playerIds: string[];
  /** The match the XI started, for the provenance line. Same as the selected match when kind is `started`. */
  from: { opponentName: string; atHome: boolean; kickoff: string | null };
  /** Where they stood in that match, from the PL feed (pl_match_lineups), when it has been fetched. */
  layout?: MatchLayout | null;
}

/** fixtureKey -> each side's opening XI, or null when there is none to show. */
export type MatchLineups = Record<string, Record<MatchSide, SideSource | null>>;

/** The picker offers the matchweek in progress, the two after it and the two before it. */
const WEEKS_AHEAD = 3;
/** Also how far back a club's last XI can come from; two matchweeks covers a blank week. */
const WEEKS_BACK = 2;

interface FixtureRow {
  season: string;
  fpl_fixture_id: number;
  gameweek: number;
  home_club: string;
  away_club: string;
  kickoff_time: string | null;
  finished: boolean;
  home_score: number | null;
  away_score: number | null;
}

function toBuilderFixture(row: FixtureRow): BuilderFixture {
  return {
    season: row.season,
    id: row.fpl_fixture_id,
    gameweek: row.gameweek,
    home: row.home_club,
    away: row.away_club,
    homeName: CLUB_BY_SLUG.get(row.home_club)?.name ?? row.home_club,
    awayName: CLUB_BY_SLUG.get(row.away_club)?.name ?? row.away_club,
    kickoff: row.kickoff_time,
    finished: row.finished,
    homeScore: row.home_score,
    awayScore: row.away_score,
  };
}

export const fixtureKey = (f: { season: string; id: number }) => `${f.season}:${f.id}`;

const COLUMNS = 'season, fpl_fixture_id, gameweek, home_club, away_club, kickoff_time, finished, home_score, away_score';

const kickedOff = (f: BuilderFixture, now: number) => f.kickoff !== null && Date.parse(f.kickoff) <= now;

/**
 * The matchweek in progress with two either side of it, plus the match a shared link
 * names when that match has dropped out of the window, so an old link still
 * opens on its own fixture. Empty in the close season.
 *
 * Each match comes with both sides' opening XIs: the real starters once it has
 * kicked off (the stats sync flags them, see src/lib/fixtures/starters.ts),
 * otherwise each club's most recent starting XI. `clubOf` resolves a player to
 * his club slug today; a starter who has since left both clubs is dropped.
 */
export async function loadBuilderFixtures(
  admin: SupabaseClient,
  season: string,
  linked: { season: string; id: number } | null,
  clubOf: (playerId: string) => string | null,
): Promise<{ fixtures: BuilderFixture[]; linked: BuilderFixture | null; lineups: MatchLineups }> {
  const { data: next } = await admin
    .from('pl_fixtures')
    .select('gameweek')
    .eq('season', season)
    .eq('finished', false)
    .order('gameweek', { ascending: true })
    .limit(1)
    .maybeSingle();

  let fixtures: BuilderFixture[] = [];
  if (next?.gameweek) {
    const { data } = await admin
      .from('pl_fixtures')
      .select(COLUMNS)
      .eq('season', season)
      .gte('gameweek', next.gameweek - WEEKS_BACK)
      .lt('gameweek', next.gameweek + WEEKS_AHEAD)
      .order('kickoff_time', { ascending: true })
      .order('fpl_fixture_id', { ascending: true });
    fixtures = ((data ?? []) as FixtureRow[]).map(toBuilderFixture);
  }

  let linkedFixture: BuilderFixture | null = null;
  if (linked) {
    linkedFixture = fixtures.find((f) => f.season === linked.season && f.id === linked.id) ?? null;
    if (!linkedFixture) {
      const { data } = await admin
        .from('pl_fixtures')
        .select(COLUMNS)
        .eq('season', linked.season)
        .eq('fpl_fixture_id', linked.id)
        .maybeSingle();
      linkedFixture = data ? toBuilderFixture(data as FixtureRow) : null;
    }
  }

  const now = Date.now();
  const listed = linkedFixture && !fixtures.some((f) => fixtureKey(f) === fixtureKey(linkedFixture!))
    ? [linkedFixture, ...fixtures]
    : fixtures;

  // Starters for every match that has kicked off, in this season's window or the linked one.
  const played = [...fixtures, ...(linkedFixture ? [linkedFixture] : [])].filter((f) => kickedOff(f, now));
  const startersByFixture = new Map<string, Record<MatchSide, string[]>>();
  const bySeason = new Map<string, BuilderFixture[]>();
  for (const f of played) bySeason.set(f.season, [...(bySeason.get(f.season) ?? []), f]);
  for (const [s, list] of bySeason) {
    const byId = new Map(list.map((f) => [f.id, f]));
    const rows = await fetchAllPages<{ player_id: string; match_id: number }>((from, to) =>
      admin
        .from('player_stats')
        .select('player_id, match_id')
        .eq('season', s)
        .in('match_id', [...byId.keys()])
        .eq('stats->>started', 'true')
        .order('id', { ascending: true })
        .range(from, to),
    );
    for (const r of rows) {
      const f = byId.get(r.match_id);
      const club = clubOf(r.player_id);
      if (!f || !club) continue;
      const side: MatchSide | null = club === f.home ? 'home' : club === f.away ? 'away' : null;
      if (!side) continue;
      const key = fixtureKey(f);
      const entry = startersByFixture.get(key) ?? { home: [], away: [] };
      entry[side].push(r.player_id);
      startersByFixture.set(key, entry);
    }
  }

  // Where each side's starters stood, for every played match above.
  const layouts = new Map<string, MatchLayout>();
  for (const [s, list] of bySeason) {
    const { data } = await admin
      .from('pl_match_lineups')
      .select('fpl_fixture_id, club_slug, formation, lines')
      .eq('season', s)
      .in('fpl_fixture_id', list.map((f) => f.id));
    for (const r of data ?? []) {
      layouts.set(`${s}:${r.fpl_fixture_id}|${r.club_slug}`, { formation: r.formation, lines: r.lines as string[][] });
    }
  }
  const layoutOf = (f: BuilderFixture, club: string) => layouts.get(`${fixtureKey(f)}|${club}`) ?? null;

  // Each club's most recent XI before a given kickoff.
  const playedDesc = [...played].sort((a, b) => Date.parse(b.kickoff ?? '') - Date.parse(a.kickoff ?? ''));
  const lastXI = (club: string, before: BuilderFixture): SideSource | null => {
    const cutoff = before.kickoff ? Date.parse(before.kickoff) : now;
    for (const f of playedDesc) {
      if (fixtureKey(f) === fixtureKey(before) || Date.parse(f.kickoff ?? '') >= cutoff) continue;
      const side: MatchSide | null = f.home === club ? 'home' : f.away === club ? 'away' : null;
      const ids = side ? startersByFixture.get(fixtureKey(f))?.[side] : undefined;
      if (side && ids?.length) {
        return {
          kind: 'last',
          playerIds: ids,
          from: { opponentName: side === 'home' ? f.awayName : f.homeName, atHome: side === 'home', kickoff: f.kickoff },
          layout: layoutOf(f, club),
        };
      }
    }
    return null;
  };

  const lineups: MatchLineups = {};
  for (const f of listed) {
    const started = startersByFixture.get(fixtureKey(f));
    const sideFor = (side: MatchSide): SideSource | null => {
      const ids = started?.[side];
      if (ids?.length) {
        return {
          kind: 'started',
          playerIds: ids,
          from: { opponentName: side === 'home' ? f.awayName : f.homeName, atHome: side === 'home', kickoff: f.kickoff },
          layout: layoutOf(f, side === 'home' ? f.home : f.away),
        };
      }
      return lastXI(side === 'home' ? f.home : f.away, f);
    };
    lineups[fixtureKey(f)] = { home: sideFor('home'), away: sideFor('away') };
  }

  return { fixtures, linked: linkedFixture, lineups };
}

/** "Chelsea vs. Tottenham", the title a match gives a lineup by default. */
export function fixtureTitle(f: BuilderFixture): string {
  return `${f.homeName} vs. ${f.awayName}`;
}

/**
 * "Sat 24 Oct", in UK time. Fixed to London rather than the viewer's zone so
 * the server render and the browser agree, and because the date a Premier
 * League match is listed under is its UK date.
 */
export function kickoffDay(kickoff: string | null): string {
  if (!kickoff) return 'Date TBC';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(kickoff));
}

/** "15:00", UK time, for the same reason as kickoffDay. */
export function kickoffTime(kickoff: string | null): string {
  if (!kickoff) return 'TBC';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(
    new Date(kickoff),
  );
}

export function fixtureDay(f: BuilderFixture): string {
  return kickoffDay(f.kickoff);
}
