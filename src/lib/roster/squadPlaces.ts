/**
 * Pure squad-place arithmetic for held players, safe to import from client
 * components (holds.ts pulls in server-side season resolution).
 */

/**
 * How many squad places a trade gains for one side (R8). A held player going
 * out frees nothing, because he was never in the squad; an academy player going
 * out frees nothing either. Incoming players need places unless they arrive
 * into the academy, which the trade function decides under lock, so this
 * counts every incoming player as a place: it can only over-refuse, never let
 * a holding team grow.
 */
export function squadPlaceDelta(
  outgoingStatuses: readonly string[],
  incomingCount: number,
): number {
  const freed = outgoingStatuses.filter((s) => s !== 'held' && s !== 'taxi' && s !== 'ir' && s !== 'loan_in').length;
  return incomingCount - freed;
}
