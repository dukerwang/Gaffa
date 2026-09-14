/**
 * src/lib/roster/holds.ts
 *
 * Held players: someone who arrived at a squad with no room waits off it,
 * uncounted, until the manager activates or drops him.
 * Spec: docs/superpowers/specs/2026-09-13-held-players-design.md (R1–R21).
 *
 * While a team holds anyone, moves that grow the squad are frozen (R7). If a
 * player is still held at the first kickoff of the next gameweek, the lineup
 * locks too (R11). The database is the authority on both — `team_is_holding`
 * and `held_lineup_lock_at` in migration 162 — and every database function that
 * adds a player re-checks under lock. The guards here exist so a route can
 * refuse with a sentence a manager understands instead of a raw RPC error.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';

export const HOLD_FREEZE_MESSAGE = 'Activate or drop your held player first.';

export class HoldFreezeError extends Error {
  readonly status = 409;
  constructor(message = HOLD_FREEZE_MESSAGE) {
    super(message);
    this.name = 'HoldFreezeError';
  }
}

export interface HeldEntry {
  id: string;
  playerId: string;
  heldAt: string;
  heldSource: 'loan_return' | 'loan_abroad_return' | 'retained_return' | 'auction';
}

export interface HoldState {
  holding: boolean;
  held: HeldEntry[];
  /** First kickoff of the gameweek the lineup locks at, or null if none is known yet. */
  lineupLockAt: string | null;
  lineupLocked: boolean;
}

export async function getHoldState(admin: SupabaseClient, teamId: string): Promise<HoldState> {
  const [{ data: rows, error }, { data: lockAt }] = await Promise.all([
    admin
      .from('roster_entries')
      .select('id, player_id, held_at, held_source')
      .eq('team_id', teamId)
      .eq('status', 'held')
      .order('held_at', { ascending: true }),
    admin.rpc('held_lineup_lock_at', { p_team_id: teamId }),
  ]);
  if (error) throw new Error(`Failed to load held players: ${error.message}`);

  const held: HeldEntry[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    playerId: r.player_id as string,
    heldAt: r.held_at as string,
    heldSource: r.held_source as HeldEntry['heldSource'],
  }));
  const lineupLockAt = held.length > 0 && typeof lockAt === 'string' ? lockAt : null;

  return {
    holding: held.length > 0,
    held,
    lineupLockAt,
    lineupLocked: lineupLockAt != null && new Date(lineupLockAt).getTime() <= Date.now(),
  };
}

/** Throws {@link HoldFreezeError} if the team holds anyone (R7). */
export async function assertNotHolding(admin: SupabaseClient, teamId: string): Promise<void> {
  const { count, error } = await admin
    .from('roster_entries')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'held');
  if (error) throw new Error(`Failed to check held players: ${error.message}`);
  if ((count ?? 0) > 0) throw new HoldFreezeError();
}

/**
 * How many squad places a trade gains for one side (R8). A held player going
 * out frees nothing, because he was never in the squad; an academy player going
 * out frees nothing either. Incoming players need places unless they arrive
 * into the academy, which the trade function decides under lock, so this
 * counts every incoming player as a place: it can only over-refuse, never let
 * a holding team grow.
 */
export function squadPlaceDelta(
  outgoingStatuses: readonly string[],
  incomingCount: number,
): number {
  const freed = outgoingStatuses.filter((s) => s !== 'held' && s !== 'taxi' && s !== 'ir' && s !== 'loan_in').length;
  return incomingCount - freed;
}

/**
 * R6: activation is closed while a gameweek is under way, from its first dated
 * kickoff until its last. Pure, so the boundary is testable without fixtures.
 */
export function gameweekInProgress(
  fixtures: { gameweek: number | null; kickoff_time: string | null }[],
  now: Date = new Date(),
): boolean {
  const spans = new Map<number, { first: number; last: number }>();
  for (const f of fixtures) {
    if (f.gameweek == null || !f.kickoff_time) continue;
    const t = new Date(f.kickoff_time).getTime();
    if (!Number.isFinite(t)) continue;
    const s = spans.get(f.gameweek);
    if (!s) spans.set(f.gameweek, { first: t, last: t });
    else {
      s.first = Math.min(s.first, t);
      s.last = Math.max(s.last, t);
    }
  }
  const n = now.getTime();
  for (const { first, last } of spans.values()) {
    if (first <= n && n < last) return true;
  }
  return false;
}

/** Loads the current season's fixtures and applies {@link gameweekInProgress}. */
export async function isGameweekInProgress(admin: SupabaseClient, now: Date = new Date()): Promise<boolean> {
  const season = await getCurrentFplSeason(undefined, true);
  const { data, error } = await admin
    .from('pl_fixtures')
    .select('gameweek, kickoff_time')
    .eq('season', season);
  // Fail closed: if the fixture list can't be read, don't allow a move the
  // rules forbid mid-gameweek.
  if (error) return true;
  return gameweekInProgress(data ?? [], now);
}
