/**
 * Can THIS club answer that target?
 *
 * `matchTargets` asks the same question from the other end — a player becomes
 * available, who wanted him — and runs server-side at write time. This one
 * runs on the board, where a manager is reading other clubs' demands and the
 * only question that matters is "is any of this about me?".
 *
 * It exists as one function because the board's sections and the board's
 * buttons both depend on the answer, and an earlier draft applied the rule by
 * hand in two places and immediately disagreed with itself: a row sat under
 * "Wanted From You" with nothing to press. A row is in that section BECAUSE
 * this returns true, and carries actions for the same reason. There is no
 * second copy of the rule to drift.
 *
 * The position half deliberately mirrors `matchTargets`: secondary positions
 * count, because a centre-back who also plays left-back is exactly the player
 * a left-back profile is hoping to shake loose.
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
 * Empty for my own targets. A club cannot answer itself, and showing a
 * manager an "Offer" button pointed at his own advertisement is the kind of
 * thing that makes a board look like it isn't reading its own data.
 */
export function playersAnswering<T extends AnswerablePlayer>(
  target: AnswerableTarget,
  myTeamId: string,
  squad: readonly T[],
): T[] {
  if (target.team_id === myTeamId) return [];

  // Out on loan is out of reach: the borrower has him, and the lender cannot
  // offer him on again while that stands. Academy and injured players stay in
  // — both are tradeable, they just aren't playing.
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
