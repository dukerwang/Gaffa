import { describe, expect, it } from 'vitest';
import { calculateMatchRating, defensiveRawInput, matchImpactRawInput } from '../matchRating';
import type { GranularPosition, RawStats } from '@/types';

function stats(overrides: Partial<RawStats>): RawStats {
    return {
        minutes_played: 90,
        goals: 0,
        assists: 0,
        shots_on_target: 0,
        key_passes: 0,
        tackles_total: 0,
        tackles_won: 0,
        saves: 0,
        goals_conceded: 0,
        penalty_saves: 0,
        yellow_cards: 0,
        red_cards: 0,
        own_goals: 0,
        penalties_missed: 0,
        clean_sheet: false,
        bps: 60,
        ...overrides,
    };
}

describe('V3 goal BPS strip', () => {
    it('strips what FPL paid per goal: 12 GK/DEF, 18 MID, 24 FWD', () => {
        const goal = { goals: 1, bps: 60, engine_version: 'v3' as const };
        expect(matchImpactRawInput(stats({ ...goal, fpl_element_type: 1 }), 'GK')).toBe(48);
        expect(matchImpactRawInput(stats({ ...goal, fpl_element_type: 2 }), 'CB')).toBe(48);
        expect(matchImpactRawInput(stats({ ...goal, fpl_element_type: 3 }), 'CM')).toBe(42);
        expect(matchImpactRawInput(stats({ ...goal, fpl_element_type: 4 }), 'ST')).toBe(36);
    });

    it('keys on FPL element type, not tactical position', () => {
        // A winger FPL lists as a forward.
        const s = stats({ goals: 1, engine_version: 'v3', fpl_element_type: 4 });
        expect(matchImpactRawInput(s, 'LW')).toBe(36);
    });

    it('keeps the flat V2 strip when engine_version is absent', () => {
        const s = stats({ goals: 2, assists: 1, fpl_element_type: 4 });
        expect(matchImpactRawInput(s, 'ST')).toBe(60 - 24 - 9);
    });

    // These compare formulas, so both sides use the same references (V3 rows
    // otherwise read v3ReferenceStats.json; see v3References.test.ts).
    it('leaves a game without goals identical to V2', () => {
        const positions: GranularPosition[] = ['GK', 'CB', 'LB', 'DM', 'CM', 'AM', 'LW', 'ST'];
        for (const pos of positions) {
            const base = stats({ assists: 1, bps: 30, influence: 25, creativity: 20, threat: 15 });
            const v2 = calculateMatchRating(base, pos);
            const v3 = calculateMatchRating({ ...base, engine_version: 'v3', fpl_element_type: 3 }, pos, undefined, undefined, { v3References: false });
            expect(v3.rating).toBe(v2.rating);
            expect(v3.fantasyPoints).toBe(v2.fantasyPoints);
        }
    });

    it('never drops raw input below zero', () => {
        const s = stats({ goals: 3, bps: 40, engine_version: 'v3', fpl_element_type: 4 });
        expect(matchImpactRawInput(s, 'ST')).toBe(0);
    });

    it('strips 12 for a penalty goal at every position', () => {
        const s = stats({ goals: 2, penalty_goals: 1, bps: 60, engine_version: 'v3', fpl_element_type: 4 });
        expect(matchImpactRawInput(s, 'ST')).toBe(60 - 24 - 12);
    });

    it('never treats more goals as penalties than were scored', () => {
        const s = stats({ goals: 1, penalty_goals: 2, bps: 60, engine_version: 'v3', fpl_element_type: 3 });
        expect(matchImpactRawInput(s, 'CM')).toBe(60 - 12);
    });
});

