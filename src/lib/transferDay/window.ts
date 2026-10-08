import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Transfer Day: how redraft leagues settle free-agent auctions (migration 174).
 *
 * Managers bid openly all week, and every lot settles together on Transfer Day,
 * 24 hours before the gameweek's first kickoff (the midpoint between gameweeks
 * when that would land before the previous gameweek has finished). After it,
 * until each player's own club kicks off, an unclaimed free agent can be signed
 * instantly for nothing. The schedule lives in SQL (`transfer_day_schedule`) so
 * the bid route, drops and the auction resolver all close on the same moment.
 */
export interface TransferDayWindow {
  /** When a bid placed now settles. Null once the season has no Transfer Day left. */
  nextSettleAt: string | null;
  /** The most recent Transfer Day. */
  lastSettleAt: string | null;
  /** Instant signings are open: the last Transfer Day has passed and its gameweek isn't over. */
  instantOpen: boolean;
  /** The gameweek instant signings are for, when open. */
  instantGameweek: number | null;
}

export async function getTransferDayWindow(admin: SupabaseClient, at: Date = new Date()): Promise<TransferDayWindow> {
  const { data, error } = await admin.rpc('transfer_day_window', { p_at: at.toISOString() });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { next_settle_at: string | null; last_settle_at: string | null; instant_open: boolean; instant_gameweek: number | null }
    | null;
  return {
    nextSettleAt: row?.next_settle_at ?? null,
    lastSettleAt: row?.last_settle_at ?? null,
    instantOpen: !!row?.instant_open,
    instantGameweek: row?.instant_gameweek ?? null,
  };
}

export const NO_TRANSFER_DAY_LEFT = "There's no Transfer Day left this season.";
