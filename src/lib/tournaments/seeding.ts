/**
 * When a cup is drawn, and what it is seeded from.
 *
 * Decided 2026-11-08 (docs/DECISIONS.md): every cup is drawn once, after the
 * last gameweek before its first round, from the league table as it stands
 * then. Last season's final table only separates clubs level on that table. The same rule holds in a league's first season and every season
 * after, so there is no special case to get wrong.
 *
 * - League Cup: after MW15 (first round MW16).
 * - Champions Cup: after MW31 (first round MW32). The Consolation Cup is drawn
 *   with it, because a league of 7 or more splits one table into the two cups.
 *
 * Rules the code below holds to, each of which was a real mistake:
 *
 * - Never draw before there is a table. On 2026-08-21 two cups were drawn with
 *   every club on 0 points and `league_standings` fell through to its last
 *   tie-break, the club name, so seeds and byes came out alphabetical.
 * - Never read `league_standings` for the table. It counts `live` matchups, so
 *   a gameweek still being scored (and not yet through FPL's post-lockdown
 *   pass) moves clubs on provisional numbers. The table here comes from
 *   `completed` matchups only, and only when every matchup up to the draw
 *   gameweek is completed. The same seeds come out whenever it is drawn.
 * - Never take `leagues.previous_season` as evidence of an archive. It names the
 *   previous FPL season from the day a league is created.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import { buildRoundSpecs, nextPow2 } from '@/lib/tournaments/engine';
import type { TournamentType } from '@/types';

/**
 * The gameweek whose table a cup is drawn from: the one before its first round
 * starts, and never earlier than MW1. Derived from the round schedule so the
 * two cannot drift apart. A Consolation Cup shares the Champions Cup's draw.
 */
export function cupDrawGameweek(type: TournamentType, clubs: number): number {
  const drawn = type === 'secondary_cup' ? 'secondary_cup' : 'primary_cup';
  const entrants = drawn === 'secondary_cup' ? clubs : clubs >= 7 ? clubs - 2 : clubs;
  const first = buildRoundSpecs(nextPow2(entrants), drawn, clubs)[0];
  return Math.max(1, first.startGameweek - 1);
}

export interface TableRow {
  rank: number;
  played: number;
}

export interface SeedMatchup {
  gameweek: number;
  status: string;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | string | null;
  score_b: number | string | null;
}

/**
 * The league table after `throughGw`: 3 points for a win, 1 for a draw (a margin
 * inside the draw band), 0 for a loss, then goal difference and points for (the
 * order `league_standings` uses), then last season's final rank, then team name.
 * Last season's rank only ever separates clubs level on everything else.
 * Built from finished matchups only.
 *
 * Empty (not ready) unless every matchup up to `throughGw` is completed and
 * `throughGw` itself has results.
 */
export function tableThrough(
  matchups: SeedMatchup[],
  teams: { id: string; team_name?: string | null }[],
  throughGw: number,
  archiveRanks: Map<string, number> = new Map(),
  laterFinished = false,
): Map<string, TableRow> {
  const played = matchups.filter((m) => m.gameweek <= throughGw && m.team_a_id && m.team_b_id);
  if (played.some((m) => m.status !== 'completed')) return new Map();
  // `throughGw` has results, or the league has finished a later gameweek (so a
  // blank `throughGw` with no matchups cannot hold the draw back for ever).
  if (!played.some((m) => m.gameweek === throughGw) && !laterFinished) return new Map();
  if (played.length === 0) return new Map();

  const row = new Map(teams.map((t) => [t.id, { pts: 0, gd: 0, pf: 0, played: 0 }]));
  for (const m of played) {
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
  // A club missing from the archive (an expansion club) loses that tie.
  const lastYear = (id: string) => archiveRanks.get(id) ?? 999;
  const ranked = [...row.entries()].sort(
    ([ia, a], [ib, b]) =>
      b.pts - a.pts || b.gd - a.gd || b.pf - a.pf || lastYear(ia) - lastYear(ib) || name(ia).localeCompare(name(ib)),
  );
  return new Map(ranked.map(([id, r], i) => [id, { rank: i + 1, played: r.played }]));
}

export interface CupSeedOrder<T> {
  /** False when there is no table to seed from yet; `ordered` is then empty. */
  ready: boolean;
  /** Best seed first. */
  ordered: T[];
}

/** Orders `teams` best seed first by table position. Not ready when `table` is empty. */
export function orderForSeeding<T extends { id: string }>(teams: T[], table: Map<string, TableRow>): CupSeedOrder<T> {
  if (table.size === 0) return { ready: false, ordered: [] };
  const rank = (t: T) => table.get(t.id)?.rank ?? 999;
  return { ready: true, ordered: [...teams].sort((a, b) => rank(a) - rank(b)) };
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
 * The league's table after `throughGw`, or an empty map while it isn't ready.
 * A league's schedule for a season is a few hundred rows at most, so one page.
 */
export async function loadSeedTable(
  admin: SupabaseClient,
  leagueId: string,
  teams: { id: string; team_name?: string | null }[],
  throughGw: number,
  archiveRanks: Map<string, number> = new Map(),
): Promise<Map<string, TableRow>> {
  const [{ data }, { data: later }] = await Promise.all([
    admin
      .from('matchups')
      .select('gameweek, status, team_a_id, team_b_id, score_a, score_b')
      .eq('league_id', leagueId)
      .lte('gameweek', throughGw),
    admin
      .from('matchups')
      .select('id')
      .eq('league_id', leagueId)
      .eq('status', 'completed')
      .gt('gameweek', throughGw)
      .limit(1),
  ]);
  return tableThrough((data ?? []) as SeedMatchup[], teams, throughGw, archiveRanks, (later ?? []).length > 0);
}
