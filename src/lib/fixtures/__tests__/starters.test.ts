import { describe, expect, it } from 'vitest';
import { startedFixtures } from '../starters';

const ex = (fixture: number, minutes: number) => ({
  fixture,
  stats: [{ identifier: 'minutes', value: minutes }],
});

describe('startedFixtures', () => {
  it('marks the one match of a single gameweek', () => {
    expect([...startedFixtures(1, [ex(69, 90)])]).toEqual([69]);
  });

  it('marks nothing for a substitute', () => {
    expect(startedFixtures(0, [ex(69, 20)]).size).toBe(0);
    expect(startedFixtures(undefined, [ex(69, 20)]).size).toBe(0);
  });

  it('marks both matches when he started both of a double gameweek', () => {
    expect([...startedFixtures(2, [ex(10, 90), ex(20, 75)])].sort()).toEqual([10, 20]);
  });

  it('gives a lone start in a double gameweek to the match he played longer in', () => {
    expect([...startedFixtures(1, [ex(10, 25), ex(20, 88)])]).toEqual([20]);
  });

  it('breaks a tie on minutes by kickoff order', () => {
    expect([...startedFixtures(1, [ex(10, 45), ex(20, 45)])]).toEqual([10]);
  });
});
