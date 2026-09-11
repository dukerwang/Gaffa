/**
 * Can THIS club answer that target?
 *
 * `matchTargets` asks the same question from the other end — somebody becomes
 * available, who wanted him — and runs server-side at write time. Call this
 * one on the board, where a manager reads other clubs' demands and cares about
 * exactly one thing: is any of this about me?
 *
 * Keep it as ONE function. The board's sections and the board's buttons both
 * turn on the answer, and an earlier draft applied the rule by hand in two
 * places and promptly contradicted itself, filing a row under "Wanted From
 * You" with nothing to press. File a row in that section because this returns
 * true, and give it actions for the same reason. Never write a second copy of
 * the rule.
 *
 * Mirror `matchTargets` on positions: count the secondary ones, because a
 * centre-back who also plays left-back is exactly the player somebody hunting
 * a left-back hopes to shake loose.
 */

import { POSITION_FLEX_MAP } from '@/types';

/** The 12 tactical positions, derived from the flex map so the two can't drift. */
const VALID_POSITIONS = new Set(Object.keys(POSITION_FLEX_MAP));

/** The little this needs to know about one of my players. */
export interface AnswerablePlayer {
  id: string;
  primary_position?: string | null;
  secondary_positions?: string[] | null;
  /** `roster_entries.status`. A player already out on loan isn't mine to give. */
  status?: string | null;
}

/** The little this needs to know about a target. */
export interface AnswerableTarget {
  team_id: string;
  target_kind: 'player' | 'profile';
  player_id: string | null;
  position: string | null;
}

/**
 * Which of my players answer this target — the named man, or everyone who
 * plays the position asked for.
 *
 * Empty for my own targets. You cannot answer yourself, and pointing a
 * manager at an "Offer" button aimed at his own advertisement makes the whole
 * page look like nobody checked it.
 */
export function playersAnswering<T extends AnswerablePlayer>(
  target: AnswerableTarget,
  myTeamId: string,
  squad: readonly T[],
): T[] {
  if (target.team_id === myTeamId) return [];

  // Out on loan is out of reach: the borrower has him, and the lender cannot
  // offer him on again while that stands. Keep academy and injured players —
  // you can trade either, they just aren't playing.
  const available = squad.filter((p) => p.status !== 'loan_out');

  if (target.target_kind === 'player') {
    return target.player_id ? available.filter((p) => p.id === target.player_id) : [];
  }

  const wanted = target.position;
  if (!wanted || !VALID_POSITIONS.has(wanted)) return [];

  return available.filter((p) => {
    if (p.primary_position === wanted) return true;
    return (p.secondary_positions ?? []).includes(wanted);
  });
}

/** Whether the board should file this target under "Wanted From You". */
export function canAnswerTarget(
  target: AnswerableTarget,
  myTeamId: string,
  squad: readonly AnswerablePlayer[],
): boolean {
  return playersAnswering(target, myTeamId, squad).length > 0;
}
