import { describe, expect, it } from 'vitest';
import { fillLineupGaps, type GapFillCandidate } from '../fillLineupGaps';
import type { GranularPosition, MatchupLineup } from '@/types';

const SLOTS: GranularPosition[] = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'DM', 'CM', 'LW', 'ST', 'RW'];

function saved(): MatchupLineup {
  return {
    formation: '4-3-3',
    starters: SLOTS.map((slot, i) => ({ slot, player_id: `s${i}` })),
    bench: [
      { slot: 'DEF', player_id: 'bDEF' },
      { slot: 'MID', player_id: 'bMID' },
      { slot: 'ATT', player_id: 'bATT' },
      { slot: 'FLEX', player_id: 'bFLEX' },
    ],
  };
}

function squad(): GapFillCandidate[] {
  return [
    ...SLOTS.map((p, i) => ({ id: `s${i}`, positions: [p], score: 5 })),
    { id: 'bDEF', positions: ['CB'] as GranularPosition[], score: 3 },
    { id: 'bMID', positions: ['CM'] as GranularPosition[], score: 3 },
    { id: 'bATT', positions: ['ST'] as GranularPosition[], score: 3 },
    { id: 'bFLEX', positions: ['DM'] as GranularPosition[], score: 3 },
    { id: 'spareST', positions: ['ST'] as GranularPosition[], score: 9 },
    { id: 'spareCB', positions: ['CB'] as GranularPosition[], score: 1 },
  ];
}

describe('fillLineupGaps (held players R13)', () => {
  it('leaves a lineup with no broken picks untouched', () => {
    const out = fillLineupGaps(saved(), squad());
    expect(out?.filled).toBe(0);
    expect(out?.lineup).toEqual(saved());
  });

  it('fills only the slot of a starter who left, with the best eligible player', () => {
    const pool = squad().filter((c) => c.id !== 's9'); // the ST was dropped
    const out = fillLineupGaps(saved(), pool)!;
    expect(out.filled).toBe(1);
    expect(out.lineup.starters[9]).toEqual({ slot: 'ST', player_id: 'spareST' });
    expect(out.lineup.starters.filter((s, i) => i !== 9)).toEqual(saved().starters.filter((_, i) => i !== 9));
    expect(out.lineup.bench).toEqual(saved().bench);
  });

  it('replaces a starter who is no longer eligible for his slot', () => {
    const pool = squad().map((c) => (c.id === 's2' ? { ...c, positions: ['DM'] as GranularPosition[] } : c));
    const out = fillLineupGaps(saved(), pool)!;
    expect(out.lineup.starters[2].player_id).toBe('spareCB');
  });

  it('never moves a bench player out of his bench category to fill a gap', () => {
    const pool = squad().filter((c) => c.id !== 'bDEF' && c.id !== 'spareCB');
    // No spare defender: the DEF bench slot can't be filled.
    expect(fillLineupGaps(saved(), pool)).toBeNull();
  });
});
