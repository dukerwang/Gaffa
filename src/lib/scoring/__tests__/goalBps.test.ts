import { describe, expect, it } from 'vitest';
import { calculateMatchRating, matchImpactRawInput } from '../matchRating';
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

    it('leaves a game without goals identical to V2', () => {
        const positions: GranularPosition[] = ['GK', 'CB', 'LB', 'DM', 'CM', 'AM', 'LW', 'ST'];
        for (const pos of positions) {
            const base = stats({ assists: 1, bps: 30, influence: 25, creativity: 20, threat: 15 });
            const v2 = calculateMatchRating(base, pos);
            const v3 = calculateMatchRating({ ...base, engine_version: 'v3', fpl_element_type: 3 }, pos);
            expect(v3.rating).toBe(v2.rating);
            expect(v3.fantasyPoints).toBe(v2.fantasyPoints);
        }
    });

    it('never drops raw input below zero', () => {
        const s = stats({ goals: 3, bps: 40, engine_version: 'v3', fpl_element_type: 4 });
        expect(matchImpactRawInput(s, 'ST')).toBe(0);
    });
});
