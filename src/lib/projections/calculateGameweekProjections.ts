/**
 * src/lib/projections/calculateGameweekProjections.ts
 *
 * Orchestrates gameweek-wide projected points calculation:
 * 1. Loads fixtures from public.pl_fixtures for the targeted season and gameweek.
 * 2. Builds team-level match environments (expected goals, conceded, clean sheet odds).
 * 3. Maps all active Premier League players into their club's match environment.
 * 4. Returns a map of playerId -> projected_points.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveClub } from '@/lib/clubs/registry';
import { fetchAllPages } from '@/lib/supabase/pagination';
import type { GranularPosition } from '@/types';
import { buildGameweekTeamEnvironments, type FixturePair } from './teamExpectations';
import { calculatePlayerProjectedPoints } from './playerProjections';

export interface PlayerRowForProjection {
  id: string;
  pl_team: string | null;
  primary_position: GranularPosition | null;
  market_value: number | null;
  fpl_status: string | null;
  fpl_starts: number | null;
  fpl_minutes: number | null;
  fpl_chance_next_round: number | null;
}

export interface GameweekProjectionsResult {
  gameweek: number;
  season: string;
  projections: Map<string, number>;
  fixturesFound: number;
}

/**
 * Resolves expected minutes role based on completed rounds, real match appearances,
 * and scouting outlook.
 */
export function resolvePlayerMinutesRole(
  player: {
    primary_position: GranularPosition | null;
    market_value: number | null;
    fpl_starts?: number | null;
    fpl_minutes?: number | null;
  },
  completedRounds: number,
  outlookRole?: string,
): string {
  const starts = player.fpl_starts ?? 0;
  const minutes = player.fpl_minutes ?? 0;

  // Once at least 2 matchdays have taken place in the active season, real match
  // appearances ground the player's role over pre-season assumptions.
  if (completedRounds >= 2) {
    const startRatio = starts / completedRounds;
    if (startRatio >= 0.75) return 'nailed';
    if (startRatio >= 0.50) return 'likely_starter';
    if (starts >= 1) return 'rotation_risk';

    // 0 starts: distinguish between substitute cameos and unplayed reserves
    if (player.primary_position === 'GK') return 'fringe';
    if (minutes > 0) return 'rotation_risk';
    return 'fringe';
  }

  // Early season (GW1/GW2) or before starts data exists: use outlook or valuation fallback
  if (outlookRole) return outlookRole;
  if (player.market_value != null && player.market_value >= 40) return 'likely_starter';
  if (player.market_value != null && player.market_value >= 15) return 'rotation_risk';
  return 'fringe';
}

/**
 * Calculates projected points for all active players (or a subset) for a specific gameweek.
 */
export async function calculateGameweekProjections(
  supabase: SupabaseClient,
  season: string,
  gameweek: number,
  playerIds?: string[],
): Promise<GameweekProjectionsResult> {
  // 1. Fetch gameweek fixtures
  const { data: fixtures, error: fixError } = await supabase
    .from('pl_fixtures')
    .select('home_club, away_club')
    .eq('season', season)
    .eq('gameweek', gameweek);

  if (fixError) throw fixError;

  const fixturePairs: FixturePair[] = (fixtures ?? []).map((f) => ({
    homeClub: f.home_club,
    awayClub: f.away_club,
  }));

  const teamEnvs = buildGameweekTeamEnvironments(fixturePairs);

  // 2. Fetch active players and scouting outlooks concurrently
  const [playerRows, outlooksResult] = await Promise.all([
    fetchAllPages<PlayerRowForProjection>((from, to) => {
      let query = supabase
        .from('players')
        .select(
          'id, pl_team, primary_position, market_value, fpl_status, fpl_starts, fpl_minutes, fpl_chance_next_round',
        )
        .eq('is_active', true);

      if (playerIds?.length) {
        query = query.in('id', playerIds);
      }

      return query.range(from, to);
    }),
    supabase.from('player_outlooks').select('player_id, sidecar'),
  ]);

  const outlookMap = new Map<string, string>();
  for (const row of outlooksResult.data ?? []) {
    const sidecar = row.sidecar as Record<string, unknown> | null;
    const role = sidecar?.minutes_role;
    if (typeof role === 'string') {
      outlookMap.set(row.player_id, role);
    }
  }

  // Determine completed matchdays from maximum player starts across the league
  const completedRounds = Math.max(...playerRows.map((p) => p.fpl_starts ?? 0), 0);

  // 3. Compute projections
  const projections = new Map<string, number>();

  for (const player of playerRows) {
    if (!player.primary_position || !player.pl_team) {
      projections.set(player.id, 0.0);
      continue;
    }

    const club = resolveClub(player.pl_team);
    const env = club ? teamEnvs.get(club.slug) : undefined;

    // Blank gameweek or bye
    if (!env) {
      projections.set(player.id, 0.0);
      continue;
    }

    const outlookRole = outlookMap.get(player.id);
    const minutesRole = resolvePlayerMinutesRole(player, completedRounds, outlookRole);

    const points = calculatePlayerProjectedPoints(
      {
        id: player.id,
        primary_position: player.primary_position,
        market_value: player.market_value,
        fpl_status: player.fpl_status,
        fpl_chance_next_round: player.fpl_chance_next_round,
        fpl_starts: player.fpl_starts,
        fpl_minutes: player.fpl_minutes,
        minutesRole,
      },
      env,
    );

    projections.set(player.id, points);
  }

  return {
    gameweek,
    season,
    projections,
    fixturesFound: fixturePairs.length,
  };
}
