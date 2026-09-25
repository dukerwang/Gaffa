import { describe, expect, it } from 'vitest';
import {
  calculateMatchRating,
  calculateShadowPillar1Rating,
  DEFAULT_REFERENCE_STATS,
  defaultElementTypeForPosition,
  resolveEngineVersionForGameweek,
  V3_FIRST_GW,
} from '../matchRating';
import type { GranularPosition, RawStats } from '@/types';

const SAMPLE_CB_CONCEDED: RawStats = {
  minutes_played: 90,
  goals: 0,
  assists: 0,
  shots_on_target: 0,
  key_passes: 0,
  tackles_total: 4,
  tackles_won: 3,
  saves: 0,
  goals_conceded: 2,
  penalty_saves: 0,
  yellow_cards: 0,
  red_cards: 0,
  own_goals: 0,
  penalties_missed: 0,
  clean_sheet: false,
  bps: 11,
  influence: 28.4,
  creativity: 4.2,
  threat: 2.0,
  ict_index: 3.5,
  expected_goals: 0.05,
  expected_assists: 0.02,
  expected_goals_conceded: 1.45,
  fpl_tackles: 4,
  fpl_cbi: 8,
  fpl_recoveries: 6,
  fpl_def_contrib: 12,
};

const SAMPLE_CB_CLEAN_SHEET_LOW_WORK: RawStats = {
  ...SAMPLE_CB_CONCEDED,
  goals_conceded: 0,
  clean_sheet: true,
  bps: 24,
  influence: 14.0,
  expected_goals_conceded: 0.8,
  fpl_tackles: 1,
  fpl_cbi: 2,
  fpl_recoveries: 2,
};

const SAMPLE_CB_CLEAN_SHEET_HIGH_WORK: RawStats = {
  ...SAMPLE_CB_CONCEDED,
  goals_conceded: 0,
  clean_sheet: true,
  bps: 29,
  influence: 32.0,
  expected_goals_conceded: 1.8,
  fpl_tackles: 5,
  fpl_cbi: 10,
  fpl_recoveries: 8,
};

describe('Gaffa Scoring V3 — Engine Version Resolution & Historical Invariance', () => {
  it('gates V3 strictly to 2026-27 GW6+ via V3_FIRST_GW = 6', () => {
    expect(V3_FIRST_GW).toBe(6);
    expect(resolveEngineVersionForGameweek('2025-26', 38)).toBe('v2');
    for (let gw = 1; gw <= 5; gw++) {
      expect(resolveEngineVersionForGameweek('2026-27', gw)).toBe('v2');
    }
    for (let gw = 6; gw <= 38; gw++) {
      expect(resolveEngineVersionForGameweek('2026-27', gw)).toBe('v3');
    }
    expect(resolveEngineVersionForGameweek('2027-28', 1)).toBe('v3');
  });

  it('preserves exact V2 ratings and points across all 12 positions when engine_version is absent or v2', () => {
    const positions: GranularPosition[] = [
      'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST',
    ];
    for (const pos of positions) {
      const statsNoStamp: RawStats = { ...SAMPLE_CB_CONCEDED };
      const statsV2Stamp: RawStats = { ...SAMPLE_CB_CONCEDED, engine_version: 'v2' };

      const rUnstamped = calculateMatchRating(statsNoStamp, pos, DEFAULT_REFERENCE_STATS);
      const rV2 = calculateMatchRating(statsV2Stamp, pos, DEFAULT_REFERENCE_STATS);

      expect(rUnstamped.rating).toBe(rV2.rating);
      expect(rUnstamped.fantasyPoints).toBe(rV2.fantasyPoints);
      expect(rUnstamped.breakdown).toEqual(rV2.breakdown);
    }
  });

  it('locks exact V2 snapshot scores for primary and secondary position re-scores (GW1-5 protection)', () => {
    // Primary CB re-scored at LB and DM (as matchups/[matchupId]/page.tsx and cardData.ts do)
    const cbAtCb = calculateMatchRating(SAMPLE_CB_CONCEDED, 'CB', DEFAULT_REFERENCE_STATS);
    const cbAtLb = calculateMatchRating(SAMPLE_CB_CONCEDED, 'LB', DEFAULT_REFERENCE_STATS);
    const cbAtDm = calculateMatchRating(SAMPLE_CB_CONCEDED, 'DM', DEFAULT_REFERENCE_STATS);

    // Exact frozen V2 values against 2025-26 DEFAULT_REFERENCE_STATS
    expect(cbAtCb).toMatchObject({
      rating: 6.52,
      fantasyPoints: 5.72,
    });
    expect(cbAtLb.rating).toBe(
      calculateMatchRating({ ...SAMPLE_CB_CONCEDED, engine_version: 'v2' }, 'LB', DEFAULT_REFERENCE_STATS).rating,
    );
    expect(cbAtDm.rating).toBe(
      calculateMatchRating({ ...SAMPLE_CB_CONCEDED, engine_version: 'v2' }, 'DM', DEFAULT_REFERENCE_STATS).rating,
    );
  });
});

const findComp = (res: ReturnType<typeof calculateMatchRating>, key: string) =>
  res.breakdown.find((b) => b.key === key)!;

