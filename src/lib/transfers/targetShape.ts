/**
 * What a target's fields may hold, in one place.
 *
 * The position whitelist and the audience parser each lived in several files
 * (both routes, `matchTargets`, `answerTarget`), so a change had to be made in
 * all of them. They are here once.
 */

import { POSITION_FLEX_MAP, type GranularPosition, type TargetVisibility } from '@/types';

const POSITIONS = new Set(Object.keys(POSITION_FLEX_MAP));

/** One of the 12 tactical positions. */
export function isTargetPosition(value: unknown): value is GranularPosition {
  return typeof value === 'string' && POSITIONS.has(value);
}

const VISIBILITIES: readonly TargetVisibility[] = ['public', 'direct', 'private'];

/**
 * The audience a request names.
 *
 * Omitted means the documented default, public. A value that is present but
 * not one of the three returns null, so a typo is refused rather than quietly
 * broadcasting a target its author meant to keep private.
 */
export function parseVisibility(raw: unknown): TargetVisibility | null {
  if (raw === undefined || raw === null) return 'public';
  return typeof raw === 'string' && (VISIBILITIES as readonly string[]).includes(raw)
    ? (raw as TargetVisibility)
    : null;
}
