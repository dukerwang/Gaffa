/**
 * What a cup bracket is seeded from.
 *
 * A league with an archived table from last season seeds from that. A league
 * in its first season seeds from its own table as it stood after gameweek 7,
 * counting finished gameweeks only (docs/USER_GUIDE.md § 6). With neither,
 * there is nothing to seed from and no bracket is made.
 *
 * Two mistakes this module exists to prevent, both made on 2026-08-21 and
 * 2026-11-08:
 *
 * - Drawing before anyone has played. Every club sits on 0 points and
 *   `league_standings` falls through to its last tie-break, the club name, so
 *   seeds and byes come out alphabetical.
 * - Reading `league_standings` for the table. It counts `live` matchups, so a
 *   gameweek still being scored (and not yet through FPL's post-lockdown pass)
 *   moves clubs up and down on provisional numbers. The table here is built from
 *   `completed` matchups with a gameweek no later than the seeding gameweek, so
 *   the seeds are the same whenever they are drawn.
 *
 * `leagues.previous_season` is NOT evidence of an archive. It names the
 * previous FPL season (it feeds the draft board) from the day a league is
 * created, so a first-season league has one and no archived standings. Ask for
 * archived rows instead.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';

/** A league's first season seeds its cups from the table after this gameweek. */
export const INAUGURAL_SEASON_CUP_SEED_GW = 7;

export type SeedBasis = 'archive' | 'standings' | 'none';

export interface CupSeedOrder<T> {
  basis: SeedBasis;
  /** Best seed first. Meaningless when `basis` is 'none'. */
  ordered: T[];
}

export interface TableRow {
  rank: number;
  played: number;
}

export interface FinishedMatchup {
  gameweek: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | string | null;
  score_b: number | string | null;
}

/**
 * The league table after `throughGw`, from finished matchups only: 3 points for
 * a win, 1 for a draw (a margin inside the draw band), 0 for a loss, then goal
 * difference, points for, and team name. The same order as `league_standings`.
 *
 * Empty until the league has finished gameweek `throughGw`: a table of fewer
 * gameweeks is not the table the rule asks for.
 */
export function tableThrough(
  matchups: FinishedMatchup[],
  teams: { id: string; team_name?: string | null }[],
  throughGw: number,
): Map<string, TableRow> {
  const finished = matchups.filter((m) => m.gameweek <= throughGw && m.team_a_id && m.team_b_id);
  if (!finished.some((m) => m.gameweek === throughGw)) return new Map();

  const row = new Map(teams.map((t) => [t.id, { pts: 0, gd: 0, pf: 0, played: 0 }]));
  for (const m of finished) {
    const a = Number(m.score_a ?? 0);
    const b = Number(m.score_b ?? 0);
    const draw = Math.abs(a - b) <= DRAW_THRESHOLD;
    for (const [id, pf, pa] of [[m.team_a_id!, a, b], [m.team_b_id!, b, a]] as const) {
      const r = row.get(id);
      if (!r) continue;
      r.played += 1;
      r.pf += pf;
      r.gd += pf - pa;
      r.pts += draw ? 1 : pf > pa ? 3 : 0;
    }
  }

  const name = (id: string) => teams.find((t) => t.id === id)?.team_name ?? '';
  const ranked = [...row.entries()].sort(
    ([ia, a], [ib, b]) => b.pts - a.pts || b.gd - a.gd || b.pf - a.pf || name(ia).localeCompare(name(ib)),
  );
  return new Map(ranked.map(([id, r], i) => [id, { rank: i + 1, played: r.played }]));
}

/**
 * Orders `teams` best seed first.
 *
 * `archiveRanks` is last season's final_rank per club (empty when there is no
 * archive). `table` is from `tableThrough` (empty when there is no table to
 * trust yet). A club missing from the archive (an expansion club) goes below
 * the archived ones and is ordered among its peers by the current table.
 */
export function orderForSeeding<T extends { id: string; team_name?: string | null }>(
  teams: T[],
  archiveRanks: Map<string, number>,
  table: Map<string, TableRow>,
): CupSeedOrder<T> {
  const tableRank = (t: T) => table.get(t.id)?.rank ?? 999;
  const byName = (a: T, b: T) => (a.team_name ?? '').localeCompare(b.team_name ?? '');

  if (archiveRanks.size > 0) {
    const archived = (t: T) => archiveRanks.get(t.id) ?? 999;
    return {
      basis: 'archive',
      ordered: [...teams].sort((a, b) => archived(a) - archived(b) || tableRank(a) - tableRank(b) || byName(a, b)),
    };
  }

  if (table.size > 0) {
    return { basis: 'standings', ordered: [...teams].sort((a, b) => tableRank(a) - tableRank(b) || byName(a, b)) };
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

/**
 * The league's table after the seeding gameweek, from finished matchups, or an
 * empty map while that gameweek is unfinished. A league's schedule for the
 * season is at most a few hundred rows, so it is read in one page.
 */
export async function loadSeedTable(
  admin: SupabaseClient,
  leagueId: string,
  teams: { id: string; team_name?: string | null }[],
  throughGw: number = INAUGURAL_SEASON_CUP_SEED_GW,
): Promise<Map<string, TableRow>> {
  const { data } = await admin
    .from('matchups')
    .select('gameweek, team_a_id, team_b_id, score_a, score_b')
    .eq('league_id', leagueId)
    .eq('status', 'completed')
    .lte('gameweek', throughGw);
  return tableThrough((data ?? []) as FinishedMatchup[], teams, throughGw);
}

/** Whether a league's cups can be drawn at all yet: it has an archive, or it has finished the seeding gameweek. */
export async function hasCupSeedBasis(admin: SupabaseClient, leagueId: string): Promise<boolean> {
  if ((await loadArchiveRanks(admin, leagueId)).size > 0) return true;
  const { data: teams } = await admin.from('teams').select('id, team_name').eq('league_id', leagueId);
  return (await loadSeedTable(admin, leagueId, teams ?? [])).size > 0;
}
