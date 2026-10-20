import { describe, expect, it } from 'vitest';
import type { GranularPosition } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import { fitFormation, type FitPlayer } from '../fitFormation';

const side = (...positions: (GranularPosition | [GranularPosition, GranularPosition[]])[]): FitPlayer[] =>
  positions.map((p, i) =>
    Array.isArray(p)
      ? { id: `p${i}`, primary_position: p[0], secondary_positions: p[1] }
      : { id: `p${i}`, primary_position: p, secondary_positions: [] },
  );

function placed(players: FitPlayer[]) {
  const fit = fitFormation(players);
  const slots = FORMATION_SLOTS[fit.formation] as GranularPosition[];
  const byId = new Map(players.map((p) => [p.id, p]));
  return {
    formation: fit.formation,
    rows: slots.map((slot, i) => [slot, byId.get(fit.playerIds[i] ?? '')?.primary_position ?? null]),
  };
}

describe('fitFormation', () => {
  it('reads a double pivot behind a number ten and two wingers as 4-2-1-3', () => {
    const r = placed(side('GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'DM', 'AM', 'LW', 'RW', 'ST'));
    expect(r.formation).toBe('4-2-1-3');
    expect(r.rows.every(([slot, pos]) => slot === pos)).toBe(true);
  });

  it('reads three centre-backs and wing-backs with two strikers as 3-5-2', () => {
    expect(placed(side('GK', 'CB', 'CB', 'CB', 'LWB', 'RWB', 'DM', 'CM', 'CM', 'ST', 'ST')).formation).toBe('3-5-2');
  });

  it('keeps the keeper in goal', () => {
    const r = placed(side('GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'RW', 'ST'));
    expect(r.rows[0]).toEqual(['GK', 'GK']);
  });

  it('uses a secondary listing to place a player', () => {
    // An AM who also plays LW, beside a natural RW and ST, takes the left wing.
    const r = placed(side('GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', ['AM', ['LW']], 'RW', 'ST'));
    expect(r.formation).toBe('4-3-3');
    expect(r.rows.find(([slot]) => slot === 'LW')?.[1]).toBe('AM');
  });

  it('leaves slots empty when fewer than eleven are known', () => {
    const fit = fitFormation(side('GK', 'CB', 'CB', 'ST'));
    expect(fit.playerIds.filter(Boolean)).toHaveLength(4);
    expect(fit.playerIds).toHaveLength(11);
  });
});
