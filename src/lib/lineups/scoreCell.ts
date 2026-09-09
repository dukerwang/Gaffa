/**
 * src/lib/lineups/scoreCell.ts
 *
 * What a player's figure says — decided once for every surface of the lineup
 * page: the pitch node, the bench card, the squad rail rows, and the ledger's
 * totals.
 *
 * They must never disagree about a player, and they did. The rail read
 * `scoreMap` straight, and the ledger summed it, while both are built for the
 * last COMPLETED gameweek — so mid-week the page showed last Saturday's points
 * in the rail and the ledger ("11 of 11 Played" in a round where nothing had
 * kicked off) beside next Saturday's projections on the pitch.
 *
 * The flip is per player and driven by his OWN club's kickoff, never by a
 * page-level toggle:
 *
 *   before his club kicks off   -> this round's projection
 *   kicked off, minutes > 0     -> what he actually scored
 *   kicked off, no minutes      -> DNP
 *   no projection, not started  -> a bare dash
 *
 * That kickoff test lives in `status` (see `playStatus`), which is why every
 * caller passes one rather than reaching for a score map on its own.
 */

/**
 * Pending (his club has not kicked off) vs DNP (it has, and he played nothing)
 * vs played.
 */
export type PlayStatus = 'pending' | 'played' | 'dnp';

export function playStatus(minutes: number | undefined, hasStarted: boolean): PlayStatus {
  if (!hasStarted) return 'pending';
  return Number(minutes ?? 0) > 0 ? 'played' : 'dnp';
}

export type ScoreCell =
  | { kind: 'scored'; value: number }
  | { kind: 'dnp' }
  | { kind: 'projected'; value: number }
  | { kind: 'pending' }
  | { kind: 'none' };

export function scoreCell(
  status: PlayStatus | undefined,
  points: number | undefined,
  projected: number | undefined,
): ScoreCell {
  if (status === 'dnp') return { kind: 'dnp' };
  if (status === 'played') return { kind: 'scored', value: points ?? 0 };
  /* No scoring context at all — the gameweek could not be resolved — but a
     score exists anyway. It is the only thing that can be vouched for, so it
     wins over a projection whose round we cannot check against. */
  if (status === undefined && points !== undefined) return { kind: 'scored', value: points };
  if (projected !== undefined) return { kind: 'projected', value: projected };
  if (status === 'pending') return { kind: 'pending' };
  return { kind: 'none' };
}
