/**
 * Repairs a saved lineup without replacing it (held players spec R13).
 *
 * While a team's lineup is locked because a player is held, the last saved
 * lineup carries forward. It can still break: a starter dropped, traded, moved
 * to IR, sold, gone from the Premier League, or no longer eligible for his slot
 * after a position change. Regenerating the whole XI would hand a locked
 * manager a lineup better than their own, which undercuts the lock, so this
 * keeps every valid pick and fills only the slots that broke.
 *
 * Eligibility is exact-position, as everywhere else (POSITION_FLEX_MAP /
 * BENCH_FLEX_MAP). A broken starter slot takes the highest-scoring available
 * player who can play it; only if nobody can does it fall back to the same
 * line (DEF/MID/ATT), then anyone, the same order generateValidLineup uses.
 */

import { BENCH_FLEX_MAP, POSITION_FLEX_MAP } from '@/types';
import type { BenchSlot, GranularPosition, MatchupLineup } from '@/types';

export interface GapFillCandidate {
  id: string;
  positions: GranularPosition[];
  /** Higher is better. Ties keep input order. */
  score: number;
}

const LINE: Record<string, 'GK' | 'DEF' | 'MID' | 'ATT'> = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  DM: 'MID', CM: 'MID', AM: 'MID', LW: 'ATT', RW: 'ATT', ST: 'ATT',
};

export function fillLineupGaps(
  lineup: MatchupLineup,
  pool: GapFillCandidate[],
): { lineup: MatchupLineup; filled: number } | null {
  const byId = new Map(pool.map((c) => [c.id, c]));
  const ranked = [...pool].sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  let filled = 0;

  const canStart = (c: GapFillCandidate, slot: GranularPosition) =>
    c.positions.some((p) => (POSITION_FLEX_MAP[slot] as GranularPosition[]).includes(p));
  const canBench = (c: GapFillCandidate, slot: BenchSlot) =>
    c.positions.some((p) => (BENCH_FLEX_MAP[slot] as GranularPosition[]).includes(p));

  // Pass 1: keep every pick that is still on the squad and still eligible.
  const starters = lineup.starters.map((s) => {
    const c = byId.get(s.player_id);
    if (c && !used.has(c.id) && canStart(c, s.slot)) {
      used.add(c.id);
      return { ...s };
    }
    return { slot: s.slot, player_id: '' };
  });
  const bench = lineup.bench.map((b) => {
    const c = byId.get(b.player_id);
    if (c && !used.has(c.id) && canBench(c, b.slot)) {
      used.add(c.id);
      return { ...b };
    }
    return { slot: b.slot, player_id: '' };
  });

  const take = (match: (c: GapFillCandidate) => boolean): string => {
    const c = ranked.find((x) => !used.has(x.id) && match(x));
    if (!c) return '';
    used.add(c.id);
    filled += 1;
    return c.id;
  };

  // Pass 2: fill broken starter slots, strictest match first.
  for (const s of starters) {
    if (s.player_id) continue;
    s.player_id =
      take((c) => canStart(c, s.slot)) ||
      take((c) => c.positions.some((p) => LINE[p] === LINE[s.slot])) ||
      take(() => true);
  }

  // Pass 3: fill broken bench slots in their fixed order. No fallback here: the
  // bench category is where a player may sit, not a preference.
  for (const b of bench) {
    if (b.player_id) continue;
    b.player_id = take((c) => canBench(c, b.slot));
  }

  if (starters.some((s) => !s.player_id) || bench.slice(0, 4).some((b) => !b.player_id)) return null;
  return { lineup: { formation: lineup.formation, starters, bench }, filled };
}
