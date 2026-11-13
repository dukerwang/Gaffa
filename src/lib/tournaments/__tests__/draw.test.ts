import { describe, it, expect } from 'vitest';
import { pairDraw, consolationFeeds, decideTie, type Entrant } from '../draw';

/** A small LCG so every draw in these tests is reproducible. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const club = (teamId: string, rank: number): Entrant => ({ teamId, rank });
const rankOf = (es: Entrant[]) => new Map(es.map((e) => [e.teamId, e.rank]));

describe('pairDraw', () => {
  const four = [club('chelsz', 1), club('hayden', 5), club('xabi', 4), club('pizza', 2)];

  it('draws every entrant exactly once', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const ties = pairDraw(four, 2, seeded(seed));
      const ids = ties.flatMap((t) => [t.a, t.b]).filter(Boolean).sort();
      expect(ids).toEqual(['chelsz', 'hayden', 'pizza', 'xabi']);
    }
  });

  it('puts the higher-placed club in the first slot of every tie', () => {
    const ranks = rankOf(four);
    for (let seed = 1; seed <= 50; seed++) {
      for (const t of pairDraw(four, 2, seeded(seed))) {
        expect(ranks.get(t.a)!).toBeLessThan(ranks.get(t.b!)!);
      }
    }
  });

  it('gives no byes when the round is full', () => {
    expect(pairDraw(four, 2, seeded(7)).every((t) => t.b !== null)).toBe(true);
  });

  it('gives the bye to the best-placed club when the round is short', () => {
    const three = [club('a', 6), club('b', 2), club('c', 4)];
    for (let seed = 1; seed <= 20; seed++) {
      const ties = pairDraw(three, 2, seeded(seed));
      expect(ties.find((t) => t.b === null)).toEqual({ a: 'b', b: null });
      expect(ties.find((t) => t.b !== null)).toEqual({ a: 'c', b: 'a' });
    }
  });

  it('pairs two clubs into one tie, the better-placed first', () => {
    expect(pairDraw([club('low', 5), club('high', 3)], 1, seeded(3))).toEqual([{ a: 'high', b: 'low' }]);
  });

  it('refuses a draw that cannot fill the round', () => {
    expect(() => pairDraw([club('a', 1), club('b', 2), club('c', 3)], 1, seeded(1))).toThrow();
    expect(() => pairDraw([club('a', 1)], 2, seeded(1))).toThrow();
  });

  it('is actually random across seeds', () => {
    const pairings = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const key = pairDraw(four, 2, seeded(seed))
        .map((t) => [t.a, t.b].join('-'))
        .sort()
        .join('|');
      pairings.add(key);
    }
    // Four clubs into two ties has three possible pairings.
    expect(pairings.size).toBe(3);
  });
});

describe('consolationFeeds', () => {
  it.each([
    [6, 'Quarter-Final', true],
    [6, 'Semi-Final', true],
    [6, 'Final', false],
    [5, 'Quarter-Final', true],
    [5, 'Semi-Final', true],
    [4, 'Quarter-Final', false],
    [4, 'Semi-Final', true],
    [7, 'Quarter-Final', false],
    [7, 'Semi-Final', false],
    [10, 'Semi-Final', false],
  ])('%i clubs, %s → %s', (clubs, round, expected) => {
    expect(consolationFeeds(clubs, round)).toBe(expected);
  });
});

describe('decideTie', () => {
  const base = { teamA: 'A', teamB: 'B', playersA: [], playersB: [] };

  it('goes to the higher total', () => {
    expect(decideTie({ ...base, totalA: 50.2, totalB: 61 })).toEqual({ winnerId: 'B', decidedBy: 'score' });
  });

  it('goes to the best individual performer when the totals are level', () => {
    expect(
      decideTie({
        ...base,
        totalA: 40,
        totalB: 40,
        playersA: [{ playerId: 'saka', points: 14.2 }],
        playersB: [{ playerId: 'palmer', points: 11.8 }],
      }),
    ).toEqual({ winnerId: 'A', decidedBy: 'best_performer' });
  });

  it('goes to team_a on position at 0–0', () => {
    expect(decideTie({ ...base, totalA: 0, totalB: 0 })).toEqual({ winnerId: 'A', decidedBy: 'position' });
  });
});
