/**
 * Whether a league can still be left (member) or deleted (commissioner).
 *
 * Both actions are hard deletes. Deleting a league cascades to every table
 * keyed on it; deleting a team cascades to its roster, matchups, transactions,
 * trades, loans, merit payments and every season archive row that names it.
 * Once the draft starts that data is published history, so only a league that
 * is still in `setup` may be left or deleted.
 *
 * Handing a club on after the draft is a separate flow (Caretaker takeovers),
 * not a relaxation of this guard.
 */

export const LEAVABLE_LEAGUE_STATUS = 'setup';

export function canLeaveLeague(status: string | null | undefined): boolean {
  return status === LEAVABLE_LEAGUE_STATUS;
}

export const LEAVE_BLOCKED_MESSAGE =
  "You can't leave a league once its draft has started. Talk to your commissioner if you need to step away.";

export const DELETE_BLOCKED_MESSAGE =
  "You can't delete a league once its draft has started.";
