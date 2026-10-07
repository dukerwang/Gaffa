/**
 * The Caretaker's decisions, as pure functions so they can be tested without a
 * database. `runCaretakers` (./runCaretakers.ts) loads the inputs and applies
 * the results.
 *
 * The Caretaker runs a club whose manager has left (migration 169). It keeps
 * the club playing sensibly and nothing more: it picks the best lineup it can,
 * parks injured players on IR, brings fit ones back, and activates held
 * players when there's room. It never signs, sells, trades or drops anyone.
 */

import { selectBestLineup, type FormationCandidate } from '@/lib/lineups/selectBestLineup';
import { currentProjection, type ProjectionSource } from '@/lib/projections/currentProjection';
import type { BenchSlot, GranularPosition, MatchupLineup, RosterStatus } from '@/types';

export interface CaretakerPlayer extends ProjectionSource {
  id: string;
  primary_position: GranularPosition | null;
  secondary_positions?: GranularPosition[] | null;
  pl_team_id: number | null;
  ppg?: number | null;
  fpl_status?: string | null;
  fpl_chance_next_round?: number | null;
}

export interface CaretakerEntry {
  id: string;
  status: RosterStatus;
  player: CaretakerPlayer;
}

/** Statuses that can't appear in a lineup. */
const OUT_OF_LINEUP: ReadonlySet<RosterStatus> = new Set(['ir', 'taxi', 'loan_out', 'held']);

/**
 * How likely the player is to play this gameweek, from FPL's flags. FPL
 * publishes a percentage for flagged players; an unflagged player is assumed
 * fit.
 */
export function availability(player: CaretakerPlayer): number {
  if (player.fpl_chance_next_round != null) return Math.max(0, Math.min(1, player.fpl_chance_next_round / 100));
  switch (player.fpl_status) {
    case 'i':
    case 'u':
    case 's':
    case 'n':
      return 0;
    case 'd':
      return 0.5;
    default:
      return 1;
  }
}

/**
 * The value the Caretaker maximises when it picks a lineup. Gaffa's own
 * projection for this gameweek when one is stamped for it (it already accounts
 * for fixtures and fitness), otherwise points per game scaled by the chance of
 * playing.
 */
export function caretakerScore(player: CaretakerPlayer, season: string | null, gameweek: number): number {
  const projected = currentProjection(player, season, gameweek);
  if (projected != null) return projected;
  return Number(player.ppg ?? 0) * availability(player);
}

/**
 * The best lineup from the players who can appear in one, or null when the
 * squad can't fill all eleven starting slots and four bench slots.
 */
export function pickCaretakerLineup(
  entries: CaretakerEntry[],
  season: string | null,
  gameweek: number,
): MatchupLineup | null {
  const candidates: FormationCandidate[] = entries
    .filter((e) => !OUT_OF_LINEUP.has(e.status) && e.player.primary_position)
    .map((e) => ({
      id: e.player.id,
      score: caretakerScore(e.player, season, gameweek),
      positions: [e.player.primary_position as GranularPosition, ...(e.player.secondary_positions ?? [])],
    }));

  const best = selectBestLineup(candidates);
  if (!best) return null;

  const benchOrder: BenchSlot[] = ['DEF', 'MID', 'ATT', 'FLEX'];
  const bench = benchOrder.map((slot) => ({ player_id: best.bench[slot], slot }));
  if (best.starters.length !== 11 || bench.some((b) => !b.player_id)) return null;

  return {
    formation: best.formation,
    starters: best.starters.map((s) => ({ player_id: s.playerId, slot: s.slot })),
    bench: bench as { player_id: string; slot: BenchSlot }[],
  };
}

export type SquadMove =
  | { kind: 'to_ir'; entryId: string; playerId: string }
  | { kind: 'from_ir'; entryId: string; playerId: string }
  | { kind: 'activate_held'; entryId: string; playerId: string };

export interface SquadPlanInput {
  entries: CaretakerEntry[];
  irSlots: number;
  rosterLimit: number;
  /** Players whose IR status can't change right now (their match has kicked off). */
  isIrLocked: (player: CaretakerPlayer) => boolean;
}

/** Definitely out this week: injured or unavailable. A doubtful player stays in the squad. */
function isOut(player: CaretakerPlayer): boolean {
  return player.fpl_status === 'i' || player.fpl_status === 'u';
}

function isFit(player: CaretakerPlayer): boolean {
  return (player.fpl_status ?? 'a') === 'a';
}

/** Counts toward the squad limit (matches SQL team_active_count). */
function counts(status: RosterStatus): boolean {
  return status !== 'ir' && status !== 'taxi' && status !== 'loan_in' && status !== 'held';
}

/**
 * The IR and held-player moves to make, in order:
 *
 * 1. Injured or unavailable squad players go to IR while it has room. The
 *    least likely to return soon goes first, so a scarce slot holds the
 *    longest absence.
 * 2. Held players are activated into the reserves while there's room. While a
 *    club holds anyone its squad can't grow (the held-player freeze), so holds
 *    clear before anyone else comes back.
 * 3. Fit players on IR come back into the squad while there's room, and only
 *    once nobody is held.
 *
 * Loaned-in players can't go to IR, matching the IR route.
 */
export function planSquadMoves({ entries, irSlots, rosterLimit, isIrLocked }: SquadPlanInput): SquadMove[] {
  const moves: SquadMove[] = [];
  let onIr = entries.filter((e) => e.status === 'ir').length;
  let squad = entries.filter((e) => counts(e.status)).length;

  const toIr = entries
    .filter((e) => (e.status === 'active' || e.status === 'bench') && isOut(e.player) && !isIrLocked(e.player))
    .sort((a, b) => availability(a.player) - availability(b.player) || a.player.id.localeCompare(b.player.id));
  for (const e of toIr) {
    if (onIr >= irSlots) break;
    moves.push({ kind: 'to_ir', entryId: e.id, playerId: e.player.id });
    onIr++;
    squad--;
  }

  const held = entries
    .filter((e) => e.status === 'held')
    .sort((a, b) => Number(b.player.ppg ?? 0) - Number(a.player.ppg ?? 0) || a.player.id.localeCompare(b.player.id));
  let stillHeld = held.length;
  for (const e of held) {
    if (squad >= rosterLimit) break;
    moves.push({ kind: 'activate_held', entryId: e.id, playerId: e.player.id });
    squad++;
    stillHeld--;
  }
  if (stillHeld > 0) return moves;

  const fitOnIr = entries
    .filter((e) => e.status === 'ir' && isFit(e.player) && !isIrLocked(e.player))
    .sort((a, b) => Number(b.player.ppg ?? 0) - Number(a.player.ppg ?? 0) || a.player.id.localeCompare(b.player.id));
  for (const e of fitOnIr) {
    if (squad >= rosterLimit) break;
    moves.push({ kind: 'from_ir', entryId: e.id, playerId: e.player.id });
    squad++;
  }

  return moves;
}
