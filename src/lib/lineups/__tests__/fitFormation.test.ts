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

  describe('left and right within a pair', () => {
    const pairOf = (slot: GranularPosition, fit: ReturnType<typeof fitFormation>) =>
      (FORMATION_SLOTS[fit.formation] as GranularPosition[])
        .map((s, i) => (s === slot ? fit.playerIds[i] : null))
        .filter(Boolean);

    it('puts the left-footed centre-back on the left', () => {
      const xi: FitPlayer[] = [
        { id: 'gk', primary_position: 'GK' },
        { id: 'lb', primary_position: 'LB' },
        { id: 'lacroix', primary_position: 'CB', preferred_foot: 'right' },
        { id: 'colwill', primary_position: 'CB', preferred_foot: 'left' },
        { id: 'rb', primary_position: 'RB' },
        { id: 'dm1', primary_position: 'DM' },
        { id: 'dm2', primary_position: 'DM' },
        { id: 'am', primary_position: 'AM' },
        { id: 'lw', primary_position: 'LW' },
        { id: 'rw', primary_position: 'RW' },
        { id: 'st', primary_position: 'ST' },
      ];
      expect(pairOf('CB', fitFormation(xi))).toEqual(['colwill', 'lacroix']);
    });

    it('sides two attacking midfielders by their wide listings, whatever their foot', () => {
      // Palmer is left-footed and lists RW; Rogers lists LW.
      const xi: FitPlayer[] = [
        { id: 'gk', primary_position: 'GK' },
        { id: 'cb1', primary_position: 'CB' },
        { id: 'cb2', primary_position: 'CB' },
        { id: 'cb3', primary_position: 'CB' },
        { id: 'lwb', primary_position: 'LWB' },
        { id: 'cm1', primary_position: 'CM' },
        { id: 'cm2', primary_position: 'CM' },
        { id: 'rwb', primary_position: 'RWB' },
        { id: 'palmer', primary_position: 'AM', secondary_positions: ['RW', 'CM'], preferred_foot: 'left' },
        { id: 'rogers', primary_position: 'AM', secondary_positions: ['LW', 'CM'], preferred_foot: 'right' },
        { id: 'st', primary_position: 'ST' },
      ];
      const fit = fitFormation(xi);
      expect(fit.formation).toBe('3-4-2-1');
      expect(pairOf('AM', fit)).toEqual(['rogers', 'palmer']);
    });
  });

  it('follows where the match feed says they stood', () => {
    // Chelsea at Brentford: three right-footed-or-unknown centre-backs the listings
    // cannot side; the feed has Colwill left, Lacroix centre, Fofana right.
    const xi: FitPlayer[] = [
      { id: 'martinez', primary_position: 'GK' },
      { id: 'fofana', primary_position: 'CB', preferred_foot: 'right' },
      { id: 'lacroix', primary_position: 'CB', preferred_foot: 'right' },
      { id: 'colwill', primary_position: 'CB', preferred_foot: 'left' },
      { id: 'chavarria', primary_position: 'LWB' },
      { id: 'barco', primary_position: 'CM' },
      { id: 'henderson', primary_position: 'DM', secondary_positions: ['CM'] },
      { id: 'neto', primary_position: 'RW', secondary_positions: ['LW', 'RWB', 'LWB'] },
      { id: 'rogers', primary_position: 'AM', secondary_positions: ['LW', 'CM'] },
      { id: 'palmer', primary_position: 'AM', secondary_positions: ['RW', 'CM'] },
      { id: 'welbeck', primary_position: 'ST' },
    ];
    const layout = {
      formation: '3-4-2-1',
      lines: [['martinez'], ['colwill', 'lacroix', 'fofana'], ['chavarria', 'barco', 'henderson', 'neto'], ['rogers', 'palmer'], ['welbeck']],
    };
    const fit = fitFormation(xi, layout);
    expect(fit.formation).toBe('3-4-2-1');
    const slots = FORMATION_SLOTS['3-4-2-1'] as GranularPosition[];
    const at = (pos: GranularPosition) => slots.map((s, i) => (s === pos ? fit.playerIds[i] : null)).filter(Boolean);
    expect(at('CB')).toEqual(['colwill', 'lacroix', 'fofana']);
    expect(at('CM')).toEqual(['barco', 'henderson']);
    expect(at('RWB')).toEqual(['neto']);
    expect(at('AM')).toEqual(['rogers', 'palmer']);
  });

  it('leaves slots empty when fewer than eleven are known', () => {
    const fit = fitFormation(side('GK', 'CB', 'CB', 'ST'));
    expect(fit.playerIds.filter(Boolean)).toHaveLength(4);
    expect(fit.playerIds).toHaveLength(11);
  });
});
