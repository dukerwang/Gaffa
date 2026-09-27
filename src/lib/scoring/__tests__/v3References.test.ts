import { describe, expect, it } from 'vitest';
import { calculateMatchRating, DEFAULT_REFERENCE_STATS } from '../matchRating';
import v3ReferenceStats from '../v3ReferenceStats.json';
import type { GranularPosition, RawStats, ReferenceStats } from '@/types';

const POSITIONS: GranularPosition[] = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

function stats(overrides: Partial<RawStats>): RawStats {
    return {
        minutes_played: 90, goals: 0, assists: 0, shots_on_target: 0, key_passes: 0, tackles_total: 0, tackles_won: 0,
        saves: 0, goals_conceded: 1, penalty_saves: 0, yellow_cards: 0, red_cards: 0, own_goals: 0, penalties_missed: 0,
        clean_sheet: false, bps: 18, influence: 20, creativity: 15, threat: 12, expected_goals_conceded: 1,
        fpl_tackles: 2, fpl_cbi: 3, fpl_recoveries: 4,
        ...overrides,
    };
}

/** References with Match Impact and Defensive set far off, to see which ones the engine reads. */
function skewed(): Record<GranularPosition, ReferenceStats> {
    const r = JSON.parse(JSON.stringify(DEFAULT_REFERENCE_STATS));
    for (const p of POSITIONS) {
        r[p].match_impact = { median: 500, stddev: 1 };
        r[p].defensive = { median: 500, stddev: 1 };
    }
    return r;
}

describe('V3 reference file', () => {
    const components = (v3ReferenceStats as { components: Record<string, Record<string, { median: number; stddev: number; n: number }>> }).components;

    it('holds only Match Impact and Defensive, with sane values from a real sample', () => {
        expect(Object.keys(components).sort()).toEqual(['defensive', 'match_impact']);
        for (const byPos of Object.values(components)) {
            for (const [pos, r] of Object.entries(byPos)) {
                expect(POSITIONS).toContain(pos);
                expect(r.stddev).toBeGreaterThan(0);
                expect(Number.isFinite(r.median)).toBe(true);
                expect(r.n).toBeGreaterThanOrEqual(400);
            }
        }
    });

    it('covers Match Impact at every position, and Defensive everywhere but GK (whose input V3 leaves unchanged)', () => {
        expect(Object.keys(components.match_impact).sort()).toEqual([...POSITIONS].sort());
        expect(Object.keys(components.defensive).sort()).toEqual(POSITIONS.filter((p) => p !== 'GK').sort());
    });

    it('is never read for V2 rows', () => {
        for (const pos of POSITIONS) {
            const s = stats({});
            const a = calculateMatchRating(s, pos, skewed(), pos);
            const b = calculateMatchRating(s, pos, skewed(), pos, { v3References: false });
            expect(a.fantasyPoints).toBe(b.fantasyPoints);
            // The skewed references reach V2 scoring, which puts Match Impact near zero.
            expect(a.breakdown.find((x) => x.key === 'match_impact')!.score).toBeLessThan(0.01);
        }
    });

    it('replaces the passed-in Match Impact and Defensive references for V3 rows', () => {
        for (const pos of POSITIONS) {
            const s = stats({ engine_version: 'v3', fpl_element_type: pos === 'GK' ? 1 : 3 });
            const mi = calculateMatchRating(s, pos, skewed(), pos).breakdown.find((x) => x.key === 'match_impact')!.score;
            expect(mi).toBeGreaterThan(0.01);
            // AM, LW, RW and ST weight Defensive at 0, so it isn't in their breakdown.
            const def = calculateMatchRating(s, pos, skewed(), pos).breakdown.find((x) => x.key === 'defensive')?.score;
            if (def === undefined) continue;
            if (pos === 'GK') expect(def).toBeLessThan(0.01); // GK Defensive keeps the passed-in reference
            else expect(def).toBeGreaterThan(0.01);
        }
    });
});
