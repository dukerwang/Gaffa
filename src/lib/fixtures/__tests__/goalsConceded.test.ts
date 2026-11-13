import { describe, expect, it } from 'vitest';
import { teamGoalsConceded } from '../goalsConceded';

const fixture = { team_h: 3, team_a: 14, team_h_score: 2, team_a_score: 1 };

describe('teamGoalsConceded', () => {
  it('gives each side the other side’s score', () => {
    expect(teamGoalsConceded(fixture, 3)).toBe(1);
    expect(teamGoalsConceded(fixture, 14)).toBe(2);
  });

  it('gives nothing for a team in neither side', () => {
    expect(teamGoalsConceded(fixture, 7)).toBeUndefined();
  });

  it('gives nothing without a fixture, a team or a score', () => {
    expect(teamGoalsConceded(undefined, 3)).toBeUndefined();
    expect(teamGoalsConceded(fixture, null)).toBeUndefined();
    expect(teamGoalsConceded({ ...fixture, team_a_score: null }, 3)).toBeUndefined();
  });

  it('counts a goalless draw as zero, not missing', () => {
    expect(teamGoalsConceded({ ...fixture, team_h_score: 0, team_a_score: 0 }, 3)).toBe(0);
  });
});
