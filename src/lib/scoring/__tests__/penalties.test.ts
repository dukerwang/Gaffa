import { describe, expect, it } from 'vitest';
import { calculateMatchRating, PENALTY_THREAT, threatRawInput } from '../matchRating';
import { applyIctImputation } from '../ictImputation';
import type { RawStats } from '@/types';

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
        bps: 30,
        influence: 30,
        creativity: 20,
        threat: 40,
        expected_goals: 0.3,
        expected_assists: 0.1,
        ...overrides,
    };
}

const v3 = { engine_version: 'v3' as const, fpl_element_type: 3 as const };
const component = (s: RawStats, key: string) =>
    calculateMatchRating(s, 'ST', undefined, 'ST', { v3References: false }).breakdown.find((b) => b.key === key)!.score;

describe('V3 penalties counted once', () => {
    it('takes each penalty out of Threat, scored or missed', () => {
        expect(threatRawInput(stats({ ...v3, goals: 1, penalty_goals: 1 }))).toBe(40 - PENALTY_THREAT);
        expect(threatRawInput(stats({ ...v3, penalties_missed: 1 }))).toBe(40 - PENALTY_THREAT);
        expect(threatRawInput(stats({ ...v3, threat: 10, penalties_missed: 1 }))).toBe(0);
    });

    it('leaves Threat alone for V2 rows and when switched off', () => {
        expect(threatRawInput(stats({ goals: 1, penalty_goals: 1 }))).toBe(40);
        expect(threatRawInput(stats({ ...v3, penalties_missed: 1 }), { penaltiesOnce: false })).toBe(40);
    });

    it('judges Finishing on open play: a scored penalty is neutral there', () => {
        const openPlayOnly = stats({ ...v3, expected_goals: 0.3 });
        const withPenalty = stats({ ...v3, goals: 1, penalty_goals: 1, expected_goals: 0.3 + 0.79 });
        expect(component(withPenalty, 'finishing')).toBeCloseTo(component(openPlayOnly, 'finishing'), 10);
    });

    it('does not mark a missed penalty down in Finishing; BPS already does', () => {
        const openPlayOnly = stats({ ...v3, expected_goals: 0.3 });
        const missed = stats({ ...v3, penalties_missed: 1, expected_goals: 0.3 + 0.79 });
        expect(component(missed, 'finishing')).toBeCloseTo(component(openPlayOnly, 'finishing'), 10);
    });

    it('still counts a scored penalty as a goal', () => {
        const s = stats({ ...v3, goals: 1, penalty_goals: 1, expected_goals: 1.09 });
        expect(component(s, 'goal_involvement')).toBeGreaterThan(component(stats(v3), 'goal_involvement'));
    });

    it('estimates live Threat from open play and adds FPL’s per-penalty value back', () => {
        const live = { ...v3, minutes_played: 90, goals: 1, penalty_goals: 1, expected_goals: 1.01, bps: 37 };
        const openPlay = { ...v3, minutes_played: 90, goals: 0, expected_goals: 0.22, bps: 25 };
        const imputed = applyIctImputation(stats(live), 'AM');
        const imputedOpen = applyIctImputation(stats(openPlay), 'AM');
        expect(imputed.threat).toBeCloseTo((imputedOpen.threat ?? 0) + PENALTY_THREAT, 1);
    });
});
