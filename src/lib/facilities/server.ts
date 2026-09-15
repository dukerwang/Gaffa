/**
 * Server-side reads of a club's facility slots. Goes through the same SQL
 * functions the RPCs enforce with (migration 166), so a route can never admit
 * a move the database would then refuse.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** A club's Loans Out capacity, falling back to the league setting if the lookup fails. */
export async function loadLoanOutSlots(
  admin: SupabaseClient,
  teamId: string,
  leagueDefault: number | null | undefined,
): Promise<number> {
  try {
    const { data, error } = await admin.rpc('team_loan_out_slots', { p_team_id: teamId });
    if (!error && typeof data === 'number') return data;
  } catch {
    /* fall through to the league setting */
  }
  return leagueDefault ?? 1;
}
