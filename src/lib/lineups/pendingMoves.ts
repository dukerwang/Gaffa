/**
 * Academy, IR and squad moves the lineup page has made but the server page
 * hasn't re-rendered yet.
 *
 * The taxi and IR routes write the new status at once, but `router.refresh()`
 * re-runs the whole server page, which takes seconds. The page can't be
 * reloaded to catch up either, because an unsaved lineup would be lost. So the
 * page keeps each confirmed move here and lays it over the server entries.
 */
import type { RosterCapacity } from '@/lib/roster/capacity';
import type { RosterStatus } from '@/types';

export type Tier = 'bench' | 'taxi' | 'ir';
export type PendingMoves = Record<string, Tier>;

interface TierEntry {
  status: RosterStatus;
  player: { id: string };
}

export interface TierLists<E> {
  /** Active and bench players: the lineup pool. */
  squad: E[];
  taxi: E[];
  ir: E[];
}

function serverTier(e: TierEntry): Tier {
  return e.status === 'taxi' || e.status === 'ir' ? e.status : 'bench';
}

/** The three lists as they stand after the pending moves. */
export function applyPendingMoves<E extends TierEntry>(server: TierLists<E>, moves: PendingMoves): TierLists<E> {
  const everyone = [...server.squad, ...server.taxi, ...server.ir];
  const tierOf = (e: E) => moves[e.player.id] ?? serverTier(e);
  const listFor = (tier: Tier) =>
    everyone
      .filter((e) => tierOf(e) === tier)
      .map((e) => (serverTier(e) === tier ? e : { ...e, status: tier }));
  return { squad: listFor('bench'), taxi: listFor('taxi'), ir: listFor('ir') };
}

/**
 * Drops the moves the server entries now agree with. A refresh that started
 * before a later move must not undo that move, so this never clears the rest.
 * Returns `moves` itself when nothing settled.
 */
export function pruneSettledMoves<E extends TierEntry>(server: TierLists<E>, moves: PendingMoves): PendingMoves {
  const current = new Map<string, Tier>();
  for (const e of [...server.squad, ...server.taxi, ...server.ir]) current.set(e.player.id, serverTier(e));
  const pending = Object.entries(moves).filter(([pid, tier]) => current.get(pid) !== tier);
  return pending.length === Object.keys(moves).length ? moves : Object.fromEntries(pending);
}

/** The server's counts moved by the same amounts, plus any slot just bought. */
export function adjustCapacity<E extends TierEntry>(
  capacity: RosterCapacity,
  server: TierLists<E>,
  shown: TierLists<E>,
  bought: { academy?: number; ir?: number } = {},
): RosterCapacity {
  const active = capacity.active + (shown.squad.length - server.squad.length);
  return {
    ...capacity,
    active,
    academy: capacity.academy + (shown.taxi.length - server.taxi.length),
    academyLimit: Math.max(capacity.academyLimit, bought.academy ?? 0),
    ir: capacity.ir + (shown.ir.length - server.ir.length),
    irLimit: Math.max(capacity.irLimit, bought.ir ?? 0),
    open: Math.max(0, capacity.limit - active),
    isFull: active >= capacity.limit,
    isOver: active > capacity.limit,
    atFloor: active <= capacity.floor,
  };
}
