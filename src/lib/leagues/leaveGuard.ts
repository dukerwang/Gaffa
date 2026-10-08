/**
 * What leaving a league does, by league status.
 *
 * Before the draft (`setup`), leaving and deleting are hard deletes: nothing
 * has been played, so nothing is lost. Deleting a league cascades to every
 * table keyed on it; deleting a team cascades to its roster, matchups,
 * transactions, trades, loans, merit payments and every season archive row
 * that names it.
 *
 * Once the draft starts that data is published history. A manager who leaves
 * then hands the club to the Caretaker (`hand_club_to_caretaker_rpc`, migration
 * 169) instead of deleting it, and the league itself can't be deleted from the
 * app. A commissioner has to hand the role to another manager before leaving.
 */

export const LEAVABLE_LEAGUE_STATUS = 'setup';

/** True while leaving still deletes the club outright (and the league, for a commissioner). */
export function canLeaveLeague(status: string | null | undefined): boolean {
  return status === LEAVABLE_LEAGUE_STATUS;
}

export const DELETE_BLOCKED_MESSAGE =
  "You can't delete a league once its draft has started.";

export const COMMISSIONER_LEAVE_BLOCKED_MESSAGE =
  'Hand the commissioner role to another manager before you leave the league.';
