import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Caretaker clubs: a club whose manager has left, or been removed by the
 * commissioner, after the league's draft. The club keeps its squad, Club
 * Balance, record and fixtures; the Caretaker runs it until a new manager
 * joins. A Caretaker club is a team with no manager (`user_id IS NULL`).
 *
 * The Caretaker never trades, loans, lists or bids, so other managers can't
 * deal with the club either: nobody can take advantage of a club with no
 * human in charge. Spec: docs/superpowers/specs/2026-10-04-expansion-and-takeovers-design.md
 */

export const CARETAKER_NAME = 'Caretaker';

export const CARETAKER_DEAL_MESSAGE =
  "This club is run by the Caretaker until a new manager joins, so it can't make deals.";

export function isCaretakerClub(team: { user_id: string | null } | null | undefined): boolean {
  return !!team && team.user_id == null;
}

export interface HandoffResult {
  already_caretaker: boolean;
  former_user_id?: string;
  withdrawn_bids?: unknown[];
  cancelled_trades?: number;
  cancelled_loans?: number;
  cancelled_listings?: number;
}

/**
 * Hands a club to the Caretaker: removes its manager, withdraws their live
 * bids and cancels proposals and unbid listings they had open. Agreed deals
 * deferred to the end of the gameweek still go through. Atomic in SQL.
 */
export async function handClubToCaretaker(admin: SupabaseClient, teamId: string): Promise<HandoffResult> {
  const { data, error } = await admin.rpc('hand_club_to_caretaker_rpc', { p_team_id: teamId });
  if (error) throw error;
  return data as HandoffResult;
}

/**
 * Assigns the league's longest-waiting Caretaker club to a joining manager.
 * Returns the club's id, or null when the league has none.
 */
export async function claimCaretakerClub(
  admin: SupabaseClient,
  leagueId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc('claim_caretaker_club_rpc', { p_league_id: leagueId, p_user_id: userId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Whether either club in a proposed deal is run by the Caretaker. */
export async function dealInvolvesCaretaker(admin: SupabaseClient, teamIds: string[]): Promise<boolean> {
  const ids = teamIds.filter(Boolean);
  if (ids.length === 0) return false;
  const { data, error } = await admin.from('teams').select('id, user_id').in('id', ids);
  if (error) throw error;
  return (data ?? []).some((t) => t.user_id == null);
}
