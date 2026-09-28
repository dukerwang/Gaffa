import { describe, expect, it } from 'vitest';
import { fieldsFromMatch, matchFixtures, withV3Fields } from '../gameweekEnrichment';
import type { FotmobFixture, FotmobMatch } from '../matchDetails';
import { engineVersionFor, V3_START } from '@/lib/scoring/engineVersion';
import type { RawStats } from '@/types';

const fixture = (matchId: number, home: string, away: string): FotmobFixture => ({
    matchId, round: 6, utcTime: '', home: { id: 1, name: home }, away: { id: 2, name: away }, finished: true,
});

describe('engineVersionFor', () => {
    it('is V2 everywhere until a start gameweek is set', () => {
        expect(V3_START).toBeNull();
        expect(engineVersionFor('2026-27', 38)).toBe('v2');
    });

    it('switches at the start gameweek and stays on for later seasons', () => {
        const start = { season: '2026-27', gameweek: 8 };
        expect(engineVersionFor('2026-27', 7, start)).toBe('v2');
        expect(engineVersionFor('2026-27', 8, start)).toBe('v3');
        expect(engineVersionFor('2027-28', 1, start)).toBe('v3');
        expect(engineVersionFor('2025-26', 38, start)).toBe('v2');
    });
});

describe('matchFixtures', () => {
    it('pairs FPL fixtures with FotMob matches by club, across FotMob name spellings', () => {
        const paired = matchFixtures(
            [
                { fplFixtureId: 51, homeSlug: 'bournemouth', awaySlug: 'liverpool' },
                { fplFixtureId: 52, homeSlug: 'spurs', awaySlug: 'wolves' },
                { fplFixtureId: 53, homeSlug: 'arsenal', awaySlug: 'chelsea' },
            ],
            [fixture(900, 'AFC Bournemouth', 'Liverpool'), fixture(901, 'Tottenham Hotspur', 'Wolverhampton Wanderers'), fixture(902, 'Chelsea', 'Arsenal')],
        );
        expect(paired.get(51)).toBe(900);
        expect(paired.get(52)).toBe(901);
        expect(paired.get(53)).toBeNull(); // home and away reversed: a different fixture
    });
});

describe('fieldsFromMatch', () => {
    it('keys players by Opta id and skips anyone who did not play', () => {
        const match: FotmobMatch = {
            schema: 2, matchId: 900, round: 6, utcTime: '', home: { id: 1, name: 'A' }, away: { id: 2, name: 'B' },
            players: [
                { fotmobId: 1, optaId: 118748, name: 'Starter', teamId: 1, isGoalkeeper: false, penaltyGoals: 1,
                    stats: { 'Minutes played': { value: 90 }, 'Line breaking passes': { value: 7 }, 'Aerial duels won': { value: 2, total: 5 } } },
                { fotmobId: 2, optaId: 200, name: 'Unused', teamId: 1, isGoalkeeper: false, penaltyGoals: 0, stats: { 'Minutes played': { value: 0 } } },
                { fotmobId: 3, optaId: null, name: 'No Opta id', teamId: 2, isGoalkeeper: false, penaltyGoals: 0, stats: { 'Minutes played': { value: 30 } } },
            ],
        };
        const fields = fieldsFromMatch(match);
        expect([...fields.keys()]).toEqual([118748]);
        expect(fields.get(118748)).toEqual({ penalty_goals: 1, line_breaking_passes: 7, aerials_won: 2, aerials_lost: 3 });
    });
});

describe('withV3Fields', () => {
    const base = { minutes_played: 90, goals: 0, assists: 0, bps: 20 } as RawStats;

    it('marks the row V3 and adds the element type and FotMob fields', () => {
        const row = withV3Fields(base, 3, { penalty_goals: 0, line_breaking_passes: 7, aerials_won: 2, aerials_lost: 1 });
        expect(row).toMatchObject({ engine_version: 'v3', fpl_element_type: 3, line_breaking_passes: 7, aerials_won: 2, aerials_lost: 1 });
        expect(row.fotmob_missing).toBeUndefined();
    });

    it('flags an appearance FotMob did not list, but not a player who did not play', () => {
        expect(withV3Fields(base, 3, undefined).fotmob_missing).toBe(true);
        expect(withV3Fields({ ...base, minutes_played: 0 }, 3, undefined).fotmob_missing).toBeUndefined();
    });
});
