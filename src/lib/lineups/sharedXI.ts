import type { SupabaseClient } from '@supabase/supabase-js';
import type { Formation, GranularPosition, Player } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import { CLUB_BY_SLUG, resolveClub } from '@/lib/clubs/registry';
import { deserializeLineup } from './lineupSerializer';
import { fitFormation, type MatchLayout } from './fitFormation';
import { fixtureTitle, type BuilderFixture, type MatchSide } from './builderFixtures';
import { performanceFromRow, type MatchPerformance } from './matchPerformance';

/** One XI as a shared link describes it, resolved to real players. */
export interface SharedXI {
  title: string;
  formation: Formation;
  slots: { pos: GranularPosition; player: Player | null }[];
  /** The side, when the XI is one side of a match. */
  club: { slug: string; name: string } | null;
  matchweek: number | null;
  /** How each player did, once the match has kicked off. Empty for a free-form XI or an upcoming match. */
  performances: Record<string, MatchPerformance>;
}

/**
 * A match's starters by side, in a stable order (the same order the Lineup
 * Builder's loader reads them in, so both lay them out identically).
 */
export async function loadMatchStarters(
  admin: SupabaseClient,
  fixture: Pick<BuilderFixture, 'season' | 'id' | 'home' | 'away'>,
): Promise<Record<MatchSide, string[]>> {
  const { data } = await admin
    .from('player_stats')
    .select('player_id, players(pl_team)')
    .eq('season', fixture.season)
    .eq('match_id', fixture.id)
    .eq('stats->>started', 'true')
    .order('id', { ascending: true });
  const out: Record<MatchSide, string[]> = { home: [], away: [] };
  for (const row of (data ?? []) as unknown as { player_id: string; players: { pl_team: string } | null }[]) {
    const club = resolveClub(row.players?.pl_team)?.slug;
    if (club === fixture.home) out.home.push(row.player_id);
    else if (club === fixture.away) out.away.push(row.player_id);
  }
  return out;
}

/**
 * Resolves a Lineup Builder link (its query string, as a record) to the XI it
 * shows. A match side the link leaves out is the match's real starting XI,
 * laid out by fitFormation exactly as the builder lays it out.
 */
export async function resolveSharedXI(
  admin: SupabaseClient,
  params: Record<string, string | undefined>,
): Promise<SharedXI> {
  const state = deserializeLineup(params);

  let fixture: BuilderFixture | null = null;
  if (state.fixture) {
    const { data } = await admin
      .from('pl_fixtures')
      .select('season, fpl_fixture_id, gameweek, home_club, away_club, kickoff_time, finished, home_score, away_score')
      .eq('season', state.fixture.season)
      .eq('fpl_fixture_id', state.fixture.id)
      .maybeSingle();
    if (data) {
      fixture = {
        season: data.season,
        id: data.fpl_fixture_id,
        gameweek: data.gameweek,
        home: data.home_club,
        away: data.away_club,
        homeName: CLUB_BY_SLUG.get(data.home_club)?.name ?? data.home_club,
        awayName: CLUB_BY_SLUG.get(data.away_club)?.name ?? data.away_club,
        kickoff: data.kickoff_time,
        finished: data.finished,
        homeScore: data.home_score,
        awayScore: data.away_score,
      };
    }
  }

  const side: MatchSide = fixture ? (state.side ?? 'home') : 'home';
  let formation: Formation = state.formation;
  let ids: (string | null)[] = state.playerIds;
  if (fixture && side === 'away') {
    formation = state.away?.formation ?? formation;
    ids = state.away?.playerIds ?? [];
  }
  const fromMatch = fixture !== null && !ids.some(Boolean);

  let starterIds: string[] = [];
  let layout: MatchLayout | null = null;
  if (fromMatch && fixture) {
    const [starters, { data: lineup }] = await Promise.all([
      loadMatchStarters(admin, fixture),
      admin
        .from('pl_match_lineups')
        .select('formation, lines')
        .eq('season', fixture.season)
        .eq('fpl_fixture_id', fixture.id)
        .eq('club_slug', fixture[side])
        .maybeSingle(),
    ]);
    starterIds = starters[side];
    layout = lineup ? { formation: lineup.formation, lines: lineup.lines as string[][] } : null;
  }

  const wanted = [...new Set([...ids.filter((x): x is string => !!x), ...starterIds])];
  const players = new Map<string, Player>();
  if (wanted.length) {
    const { data } = await admin.from('players').select('*').in('id', wanted);
    for (const p of (data ?? []) as Player[]) players.set(p.id, p);
  }

  // Ratings and events for whoever is on the card, once the match is under way.
  const performances: Record<string, MatchPerformance> = {};
  if (fixture && fixture.kickoff && Date.parse(fixture.kickoff) <= Date.now()) {
    const onCard = [...new Set([...ids.filter((x): x is string => !!x), ...starterIds])];
    if (onCard.length) {
      const { data } = await admin
        .from('player_stats')
        .select('player_id, match_rating, stats')
        .eq('season', fixture.season)
        .eq('match_id', fixture.id)
        .in('player_id', onCard);
      for (const r of (data ?? []) as { player_id: string; match_rating: number | null; stats: Record<string, unknown> }[]) {
        const perf = performanceFromRow(r);
        if (perf) performances[r.player_id] = perf;
      }
    }
  }

  if (fromMatch) {
    const fit = fitFormation(
      starterIds.map((id) => players.get(id)).filter((p): p is Player => !!p),
      layout,
    );
    formation = fit.formation;
    ids = fit.playerIds;
  }

  const slots = (FORMATION_SLOTS[formation] as GranularPosition[]).map((pos, i) => ({
    pos,
    player: ids[i] ? players.get(ids[i]!) ?? null : null,
  }));

  return {
    title: fixture ? fixtureTitle(fixture) : state.title.trim() || 'Starting XI',
    formation,
    slots,
    club: fixture ? { slug: fixture[side], name: side === 'home' ? fixture.homeName : fixture.awayName } : null,
    matchweek: fixture?.gameweek ?? null,
    performances,
  };
}
