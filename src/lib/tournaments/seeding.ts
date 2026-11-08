/**
 * What a cup bracket is seeded from.
 *
 * Cups are seeded from the previous season's archived final table when the
 * league has one, and otherwise from the current table, which only means
 * something once clubs have played. With neither, every club sits on 0 points
 * and `league_standings` falls through to its last tie-break, the club name,
 * so seeds and byes come out alphabetical. That is how Dynasty Dragoon and
 * Matchday Militia were drawn on 2026-08-21.
 *
 * `leagues.previous_season` is NOT evidence of an archive. It names the
 * previous FPL season (it feeds the draft board) from the day a league is
 * created, so a first-season league has one and no archived standings. The
 * check that was meant to delay a first-season draw read that label, passed
 * immediately, and never delayed anything. Ask for archived rows instead.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** A league's first season seeds its cups once this many gameweeks of real results exist. */
export const INAUGURAL_SEASON_CUP_SEED_GW = 7;

export type SeedBasis = 'archive' | 'standings' | 'none';

export interface CupSeedOrder<T> {
  basis: SeedBasis;
  /** Best seed first. Meaningless when `basis` is 'none'. */
  ordered: T[];
}

/**
 * Orders `teams` best seed first.
 *
 * `archiveRanks` is last season's final_rank per club (empty when there is no
 * archive). `standings` is the current table with games played, so a table of
 * zeros is recognised as no basis rather than trusted. A club missing from the
 * archive (an expansion club) goes below the archived ones and is ordered
 * among its peers by the current table.
 */
export function orderForSeeding<T extends { id: string; team_name?: string | null }>(
  teams: T[],
  archiveRanks: Map<string, number>,
  standings: Map<string, { rank: number; played: number }>,
): CupSeedOrder<T> {
  const standingRank = (t: T) => standings.get(t.id)?.rank ?? 999;
  const byName = (a: T, b: T) => (a.team_name ?? '').localeCompare(b.team_name ?? '');

  if (archiveRanks.size > 0) {
    const archived = (t: T) => archiveRanks.get(t.id) ?? 999;
    return {
      basis: 'archive',
      ordered: [...teams].sort((a, b) => archived(a) - archived(b) || standingRank(a) - standingRank(b) || byName(a, b)),
    };
  }

  const anyPlayed = [...standings.values()].some((s) => s.played > 0);
  if (anyPlayed) {
    return { basis: 'standings', ordered: [...teams].sort((a, b) => standingRank(a) - standingRank(b) || byName(a, b)) };
  }

  return { basis: 'none', ordered: [...teams].sort(byName) };
}

/** The previous season's final_rank per club, or an empty map when the league has no archive for it. */
export async function loadArchiveRanks(admin: SupabaseClient, leagueId: string): Promise<Map<string, number>> {
  const { data: league } = await admin.from('leagues').select('previous_season').eq('id', leagueId).single();
  const previousSeason = (league as { previous_season?: string | null } | null)?.previous_season;
  if (!previousSeason) return new Map();

  const { data } = await admin
    .from('season_standings_archive')
    .select('team_id, final_rank')
    .eq('league_id', leagueId)
    .eq('season', previousSeason);
  return new Map((data ?? []).map((r: { team_id: string; final_rank: number }) => [r.team_id, Number(r.final_rank)]));
}

/** The current table, with games played. Reads at most one row per club, so it needs no paging. */
export async function loadStandings(
  admin: SupabaseClient,
  leagueId: string,
): Promise<Map<string, { rank: number; played: number }>> {
  const { data } = await admin.from('league_standings').select('team_id, rank, played').eq('league_id', leagueId);
  return new Map(
    (data ?? []).map((r: { team_id: string; rank: number; played: number }) => [
      r.team_id,
      { rank: Number(r.rank), played: Number(r.played) },
    ]),
  );
}

/** Whether a league's cups can be drawn at all yet: it has an archive, or the table has results to seed from. */
export async function hasCupSeedBasis(
  admin: SupabaseClient,
  leagueId: string,
  currentGw: number,
): Promise<boolean> {
  if ((await loadArchiveRanks(admin, leagueId)).size > 0) return true;
  if (currentGw < INAUGURAL_SEASON_CUP_SEED_GW) return false;
  return [...(await loadStandings(admin, leagueId)).values()].some((s) => s.played > 0);
}
