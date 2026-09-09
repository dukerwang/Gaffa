import { describe, it, expect } from 'vitest';
import { getGameweekFixtureMap, getPlayerFixture } from '../gameweekFixtures';

describe('gameweekFixtures', () => {
  it('returns an empty map when gameweek or season is missing', async () => {
    const mockAdmin = {} as any;
    const res1 = await getGameweekFixtureMap(mockAdmin, '', 4);
    expect(res1).toEqual({});
    const res2 = await getGameweekFixtureMap(mockAdmin, '2026-27', 0);
    expect(res2).toEqual({});
  });

  it('maps fixtures correctly and allows getPlayerFixture lookup', async () => {
    const mockAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  home_club: 'Arsenal',
                  away_club: 'Chelsea',
                  home_score: null,
                  away_score: null,
                  finished: false,
                  kickoff_time: '2026-09-13T15:30:00Z',
                },
              ],
            }),
          }),
        }),
      }),
    } as any;

    const fixtureMap = await getGameweekFixtureMap(mockAdmin, '2026-27', 4);

    // Arsenal is home against Chelsea
    expect(fixtureMap['arsenal']).toBeDefined();
    expect(fixtureMap['arsenal'].opponent).toBe('CHE (H)');
    expect(fixtureMap['arsenal'].isHome).toBe(true);
    expect(fixtureMap['arsenal'].kickoffTime).toBe('2026-09-13T15:30:00Z');

    // Chelsea is away against Arsenal
    expect(fixtureMap['chelsea']).toBeDefined();
    expect(fixtureMap['chelsea'].opponent).toBe('ARS (A)');
    expect(fixtureMap['chelsea'].isHome).toBe(false);

    // Test getPlayerFixture
    const saka = { pl_team: 'Arsenal' };
    const sakaFix = getPlayerFixture(saka, fixtureMap);
    expect(sakaFix?.opponent).toBe('CHE (H)');

    const palmer = { pl_team: 'CHE' };
    const palmerFix = getPlayerFixture(palmer, fixtureMap);
    expect(palmerFix?.opponent).toBe('ARS (A)');

    const unknownPlayer = { pl_team: 'Real Madrid' };
    expect(getPlayerFixture(unknownPlayer, fixtureMap)).toBeUndefined();
    expect(getPlayerFixture(null, fixtureMap)).toBeUndefined();
  });
});
