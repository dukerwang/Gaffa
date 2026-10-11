import { describe, expect, it } from 'vitest';
import { freeAgentMinimumBid, isRedraft, leagueFeatures, REDRAFT_BUDGET, REDRAFT_MINIMUM_BID } from '../features';
import { computeRecommendedSettings } from '../recommendedSettings';

describe('leagueFeatures', () => {
  it('turns every switchable system on for a dynasty league', () => {
    expect(Object.values(leagueFeatures({ is_dynasty: true })).every(Boolean)).toBe(true);
  });

  it('turns every switchable system off for a redraft league', () => {
    expect(Object.values(leagueFeatures({ is_dynasty: false })).some(Boolean)).toBe(false);
  });

  it('treats a league with no format recorded as dynasty, the column default', () => {
    expect(isRedraft({ is_dynasty: null })).toBe(false);
    expect(leagueFeatures(null).listings).toBe(true);
  });
});

describe('freeAgentMinimumBid', () => {
  it('floors a dynasty bid at a share of market value, rounded down', () => {
    expect(freeAgentMinimumBid(45, { is_dynasty: true }, 0.6)).toBe(27);
  });

  it('opens every redraft free agent at a flat €1m', () => {
    expect(freeAgentMinimumBid(120, { is_dynasty: false }, 0.6)).toBe(REDRAFT_MINIMUM_BID);
    expect(freeAgentMinimumBid(0, { is_dynasty: false }, 0.6)).toBe(REDRAFT_MINIMUM_BID);
  });
});

describe('recommended redraft budget', () => {
  it('is the same €100m whatever the league size or preset', () => {
    for (const maxTeams of [4, 8, 12]) {
      for (const profile of ['casual', 'standard', 'deep'] as const) {
        expect(computeRecommendedSettings({ maxTeams, profile, isDynasty: false }).faabBudget).toBe(REDRAFT_BUDGET);
      }
    }
  });

  it('leaves dynasty budgets as they were', () => {
    expect(computeRecommendedSettings({ maxTeams: 10, profile: 'standard', isDynasty: true }).faabBudget).toBe(250);
  });
});
