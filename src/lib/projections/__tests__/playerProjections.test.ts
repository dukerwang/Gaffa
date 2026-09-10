import { describe, it, expect } from 'vitest';
import {
  calculatePlayerProjectedPoints,
  estimateExpectedMinutes,
  type PlayerProjectionInput,
} from '../playerProjections';
import { resolvePlayerMinutesRole } from '../calculateGameweekProjections';
import type { TeamMatchEnvironment } from '../teamExpectations';

describe('playerProjections', () => {
  const easyHomeEnv: TeamMatchEnvironment = {
    clubSlug: 'man-city',
    opponentSlug: 'coventry-city',
    isHome: true,
    expectedGoals: 2.85,
    expectedConceded: 0.50,
    cleanSheetProb: 0.58,
  };

  const toughAwayEnv: TeamMatchEnvironment = {
    clubSlug: 'chelsea',
    opponentSlug: 'arsenal',
    isHome: false,
    expectedGoals: 0.95,
    expectedConceded: 1.85,
    cleanSheetProb: 0.16,
  };

  const solidHomeEnv: TeamMatchEnvironment = {
    clubSlug: 'brighton',
    opponentSlug: 'leeds',
    isHome: true,
    expectedGoals: 1.80,
    expectedConceded: 0.90,
    cleanSheetProb: 0.40,
  };

  const toughAwayDefEnv: TeamMatchEnvironment = {
    clubSlug: 'brighton',
    opponentSlug: 'man-city',
    isHome: false,
    expectedGoals: 0.70,
    expectedConceded: 2.30,
    cleanSheetProb: 0.10,
  };

  describe('estimateExpectedMinutes', () => {
    it('returns 0 for injured, suspended, or inactive players', () => {
      expect(estimateExpectedMinutes('i', 'nailed', 100)).toBe(0);
      expect(estimateExpectedMinutes('s', 'nailed', 100)).toBe(0);
      expect(estimateExpectedMinutes('u', 'nailed', 100)).toBe(0);
      expect(estimateExpectedMinutes('n', 'nailed', 100)).toBe(0);
    });

    it('halves minutes for doubtful status', () => {
      const normal = estimateExpectedMinutes('a', 'nailed', 100);
      const doubtful = estimateExpectedMinutes('d', 'nailed', 100);
      expect(doubtful).toBe(normal * 0.5);
    });

    it('orders minutes by role tier', () => {
      const nailed = estimateExpectedMinutes('a', 'nailed', 30);
      const starter = estimateExpectedMinutes('a', 'likely_starter', 30);
      const rotation = estimateExpectedMinutes('a', 'rotation_risk', 30);
      const fringe = estimateExpectedMinutes('a', 'fringe', 30);

      expect(nailed).toBeGreaterThan(starter);
      expect(starter).toBeGreaterThan(rotation);
      expect(rotation).toBeGreaterThan(fringe);
    });

    it('assigns 0 minutes to backup goalkeepers', () => {
      expect(estimateExpectedMinutes('a', 'rotation_risk', 10, 'GK')).toBe(0);
      expect(estimateExpectedMinutes('a', 'fringe', 5, 'GK')).toBe(0);
      expect(estimateExpectedMinutes('a', 'nailed', 30, 'GK')).toBe(84);
    });

    it('scales minutes by FPL chance_next_round percentage', () => {
      const full = estimateExpectedMinutes('a', 'nailed', 50, 'LB', 100);
      const seventyFive = estimateExpectedMinutes('d', 'nailed', 50, 'LB', 75);
      const twentyFive = estimateExpectedMinutes('d', 'nailed', 50, 'LB', 25);
      const zero = estimateExpectedMinutes('i', 'nailed', 50, 'LB', 0);

      expect(full).toBe(84);
      expect(seventyFive).toBe(63);
      expect(twentyFive).toBe(21);
      expect(zero).toBe(0);
    });
  });

  describe('calculatePlayerProjectedPoints', () => {
    it('returns 0 for unavailable players', () => {
      const player: PlayerProjectionInput = {
        primary_position: 'ST',
        market_value: 100,
        fpl_status: 'i',
      };
      expect(calculatePlayerProjectedPoints(player, easyHomeEnv)).toBe(0.0);
    });

    it('projects elite striker in easy home fixture significantly higher than in tough away fixture', () => {
      const striker: PlayerProjectionInput = {
        primary_position: 'ST',
        market_value: 200,
        minutesRole: 'nailed',
        fpl_status: 'a',
      };

      const homePoints = calculatePlayerProjectedPoints(striker, easyHomeEnv);
      const awayPoints = calculatePlayerProjectedPoints(striker, toughAwayEnv);

      expect(homePoints).toBeGreaterThan(18.0);
      expect(awayPoints).toBeLessThan(12.0);
      expect(homePoints).toBeGreaterThan(awayPoints * 1.5);
    });

    it('suppresses attacking playmaker projections when facing a top defense away', () => {
      const palmer: PlayerProjectionInput = {
        primary_position: 'AM',
        market_value: 100,
        minutesRole: 'nailed',
        fpl_status: 'a',
      };

      const pointsAtArsenal = calculatePlayerProjectedPoints(palmer, toughAwayEnv);
      const pointsVsEasy = calculatePlayerProjectedPoints(palmer, easyHomeEnv);

      expect(pointsAtArsenal).toBeLessThan(12.0);
      expect(pointsVsEasy).toBeGreaterThan(18.0);
    });

    it('correctly projects defenders based on clean sheet odds and goals conceded', () => {
      const defender: PlayerProjectionInput = {
        primary_position: 'CB',
        market_value: 25,
        minutesRole: 'nailed',
        fpl_status: 'a',
      };

      const pointsVsLeeds = calculatePlayerProjectedPoints(defender, solidHomeEnv);
      const pointsAtCity = calculatePlayerProjectedPoints(defender, toughAwayDefEnv);

      // Clean sheet potential keeps home defender solid
      expect(pointsVsLeeds).toBeGreaterThan(10.5);
      // High concession at City collapses defender projection
      expect(pointsAtCity).toBeLessThan(6.5);
    });

    it('heavily discounts bench cameos due to non-linear minutes scaling', () => {
      const starter: PlayerProjectionInput = {
        primary_position: 'ST',
        market_value: 20,
        minutesRole: 'likely_starter',
        fpl_status: 'a',
      };

      const sub: PlayerProjectionInput = {
        primary_position: 'ST',
        market_value: 20,
        minutesRole: 'rotation_risk',
        fpl_status: 'a',
      };

      const starterPts = calculatePlayerProjectedPoints(starter, solidHomeEnv);
      const subPts = calculatePlayerProjectedPoints(sub, solidHomeEnv);

      expect(subPts).toBeLessThan(starterPts * 0.6);
    });
  });

  describe('resolvePlayerMinutesRole', () => {
    it('grounds roles in season starts when at least 2 rounds are completed', () => {
      const calafiori = resolvePlayerMinutesRole(
        { primary_position: 'LB', market_value: 55, fpl_starts: 3, fpl_minutes: 236 },
        3,
      );
      expect(calafiori).toBe('nailed');

      const mosquera = resolvePlayerMinutesRole(
        { primary_position: 'CB', market_value: 40, fpl_starts: 2, fpl_minutes: 168 },
        3,
      );
      expect(mosquera).toBe('likely_starter');

      const hincapie = resolvePlayerMinutesRole(
        { primary_position: 'LB', market_value: 50, fpl_starts: 0, fpl_minutes: 32 },
        3,
        'likely_starter', // pre-season outlook overridden by 0 actual starts
      );
      expect(hincapie).toBe('rotation_risk');

      const backupGk = resolvePlayerMinutesRole(
        { primary_position: 'GK', market_value: 8, fpl_starts: 0, fpl_minutes: 0 },
        3,
      );
      expect(backupGk).toBe('fringe');
    });

    it('falls back to outlook or valuation before season starts (rounds < 2)', () => {
      const withOutlook = resolvePlayerMinutesRole(
        { primary_position: 'LB', market_value: 50, fpl_starts: 0, fpl_minutes: 0 },
        0,
        'likely_starter',
      );
      expect(withOutlook).toBe('likely_starter');

      const bigSigning = resolvePlayerMinutesRole(
        { primary_position: 'ST', market_value: 60, fpl_starts: 0, fpl_minutes: 0 },
        0,
      );
      expect(bigSigning).toBe('likely_starter');

      const squadPlayer = resolvePlayerMinutesRole(
        { primary_position: 'CM', market_value: 20, fpl_starts: 0, fpl_minutes: 0 },
        0,
      );
      expect(squadPlayer).toBe('rotation_risk');
    });
  });
});
