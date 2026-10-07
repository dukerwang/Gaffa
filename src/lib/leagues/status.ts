/**
 * League lifecycle statuses that mean the same thing to most of the app.
 *
 * `setup` is a brand-new league before its first draft. `pre_draft` is a
 * redraft league between seasons: the reset has archived last season and
 * cleared every squad, and the next draft hasn't started. Both wait for a
 * draft, show the lobby, and can start or schedule one.
 *
 * They differ where history matters. A `setup` league has none, so leaving
 * still deletes the club; a `pre_draft` league has seasons of results, so
 * leaving hands the club to the Caretaker (see leaveGuard.ts).
 */

export type LeagueStatus = 'setup' | 'drafting' | 'active' | 'completed' | 'offseason' | 'pre_draft';

export const PRE_DRAFT_STATUSES = ['setup', 'pre_draft'] as const;

/** Waiting for a draft to start: the lobby shows and a draft can be started or scheduled. */
export function isAwaitingDraft(status: string | null | undefined): boolean {
  return status === 'setup' || status === 'pre_draft';
}

/**
 * Whether a newcomer joins with a brand-new club. Before a league's first draft,
 * always. Between redraft seasons too, because every club starts the next draft
 * with an empty squad, and the schedule is only built when that draft finishes.
 */
export function canJoinWithNewClub(league: { status: string | null | undefined; is_dynasty?: boolean | null }): boolean {
  return league.status === 'setup' || (league.status === 'pre_draft' && league.is_dynasty === false);
}

/** Free-agent bids only make sense once squads exist and before the season closes. */
export function canBidInStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'offseason';
}
