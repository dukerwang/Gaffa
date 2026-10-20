import type { Formation, GranularPosition } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import { VALID_FORMATIONS } from './lineupSerializer';

/**
 * Lays a real starting XI out on one of Gaffa's formations.
 *
 * FPL says who started a match, not what shape the side played or where each
 * player stood, so the shape is inferred: every supported formation is tried,
 * the eleven are matched to its slots by their listed positions, and the
 * formation with the best total wins. A side that really played a shape Gaffa
 * has no layout for (a 4-2-3-1, say) lands on the nearest one, which is all
 * the builder could draw anyway.
 *
 * The result is a best fit from listed positions. A centre-back the manager
 * played at full-back is placed by his listing, not his afternoon.
 */

export interface FitPlayer {
  id: string;
  primary_position: GranularPosition | null;
  secondary_positions?: GranularPosition[] | null;
}

export interface FittedLineup {
  formation: Formation;
  /** Player id per slot, in FORMATION_SLOTS order; null where nobody fits. */
  playerIds: (string | null)[];
}

const GROUP: Record<GranularPosition, 'GK' | 'DEF' | 'MID' | 'ATT'> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  DM: 'MID', CM: 'MID', AM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT',
};

/** How well a player listed at one position fills another. Symmetric. */
const NEAR: [GranularPosition, GranularPosition, number][] = [
  ['LB', 'LWB', 7], ['RB', 'RWB', 7],
  ['DM', 'CM', 7], ['CM', 'AM', 7],
  ['LW', 'RW', 6],
  ['AM', 'LW', 5], ['AM', 'RW', 5], ['ST', 'LW', 5], ['ST', 'RW', 5], ['AM', 'ST', 5],
  ['LB', 'RB', 5], ['LWB', 'RWB', 5],
  ['LWB', 'LW', 4], ['RWB', 'RW', 4],
  ['CB', 'LB', 4], ['CB', 'RB', 4], ['CB', 'DM', 4],
  ['DM', 'AM', 3],
];
const nearKey = (a: GranularPosition, b: GranularPosition) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const NEAR_SCORE = new Map(NEAR.map(([a, b, w]) => [nearKey(a, b), w]));

const EXACT = 10;
const SAME_GROUP = 2;
/** Keepers only in goal, and only keepers in goal. */
const KEEPER_MISMATCH = -100;

function affinity(slot: GranularPosition, pos: GranularPosition): number {
  if (slot === pos) return EXACT;
  if (slot === 'GK' || pos === 'GK') return KEEPER_MISMATCH;
  return NEAR_SCORE.get(nearKey(slot, pos)) ?? (GROUP[slot] === GROUP[pos] ? SAME_GROUP : 0);
}

/** A secondary listing counts a point less than the same primary. */
function playerFit(slot: GranularPosition, p: FitPlayer): number {
  let best = p.primary_position ? affinity(slot, p.primary_position) : 0;
  for (const s of p.secondary_positions ?? []) best = Math.max(best, affinity(slot, s) - 1);
  return best;
}

function popcount(n: number): number {
  let c = 0;
  for (let x = n; x; x &= x - 1) c++;
  return c;
}

/** Best assignment of up to eleven players to one formation's slots, by bitmask DP. */
function assign(slots: GranularPosition[], players: FitPlayer[]): { score: number; ids: (string | null)[] } {
  const n = slots.length;
  // Pad to one player per slot; a pad fits nowhere and scores nothing, which leaves that slot empty.
  const pool: (FitPlayer | null)[] = [...players.slice(0, n)];
  while (pool.length < n) pool.push(null);
  const w = slots.map((slot) => pool.map((p) => (p ? playerFit(slot, p) : 0)));

  const size = 1 << n;
  const dp = new Float64Array(size).fill(-Infinity);
  const prev = new Int32Array(size);
  const pick = new Int8Array(size);
  dp[0] = 0;
  for (let mask = 0; mask < size; mask++) {
    if (dp[mask] === -Infinity) continue;
    const slot = popcount(mask);
    if (slot >= n) continue;
    for (let j = 0; j < n; j++) {
      if (mask & (1 << j)) continue;
      const next = mask | (1 << j);
      const v = dp[mask] + w[slot][j];
      if (v > dp[next]) {
        dp[next] = v;
        prev[next] = mask;
        pick[next] = j;
      }
    }
  }

  const ids: (string | null)[] = Array(n).fill(null);
  for (let mask = size - 1; mask; mask = prev[mask]) {
    const slot = popcount(mask) - 1;
    ids[slot] = pool[pick[mask]]?.id ?? null;
  }
  return { score: dp[size - 1], ids };
}

/**
 * The formation that best fits these starters, and who goes where. Ties go to
 * the earlier formation in VALID_FORMATIONS, so the result is deterministic.
 */
export function fitFormation(players: FitPlayer[]): FittedLineup {
  let best: { formation: Formation; score: number; ids: (string | null)[] } | null = null;
  for (const formation of VALID_FORMATIONS) {
    const { score, ids } = assign(FORMATION_SLOTS[formation] as GranularPosition[], players);
    if (!best || score > best.score) best = { formation, score, ids };
  }
  // SAFETY: VALID_FORMATIONS is a non-empty constant, so the loop always sets best.
  return { formation: best!.formation, playerIds: best!.ids };
}
