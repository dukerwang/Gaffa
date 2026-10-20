import type { Formation, GranularPosition } from '@/types';
import { FORMATION_SLOTS } from '@/types';

/**
 * The rows a formation's slots are drawn in, front to back. FORMATION_SLOTS
 * lists slots left to right within each row, so a slot's place in its row is
 * its side of the pitch. The share card draws by these rows and fitFormation
 * reads sides from them, so the two always agree.
 */
export type PitchZone = 'ATT' | 'AMZ' | 'CMZ' | 'DMZ' | 'WBZ' | 'DEF' | 'GK';
export const ZONE_ORDER: PitchZone[] = ['ATT', 'AMZ', 'CMZ', 'DMZ', 'WBZ', 'DEF', 'GK'];

export function getZone(pos: GranularPosition, formation: Formation): PitchZone {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'DM') return 'DMZ';
  if (pos === 'AM') return 'AMZ';
  if (pos === 'LWB' || pos === 'RWB') return formation.startsWith('3-') ? 'CMZ' : 'WBZ';
  if (pos === 'CM') return 'CMZ';
  return 'ATT';
}

/** Each slot's side of the pitch, -1 (left touchline) to 1 (right), by its place in its row. */
export function slotSides(formation: Formation): number[] {
  const slots = FORMATION_SLOTS[formation] as GranularPosition[];
  const rows = new Map<PitchZone, number[]>();
  slots.forEach((pos, i) => {
    const z = getZone(pos, formation);
    rows.set(z, [...(rows.get(z) ?? []), i]);
  });
  const sides = Array<number>(slots.length).fill(0);
  for (const idx of rows.values()) {
    idx.forEach((slot, j) => (sides[slot] = idx.length === 1 ? 0 : -1 + (2 * j) / (idx.length - 1)));
  }
  return sides;
}
