import { describe, it, expect } from 'vitest';
import { serializeLineup, deserializeLineup, type SerializedLineup } from '../lineupSerializer';

describe('lineupSerializer', () => {
  it('serializes and deserializes a full lineup correctly', () => {
    const input: SerializedLineup = {
      formation: '4-2-1-3',
      title: 'Chelsea vs Hull',
      clubFilter: 'chelsea',
      playerIds: [
        'p1', 'p2', 'p3', 'p4', 'p5',
        'p6', 'p7', 'p8', 'p9', 'p10', 'p11',
      ],
    };

    const qs = serializeLineup(input);
    const parsed = deserializeLineup(new URLSearchParams(qs));

    expect(parsed.formation).toBe('4-2-1-3');
    expect(parsed.title).toBe('Chelsea vs Hull');
    expect(parsed.clubFilter).toBe('chelsea');
    expect(parsed.playerIds).toEqual(input.playerIds);
  });

  it('handles partial and empty lineups gracefully', () => {
    const input: SerializedLineup = {
      formation: '3-5-2',
      title: '',
      clubFilter: null,
      playerIds: ['p1', null, 'p3', null, null, null, null, null, null, null, null],
    };

    const qs = serializeLineup(input);
    const parsed = deserializeLineup(new URLSearchParams(qs));

    expect(parsed.formation).toBe('3-5-2');
    expect(parsed.title).toBe('');
    expect(parsed.clubFilter).toBeNull();
    expect(parsed.playerIds[0]).toBe('p1');
    expect(parsed.playerIds[1]).toBeNull();
    expect(parsed.playerIds[2]).toBe('p3');
    expect(parsed.playerIds[10]).toBeNull();
  });

  it('falls back to 4-3-3 for invalid formations', () => {
    const parsed = deserializeLineup(new URLSearchParams('f=invalid-formation'));
    expect(parsed.formation).toBe('4-3-3');
  });
});
