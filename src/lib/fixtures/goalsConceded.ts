/** The score fields of an FPL `fixtures` entry this needs. */
export interface ScoredFixture {
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
}

/**
 * What a player's side conceded in the whole match, for the performance block
 * to tell a partial clean sheet from a real one.
 *
 * `teamId` is a seasonal FPL team id, so it must come from the same season's
 * payload as `fixture`. A player it doesn't place on either side, or a match
 * with no score yet, gets no value rather than a guess.
 */
export function teamGoalsConceded(fixture: ScoredFixture | undefined, teamId: number | null): number | undefined {
  if (!fixture || teamId == null || fixture.team_h_score == null || fixture.team_a_score == null) return undefined;
  if (teamId === fixture.team_h) return fixture.team_a_score;
  if (teamId === fixture.team_a) return fixture.team_h_score;
  return undefined;
}
