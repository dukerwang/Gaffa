/**
 * src/lib/roster/capacity.ts
 *
 * The one derivation of "how full is this roster".
 *
 * The rule was previously inlined at seven call sites and had drifted apart at
 * three of them, so the app could tell a manager the roster was full while the
 * route that actually enforces the limit would have accepted the move:
 *
 *   - `auctions/route.ts` counted loaned-IN players toward the cap (everywhere
 *     else excludes them) and left out the buyback allowance entirely, so a
 *     manager with a player out on loan saw "roster full" on the auction list
 *     and a successful bid on the same lot.
 *   - `teams/[teamId]/taxi/route.ts` left out the buyback allowance too, so
 *     promoting from the academy failed a check that bidding passed.
 *   - Only `trades/[tradeId]/route.ts` knew about the floor of 15, as a bare
 *     literal, and nothing showed it to the manager before a trade was refused.
 *
 * Read this module rather than recomputing any of it. If the rule changes it
 * changes here, and `docs/USER_GUIDE.md` needs the same edit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RosterStatus } from '@/types';

/**
 * The statuses that do NOT occupy an active roster slot.
 *
 * Injured reserve, the academy and loaned-in players are each capped
 * separately (`leagues.ir_size`, `leagues.taxi_size`, and the 2-in loan cap),
 * so counting them here would charge a manager twice for the same player.
 * `loan_out` never appears on the lender's roster — the entry moves to the
 * borrower — so it is absent by construction rather than excluded.
 */
export const UNCOUNTED_ROSTER_STATUSES: readonly RosterStatus[] = ['ir', 'taxi', 'loan_in'];

/**
 * The smallest legal active roster. Enforced on trades, which are the only
 * move that can shrink a roster below it in one step; drops go one at a time
 * and a manager can always drop down to nothing if they insist.
 */
export const MIN_ACTIVE_ROSTER = 15;

export const DEFAULT_ROSTER_SIZE = 20;

export interface RosterCapacity {
  /** Players occupying a slot right now: everything but IR, academy and loan-ins. */
  active: number;
  /** `leagues.roster_size` plus one slot per loan-out that paid the buyback fee. */
  limit: number;
  /** The league's configured size, before the buyback allowance. */
  baseLimit: number;
  /** Extra slots held open by active loan-outs that used their buyback. */
  buybackSlots: number;
  /** Slots still open. Never negative — an over-cap roster reports 0. */
  open: number;
  /** No slots left; a new arrival needs a drop in the same move. */
  isFull: boolean;
  /** Over the limit, which a buyback expiring or a loan returning can cause. */
  isOver: boolean;
  /** Cannot give up another player in a trade. */
  atFloor: boolean;
  /** The floor, so a surface can show it without importing the constant. */
  floor: number;
  ir: number;
  irLimit: number;
  academy: number;
  academyLimit: number;
  loanedIn: number;
}

export interface RosterCapacityInput {
  statuses: RosterStatus[];
  rosterSize: number | null | undefined;
  irSize?: number | null;
  taxiSize?: number | null;
  buybackSlots?: number | null;
}

/**
 * Pure derivation, so the panel, the routes and the tests all agree without a
 * round trip. Pass every roster entry's status, including the uncounted ones.
 */
export function deriveRosterCapacity({
  statuses,
  rosterSize,
  irSize,
  taxiSize,
  buybackSlots,
}: RosterCapacityInput): RosterCapacity {
  const count = (s: RosterStatus) => statuses.filter((x) => x === s).length;

  const active = statuses.filter((s) => !UNCOUNTED_ROSTER_STATUSES.includes(s)).length;
  const baseLimit = rosterSize ?? DEFAULT_ROSTER_SIZE;
  const extra = buybackSlots ?? 0;
  const limit = baseLimit + extra;

  return {
    active,
    limit,
    baseLimit,
    buybackSlots: extra,
    open: Math.max(0, limit - active),
    isFull: active >= limit,
    isOver: active > limit,
    atFloor: active <= MIN_ACTIVE_ROSTER,
    floor: MIN_ACTIVE_ROSTER,
    ir: count('ir'),
    irLimit: irSize ?? 2,
    academy: count('taxi'),
    academyLimit: taxiSize ?? 3,
    loanedIn: count('loan_in'),
  };
}

/**
 * Counts the loan-outs currently holding a roster slot open for this team.
 *
 * A manager who loans a player out may pay the buyback fee to keep the slot,
 * which is why the cap is not simply `roster_size`.
 */
export async function countBuybackSlots(
  admin: SupabaseClient,
  teamId: string,
): Promise<number> {
  const { count } = await admin
    .from('player_loans')
    .select('id', { count: 'exact', head: true })
    .eq('lender_team_id', teamId)
    .eq('status', 'active')
    .eq('slot_buyback_used', true);

  return count ?? 0;
}

/**
 * Loads everything the derivation needs for one team. Two queries plus the
 * league row the caller usually already holds — pass `league` to skip it.
 */
export async function loadRosterCapacity(
  admin: SupabaseClient,
  teamId: string,
  league?: { id?: string; roster_size?: number | null; ir_size?: number | null; taxi_size?: number | null } | null,
  leagueId?: string,
): Promise<RosterCapacity> {
  let settings = league ?? null;

  if (!settings && leagueId) {
    const { data } = await admin
      .from('leagues')
      .select('roster_size, ir_size, taxi_size')
      .eq('id', leagueId)
      .single();
    settings = data;
  }

  const [{ data: entries }, buybackSlots] = await Promise.all([
    admin.from('roster_entries').select('status').eq('team_id', teamId),
    countBuybackSlots(admin, teamId),
  ]);

  return deriveRosterCapacity({
    statuses: ((entries ?? []) as { status: RosterStatus }[]).map((e) => e.status),
    rosterSize: settings?.roster_size,
    irSize: settings?.ir_size,
    taxiSize: settings?.taxi_size,
    buybackSlots,
  });
}
