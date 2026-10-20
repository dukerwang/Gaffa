import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BY_SLUG } from '@/lib/clubs/registry';

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
}

/** How many matchweeks the picker offers, starting from the one in progress. */
const WEEKS_AHEAD = 3;

interface FixtureRow {
  season: string;
  fpl_fixture_id: number;
  gameweek: number;
  home_club: string;
  away_club: string;
  kickoff_time: string | null;
  finished: boolean;
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
  };
}

const COLUMNS = 'season, fpl_fixture_id, gameweek, home_club, away_club, kickoff_time, finished';

/**
 * The matchweek in progress and the two after it, plus the match a shared link
 * names when that match has dropped out of the window, so an old link still
 * opens on its own fixture. Empty in the close season.
 */
export async function loadBuilderFixtures(
  admin: SupabaseClient,
  season: string,
  linked: { season: string; id: number } | null,
): Promise<{ fixtures: BuilderFixture[]; linked: BuilderFixture | null }> {
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
      .gte('gameweek', next.gameweek)
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

  return { fixtures, linked: linkedFixture };
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
export function fixtureDay(f: BuilderFixture): string {
  if (!f.kickoff) return 'Date TBC';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(f.kickoff));
}