describe('Gaffa Scoring V3 — Pillar 2 (BPS De-Duplication & z-Space Clean Sheet)', () => {
  it('lifts a high-work CB who conceded 2 goals from 5.72 pts (V2) to > 12 pts (V3)', () => {
    const v2 = calculateMatchRating(
      { ...SAMPLE_CB_CONCEDED, engine_version: 'v2', fpl_element_type: 2 },
      'CB',
      DEFAULT_REFERENCE_STATS,
    );
    const v3 = calculateMatchRating(
      { ...SAMPLE_CB_CONCEDED, engine_version: 'v3', fpl_element_type: 2 },
      'CB',
      DEFAULT_REFERENCE_STATS,
    );

    expect(v2.fantasyPoints).toBe(5.72);
    expect(v3.fantasyPoints).toBeGreaterThan(12.0);
    // V3 adds +8 BPS back for 2 goals conceded (11 - (-8) = 19 raw match_impact)
    expect(findComp(v3, 'match_impact').detail).toContain('19');
    expect(findComp(v3, 'match_impact').score).toBeGreaterThan(findComp(v2, 'match_impact').score);
  });

  it('preserves meaningful rating spread between low-work and high-work CB clean sheets via z-space offset', () => {
    const lowWork = calculateMatchRating(
      { ...SAMPLE_CB_CLEAN_SHEET_LOW_WORK, engine_version: 'v3', fpl_element_type: 2 },
      'CB',
      DEFAULT_REFERENCE_STATS,
    );
    const highWork = calculateMatchRating(
      { ...SAMPLE_CB_CLEAN_SHEET_HIGH_WORK, engine_version: 'v3', fpl_element_type: 2 },
      'CB',
      DEFAULT_REFERENCE_STATS,
    );

    expect(
      findComp(highWork, 'defensive').score - findComp(lowWork, 'defensive').score,
    ).toBeGreaterThan(0.13);
    expect(highWork.fantasyPoints - lowWork.fantasyPoints).toBeGreaterThan(6.0);
  });

  it('keys goal BPS strip (12/18/24) and CS BPS strip strictly on fpl_element_type', () => {
    const scoringWingbackAsMid: RawStats = {
      ...SAMPLE_CB_CLEAN_SHEET_LOW_WORK,
      goals: 1,
      bps: 42,
      engine_version: 'v3',
      fpl_element_type: 3, // FPL classifies this LWB as MID
    };
    const scoringWingbackAsDef: RawStats = {
      ...scoringWingbackAsMid,
      fpl_element_type: 2, // FPL classifies this LWB as DEF
    };

    const resMid = calculateMatchRating(scoringWingbackAsMid, 'LWB', DEFAULT_REFERENCE_STATS);
    const resDef = calculateMatchRating(scoringWingbackAsDef, 'LWB', DEFAULT_REFERENCE_STATS);

    // MID strips 18 BPS for the goal and 0 for the clean sheet: 42 - 18 = 24
    expect(findComp(resMid, 'match_impact').detail).toContain('24');
    // DEF strips 12 BPS for the goal and 12 for the clean sheet: 42 - 12 - 12 = 18
    expect(findComp(resDef, 'match_impact').detail).toContain('18');
    expect(findComp(resMid, 'match_impact').score).toBeGreaterThan(
      findComp(resDef, 'match_impact').score,
    );
  });

  it('does not strip CS/GC BPS from GK (fpl_element_type = 1) and applies V3_GK_CURVE_SCALE = 0.85', () => {
    const gkStats: RawStats = {
      ...SAMPLE_CB_CLEAN_SHEET_LOW_WORK,
      saves: 4,
      bps: 28,
      fpl_element_type: 1,
    };
    const gkV2 = calculateMatchRating({ ...gkStats, engine_version: 'v2' }, 'GK', DEFAULT_REFERENCE_STATS);
    const gkV3 = calculateMatchRating({ ...gkStats, engine_version: 'v3' }, 'GK', DEFAULT_REFERENCE_STATS);

    expect(findComp(gkV3, 'match_impact').detail).toContain('28');
    expect(gkV3.fantasyPoints).toBeGreaterThan(gkV2.fantasyPoints);
  });
});

describe('Gaffa Scoring V3 — Pillar 1 Shadow Mode (Centered Single-Destination)', () => {
  it('returns an exact 0.00 delta when FotMob stats are missing (neutral fallback)', () => {
    const baseStats: RawStats = {
      ...SAMPLE_CB_CONCEDED,
      engine_version: 'v3',
      fpl_element_type: defaultElementTypeForPosition('CB'),
    };
    const base = calculateMatchRating(baseStats, 'CB', DEFAULT_REFERENCE_STATS);
    const shadow = calculateShadowPillar1Rating(baseStats, 'CB', DEFAULT_REFERENCE_STATS);

    expect(shadow.rating).toBe(base.rating);
    expect(shadow.fantasyPoints).toBe(base.fantasyPoints);
  });

  it('routes line-breaking passes to match_impact, final-third passes to influence, and net aerials to defensive', () => {
    const baseStats: RawStats = {
      ...SAMPLE_CB_CONCEDED,
      engine_version: 'v3',
      fpl_element_type: 2,
    };
    const withFotmob: RawStats = {
      ...baseStats,
      line_breaking_passes: 14,
      passes_into_final_third: 12,
      aerials_won: 6,
      aerials_lost: 1,
    };

    const base = calculateMatchRating(baseStats, 'CB', DEFAULT_REFERENCE_STATS);
    const shadow = calculateShadowPillar1Rating(withFotmob, 'CB', DEFAULT_REFERENCE_STATS);

    expect(findComp(shadow, 'match_impact').score).toBeGreaterThan(
      findComp(base, 'match_impact').score,
    );
    expect(findComp(shadow, 'influence').score).toBeGreaterThan(
      findComp(base, 'influence').score,
    );
    expect(findComp(shadow, 'defensive').score).toBeGreaterThan(
      findComp(base, 'defensive').score,
    );
    // Creativity is untouched by Pillar 1
    expect(findComp(shadow, 'creativity').score).toBe(findComp(base, 'creativity').score);
    expect(shadow.fantasyPoints).toBeGreaterThan(base.fantasyPoints);
  });
});
