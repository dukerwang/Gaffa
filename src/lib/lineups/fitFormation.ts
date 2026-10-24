import type { Formation, GranularPosition } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import { VALID_FORMATIONS } from './lineupSerializer';
import { slotSides } from './pitchZones';

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
 *
 * A listing never says which of two centre-backs is on the left, so where a
 * formation has two or more slots of one position, the players in them are
 * ordered left to right by their lean (see `lean`).
 *
 * When the match feed says where they stood (a MatchLayout), that wins: each
 * player's side comes from his place in his line, slots are scored against it,
 * and the Gaffa shape that matches the real formation is preferred.
 */

export interface FitPlayer {
  id: string;
  primary_position: GranularPosition | null;
  secondary_positions?: GranularPosition[] | null;
  preferred_foot?: 'left' | 'right' | 'both' | null;
}

/**
 * Where the starters actually stood, from the Premier League's match feed
 * (pl_match_lineups): the formation label and the lines, goalkeeper first, each
 * left to right as player ids.
 */
export interface MatchLayout {
  formation: string | null;
  lines: string[][];
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

const LEFT = new Set<GranularPosition>(['LB', 'LWB', 'LW']);
const RIGHT = new Set<GranularPosition>(['RB', 'RWB', 'RW']);
const ATTACKING = new Set<GranularPosition>(['AM', 'ST']);

/**
 * Which side of a pair a player belongs on: negative is left, positive right,
 * zero is no preference. Two signals, weighted by the slot:
 *
 *   - a sided listing (LW, RB, LWB...) among his positions, which says where
 *     he has actually played wide;
 *   - his preferred foot.
 *
 * In defence and central midfield the foot decides and a sided listing breaks
 * a tie: a left-footed centre-back plays on the left. In attacking midfield and
 * up front the listing decides, because attackers are often inverted; an
 * attacking midfielder with no sided listing goes to the side opposite his foot
 * (a left-footer cutting in from the right), a striker to the side of it.
 */
function lean(p: FitPlayer, slot: GranularPosition): number {
  let sided = 0;
  for (const pos of [p.primary_position, ...(p.secondary_positions ?? [])]) {
    if (pos && LEFT.has(pos)) sided -= 1;
    if (pos && RIGHT.has(pos)) sided += 1;
  }
  const foot = p.preferred_foot === 'left' ? -1 : p.preferred_foot === 'right' ? 1 : 0;
  if (!ATTACKING.has(slot)) return 2 * foot + Math.sign(sided);
  return 2 * Math.sign(sided) + (slot === 'AM' ? -foot : foot);
}

/** Orders the players within each run of same-position slots left to right. Slots are listed left to right. */
function orderSides(
  slots: GranularPosition[],
  ids: (string | null)[],
  byId: Map<string, FitPlayer>,
  side: Map<string, number>,
): (string | null)[] {
  const out = [...ids];
  const groups = new Map<GranularPosition, number[]>();
  slots.forEach((slot, i) => groups.set(slot, [...(groups.get(slot) ?? []), i]));
  for (const [slot, idx] of groups) {
    if (idx.length < 2) continue;
    // Only filled slots trade places; an empty one stays where it is.
    const filled = idx.filter((i) => out[i] && byId.has(out[i]!));
    const group = filled.map((i) => out[i]!);
    // Where they really stood, when the feed says for all of them; otherwise their lean.
    const known = group.every((id) => side.has(id));
    const sorted = group.sort((a, b) =>
      known ? side.get(a)! - side.get(b)! : lean(byId.get(a)!, slot) - lean(byId.get(b)!, slot),
    );
    filled.forEach((i, k) => (out[i] = sorted[k]));
  }
  return out;
}

function popcount(n: number): number {
  let c = 0;
  for (let x = n; x; x &= x - 1) c++;
  return c;
}

/** Best assignment of up to eleven players to one formation's slots, by bitmask DP. */
/** Points lost per unit of distance between a player's real side and his slot's (sides run -1 to 1). */
const SIDE_COST = 3;
/** Points a Gaffa shape gains for being the one the side really played. */
const SHAPE_BONUS = 12;

/** The feed's formation labels, as the Gaffa shape that draws them. */
const SHAPE_FOR_LABEL: Record<string, Formation> = {
  '4-3-3': '4-3-3', '4-1-4-1': '4-3-3', '4-2-3-1': '4-2-1-3', '4-4-1-1': '4-2-1-3', '4-2-2-2': '4-2-2-2',
  '3-4-1-2': '3-4-1-2', '3-5-2': '3-5-2', '3-1-4-2': '3-5-2', '3-4-3': '3-4-3', '3-4-2-1': '3-4-2-1',
  '5-3-2': '5-3-2', '5-4-1': '5-3-2', '4-3-1-2': '4-3-1-2', '4-1-2-1-2': '4-3-1-2', '4-3-2-1': '4-3-2-1',
  '4-4-2': '4-2-4', '4-2-4': '4-2-4', '5-2-3': '5-2-3', '5-2-1-2': '5-3-2', '3-5-1-1': '3-4-2-1',
};

function assign(
  formation: Formation,
  players: FitPlayer[],
  side: Map<string, number>,
): { score: number; ids: (string | null)[] } {
  const slots = FORMATION_SLOTS[formation] as GranularPosition[];
  const sides = slotSides(formation);
  const n = slots.length;
  // Pad to one player per slot; a pad fits nowhere and scores nothing, which leaves that slot empty.
  const pool: (FitPlayer | null)[] = [...players.slice(0, n)];
  while (pool.length < n) pool.push(null);
  const w = slots.map((slot, i) =>
    pool.map((p) => {
      if (!p) return 0;
      const x = side.get(p.id);
      return playerFit(slot, p) - (x === undefined ? 0 : SIDE_COST * Math.abs(x - sides[i]));
    }),
  );

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
export function fitFormation(players: FitPlayer[], layout?: MatchLayout | null): FittedLineup {
  // Each player's real side, -1 (left) to 1 (right), from his place in his line.
  const side = new Map<string, number>();
  for (const line of layout?.lines ?? []) {
    line.forEach((id, i) => side.set(id, line.length === 1 ? 0 : -1 + (2 * i) / (line.length - 1)));
  }
  const shape = layout?.formation ? SHAPE_FOR_LABEL[layout.formation.trim()] : undefined;

  let best: { formation: Formation; score: number; ids: (string | null)[] } | null = null;
  for (const formation of VALID_FORMATIONS) {
    const fit = assign(formation, players, side);
    const score = fit.score + (formation === shape ? SHAPE_BONUS : 0);
    if (!best || score > best.score) best = { formation, score, ids: fit.ids };
  }
  // SAFETY: VALID_FORMATIONS is a non-empty constant, so the loop always sets best.
  const slots = FORMATION_SLOTS[best!.formation] as GranularPosition[];
  const byId = new Map(players.map((p) => [p.id, p]));
  return { formation: best!.formation, playerIds: orderSides(slots, best!.ids, byId, side) };
}
