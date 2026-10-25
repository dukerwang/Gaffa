import { describe, it, expect } from 'vitest';
import { buildRoundSpecs } from '../engine';

// The small-league Consolation Cup is filled from Champions Cup losers, and the
// drop-in finds its first round by round_number. These pin the shapes it
// relies on.
describe('buildRoundSpecs: small-league Consolation Cup', () => {
  it('is a single final at MW38 with four clubs', () => {
    const rounds = buildRoundSpecs(2, 'consolation_cup', 4);
    expect(rounds.map((r) => [r.name, r.startGameweek, r.endGameweek, r.isTwoLeg])).toEqual([['Final', 38, 38, false]]);
  });

  it.each([5, 6])('is two-legged semi-finals at MW36–37 then a final at MW38 with %i clubs', (clubs) => {
    const rounds = buildRoundSpecs(4, 'consolation_cup', clubs);
    expect(rounds.map((r) => [r.name, r.startGameweek, r.endGameweek, r.isTwoLeg])).toEqual([
      ['Semi-Final', 36, 37, true],
      ['Final', 38, 38, false],
    ]);
  });
});

describe('buildRoundSpecs: League Cup', () => {
  it('runs QF MW16, two-legged SF MW21 & 24, final MW31 for an 8-place bracket', () => {
    const rounds = buildRoundSpecs(8, 'secondary_cup', 6);
    expect(rounds.map((r) => [r.name, r.startGameweek, r.endGameweek, r.isTwoLeg])).toEqual([
      ['Quarter-Final', 16, 16, false],
      ['Semi-Final', 21, 24, true],
      ['Final', 31, 31, false],
    ]);
  });
});