describe('V3 net aerial duels', () => {
    const base = { fpl_tackles: 2, fpl_cbi: 4, fpl_recoveries: 4, goals_conceded: 1, expected_goals_conceded: 1 };

    it('counts each net aerial like a clearance/block/interception: 0.5 for CB, 1 elsewhere', () => {
        const v2cb = defensiveRawInput(stats(base), 'CB').defensiveRaw;
        const v3cb = defensiveRawInput(stats({ ...base, engine_version: 'v3', aerials_won: 5, aerials_lost: 1 }), 'CB').defensiveRaw;
        expect(v3cb - v2cb).toBeCloseTo(2);
        const v2dm = defensiveRawInput(stats(base), 'DM').defensiveRaw;
        const v3dm = defensiveRawInput(stats({ ...base, engine_version: 'v3', aerials_won: 1, aerials_lost: 3 }), 'DM').defensiveRaw;
        expect(v3dm - v2dm).toBeCloseTo(-2);
    });

    it('leaves keepers and V2 rows alone', () => {
        const gk = defensiveRawInput(stats({ ...base, engine_version: 'v3', aerials_won: 4 }), 'GK').defensiveRaw;
        expect(gk).toBe(defensiveRawInput(stats(base), 'GK').defensiveRaw);
        const v2 = defensiveRawInput(stats({ ...base, aerials_won: 4 }), 'CB').defensiveRaw;
        expect(v2).toBe(defensiveRawInput(stats(base), 'CB').defensiveRaw);
    });
});

describe('V3 substitute scoring', () => {
    const quiet = { bps: 6, influence: 4, creativity: 3, threat: 2, fpl_tackles: 1, fpl_recoveries: 1 };

    it('changes nothing at 90 minutes', () => {
        const s = stats({ ...quiet, bps: 20, influence: 25, creativity: 20, threat: 15, assists: 1 });
        const a = calculateMatchRating({ ...s, engine_version: 'v3', fpl_element_type: 3 }, 'CM', undefined, undefined, { v3References: false });
        expect(matchImpactRawInput({ ...s, engine_version: 'v3', fpl_element_type: 3 }, 'CM')).toBe(20 - 9);
        expect(a.fantasyPoints).toBe(calculateMatchRating(s, 'CM').fantasyPoints);
    });

    it('credits a busy 25-minute cameo more than V2 does', () => {
        const busy = stats({ minutes_played: 25, bps: 12, influence: 14, creativity: 12, threat: 10, fpl_tackles: 2, fpl_recoveries: 3 });
        const v2 = calculateMatchRating(busy, 'CM').fantasyPoints;
        const v3 = calculateMatchRating({ ...busy, engine_version: 'v3', fpl_element_type: 3 }, 'CM').fantasyPoints;
        expect(v3).toBeGreaterThan(v2);
    });

    it('keeps a quiet cameo below a quiet full match', () => {
        const cameo = calculateMatchRating(stats({ ...quiet, minutes_played: 12, bps: 3, engine_version: 'v3', fpl_element_type: 3 }), 'CM');
        const full = calculateMatchRating(stats({ ...quiet, bps: 12, influence: 12, creativity: 10, threat: 6, engine_version: 'v3', fpl_element_type: 3 }), 'CM');
        expect(cameo.fantasyPoints).toBeLessThan(full.fantasyPoints);
    });

    it('spreads the flat appearance BPS over the minutes played', () => {
        // 30 minutes: FPL paid 3 for appearing; V3 counts 6 x 30/90 = 2 of it.
        const s = stats({ minutes_played: 30, bps: 10, engine_version: 'v3', fpl_element_type: 3 });
        expect(matchImpactRawInput(s, 'CM')).toBeCloseTo(9);
    });

    it('leaves the goal itself alone', () => {
        const goal = stats({ minutes_played: 15, goals: 1, bps: 30, engine_version: 'v3', fpl_element_type: 4 });
        const gi = (r: ReturnType<typeof calculateMatchRating>) => r.breakdown.find((b) => b.key === 'goal_involvement')!.score;
        expect(gi(calculateMatchRating(goal, 'ST'))).toBe(gi(calculateMatchRating({ ...goal, minutes_played: 90 }, 'ST')));
    });
});

describe('V3 line-breaking passes', () => {
    it('adds one third of a BPS per line-breaking pass', () => {
        const s = stats({ bps: 20, line_breaking_passes: 9, engine_version: 'v3', fpl_element_type: 3 });
        expect(matchImpactRawInput(s, 'DM')).toBeCloseTo(23);
    });

    it('adds passes after the floor, so a large goal strip cannot cancel them', () => {
        const s = stats({ goals: 3, bps: 40, line_breaking_passes: 6, engine_version: 'v3', fpl_element_type: 4 });
        expect(matchImpactRawInput(s, 'ST')).toBeCloseTo(2);
    });

    it('ignores line-breaking passes on V2 rows', () => {
        const s = stats({ bps: 20, line_breaking_passes: 9 });
        expect(matchImpactRawInput(s, 'DM')).toBe(20);
    });
});
