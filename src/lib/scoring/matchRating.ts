/**
 * Gaffa — Match Rating Engine
 *
 * Produces a 1-10 match rating from FPL live stats + API-Football metrics
 * using position-specific weight profiles.  The rating is then curved into
 * fantasy points.
 *
 * Pipeline
 * ────────
 *   Step 1  Normalize raw FPL metrics into 0.0–1.0 component scores (sigmoid)
 *   Step 2  Apply position-specific weights → weighted composite (0.0–1.0)
 *   Step 3  Linear map composite → 1.0–10.0 rating (with minutes cap)
 *   Step 4  Curve rating → fantasy points
 */

import type {
    GranularPosition,
    RawStats,
    MatchRating,
    RatingBreakdownItem,
    RatingComponent,
    PositionGroup,
    ReferenceStats,
} from '@/types';
import fotmobCenteringRates from './fotmobCenteringRates.json';

/**
 * First gameweek of the 2026-27 season scored under Gaffa Scoring Engine V3.
 * All appearances in earlier seasons (e.g. 2025-26) and 2026-27 GW1–5 stay under V2.
 */
export const V3_FIRST_GW = 6;
export const V3_CUTOVER_SEASON = '2026-27';

export function resolveEngineVersionForGameweek(
    season: string,
    gameweek: number,
): 'v2' | 'v3' {
    if (season > V3_CUTOVER_SEASON) return 'v3';
    if (season === V3_CUTOVER_SEASON && gameweek >= V3_FIRST_GW) return 'v3';
    return 'v2';
}

export function defaultElementTypeForPosition(pos: GranularPosition): number {
    const g = getPositionGroup(pos);
    return g === 'GK' ? 1 : g === 'DEF' ? 2 : g === 'MID' ? 3 : 4;
}

// Define ComponentScores type as it's used in the new code
type ComponentScores = Record<RatingComponent, number>;

// ════════════════════════════════════════════════════════════════════════════
// Position Weight Profiles (all 12 granular positions)
// ════════════════════════════════════════════════════════════════════════════

export const FLEX_CONFIG = {
    GK: { flex: 0.20, components: ['save_score', 'defensive'] },
    CB: { flex: 0.25, components: ['defensive', 'match_impact', 'goal_involvement'] },
    LB: { flex: 0.25, components: ['defensive', 'match_impact', 'goal_involvement'] },
    RB: { flex: 0.25, components: ['defensive', 'match_impact', 'goal_involvement'] },
    DM: { flex: 0.25, components: ['match_impact', 'influence', 'defensive'] },
    CM: { flex: 0.25, components: ['match_impact', 'creativity', 'influence'] },
    // Defensive and Match Impact are now included in LWB/RWB flex components
    // to ensure they get rewarded for clean sheets and solid defensive games just
    // like standard fullbacks, preventing quiet defensive games from dragging down
    // their scores while still allowing creative/attacking outputs to flex.
    LWB: { flex: 0.25, components: ['defensive', 'match_impact', 'creativity', 'threat', 'goal_involvement'] },
    RWB: { flex: 0.25, components: ['defensive', 'match_impact', 'creativity', 'threat', 'goal_involvement'] },
    AM: { flex: 0.25, components: ['creativity', 'goal_involvement', 'finishing'] },
    LW: { flex: 0.25, components: ['goal_involvement', 'threat', 'creativity'] },
    RW: { flex: 0.25, components: ['goal_involvement', 'threat', 'creativity'] },
    ST: { flex: 0.25, components: ['threat', 'goal_involvement', 'finishing'] },
} satisfies Record<GranularPosition, { flex: number; components: RatingComponent[] }>;

export const V3_FLEX_CONFIG: Record<GranularPosition, { flex: number; components: RatingComponent[] }> = {
    ...FLEX_CONFIG,
    CB: { flex: 0.25, components: ['defensive', 'match_impact', 'influence', 'goal_involvement'] },
    CM: { flex: 0.25, components: ['match_impact', 'creativity', 'influence', 'defensive'] },
};

//                                                                                                       Σ = 1.00
export const POSITION_WEIGHTS = {
    GK: { match_impact: 0.14, influence: 0.06, creativity: 0.00, threat: 0.00, defensive: 0.38, goal_involvement: 0.00, finishing: 0.00, save_score: 0.22 },
    CB: { match_impact: 0.30, influence: 0.05, creativity: 0.05, threat: 0.00, defensive: 0.25, goal_involvement: 0.05, finishing: 0.05, save_score: 0.00 },
    LB: { match_impact: 0.30, influence: 0.05, creativity: 0.10, threat: 0.00, defensive: 0.20, goal_involvement: 0.10, finishing: 0.00, save_score: 0.00 },
    RB: { match_impact: 0.30, influence: 0.05, creativity: 0.10, threat: 0.00, defensive: 0.20, goal_involvement: 0.10, finishing: 0.00, save_score: 0.00 },
    DM: { match_impact: 0.30, influence: 0.25, creativity: 0.05, threat: 0.00, defensive: 0.10, goal_involvement: 0.05, finishing: 0.00, save_score: 0.00 },
    CM: { match_impact: 0.20, influence: 0.15, creativity: 0.15, threat: 0.10, defensive: 0.05, goal_involvement: 0.10, finishing: 0.00, save_score: 0.00 },
    LWB: { match_impact: 0.25, influence: 0.05, creativity: 0.15, threat: 0.05, defensive: 0.15, goal_involvement: 0.10, finishing: 0.00, save_score: 0.00 },
    RWB: { match_impact: 0.25, influence: 0.05, creativity: 0.15, threat: 0.05, defensive: 0.15, goal_involvement: 0.10, finishing: 0.00, save_score: 0.00 },
    AM: { match_impact: 0.10, influence: 0.10, creativity: 0.25, threat: 0.15, defensive: 0.00, goal_involvement: 0.15, finishing: 0.00, save_score: 0.00 },
    LW: { match_impact: 0.15, influence: 0.05, creativity: 0.05, threat: 0.10, defensive: 0.00, goal_involvement: 0.15, finishing: 0.25, save_score: 0.00 },
    RW: { match_impact: 0.15, influence: 0.05, creativity: 0.05, threat: 0.10, defensive: 0.00, goal_involvement: 0.15, finishing: 0.25, save_score: 0.00 },
    ST: { match_impact: 0.15, influence: 0.10, creativity: 0.10, threat: 0.15, defensive: 0.00, goal_involvement: 0.15, finishing: 0.10, save_score: 0.00 },
} satisfies Record<GranularPosition, Record<RatingComponent, number>>;

export const V3_POSITION_WEIGHTS: Record<GranularPosition, Record<RatingComponent, number>> = {
    ...POSITION_WEIGHTS,
    CB: { match_impact: 0.25, influence: 0.10, creativity: 0.05, threat: 0.00, defensive: 0.30, goal_involvement: 0.05, finishing: 0.00, save_score: 0.00 },
};

// ════════════════════════════════════════════════════════════════════════════
// Position Group Mapping
// ════════════════════════════════════════════════════════════════════════════

export function getPositionGroup(pos: GranularPosition): PositionGroup {
    if (pos === 'GK') return 'GK';
    if (pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB') return 'DEF';
    if (pos === 'DM' || pos === 'CM' || pos === 'AM') return 'MID';
    return 'ATT'; // LW, RW, ST
}

// Helper to normalize position for FLEX_CONFIG and POSITION_WEIGHTS lookup
function normalizePosition(pos: GranularPosition): GranularPosition {
    // This function ensures that if a specific granular position isn't in the config,
    // a reasonable fallback is used. For now, it just returns the position itself,
    // assuming all granular positions are covered. If not, more complex logic
    // (e.g., mapping LB/RB to CB if no specific LB/RB config) would go here.
    return pos;
}

// ════════════════════════════════════════════════════════════════════════════
// Step 1 — Sigmoid Normalization (raw metric → 0-1)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Steepness of the sigmoid curve.
 * K=1.0 is the neutral value — the sigmoid maps ±1σ to ~0.73/0.27.
 * Increasing K widens the spread but inflates consistently-elite players
 * (e.g. creative AMs) too aggressively; 1.0 keeps ratings honest.
 */
const SIGMOID_K = 1.0;

// ════════════════════════════════════════════════════════════════════════════
// Cross-position normalization for event components
//
// Goal involvement (goals × 6 + assists × 4) and finishing (xG outperformance)
// must be evaluated on a COMMON scale across all positions.  Position-specific
// gi_stddev values range from 1.67 (LWB) to 3.76 (ST): this alone means a
// LWB assist (giRaw=4) outscores a ST 2-goal game (giRaw=12) in V2, which is
// the wrong result for a cross-position fantasy ranking.
//
// Pooled outfield gi_stddev (average of per-position values) ≈ 2.28. We use a
// slightly wider 2.5 to avoid over-rewarding occasional goal-scorers.
//
// Pooled finishing_stddev ≈ 0.28 (V1 used 0.15 which over-rewarded clinical
// finishing; V2 per-position ST value of 0.47 is far too wide). 0.28 is a
// reasonable middle ground.
// ════════════════════════════════════════════════════════════════════════════

/** Common goal-involvement scale used for ALL outfield positions. */
const GLOBAL_GI_STDDEV = 2.5;
/** Median gi_raw across all outfield positions (almost all games have 0). */
const GLOBAL_GI_MEDIAN = 0;
/** Common finishing (xG outperf) scale used for ALL positions. */
const GLOBAL_FINISHING_STDDEV = 0.28;
/** Median xG outperformance across all outfield positions. */
const GLOBAL_FINISHING_MEDIAN = -0.03;

/** Standard score: how many stddevs `value` sits from `median`. */
function computeZScore(value: number, median: number, stddev: number): number {
    if (stddev <= 0) return 0;
    return SIGMOID_K * (value - median) / stddev;
}

/**
 * Normalize a raw value to (0, 1) using the logistic sigmoid function.
 * A value at the median maps to 0.5; values beyond ±2 stddevs
 * compress toward 0 or 1.
 */
function sigmoidNormalize(value: number, median: number, stddev: number): number {
    if (stddev <= 0) return 0.5;
    return 1 / (1 + Math.exp(-computeZScore(value, median, stddev)));
}

// ════════════════════════════════════════════════════════════════════════════
// Component Display Names
// ════════════════════════════════════════════════════════════════════════════

const COMPONENT_DISPLAY = {
    match_impact: 'Match Impact',
    influence: 'Influence',
    creativity: 'Creativity',
    threat: 'Threat',
    defensive: 'Defensive',
    goal_involvement: 'Goal Involvement',
    finishing: 'Finishing',
    save_score: 'Save Score',
} satisfies Record<RatingComponent, string>;

// ════════════════════════════════════════════════════════════════════════════
// Step 1 implementation — Compute 9 per-component scores
// ════════════════════════════════════════════════════════════════════════════

interface ComponentResult {
    score: number;  // 0.0 – 1.0
    detail: string; // human-readable
    /** Standard score behind `score`. Only creativity sets this — it's what
     * the rare-feat kicker uses to detect an elite playmaking outlier. */
    z?: number;
}

function computeComponentScores(
    stats: RawStats,
    position: GranularPosition,
    refStats: Record<GranularPosition, ReferenceStats>,
    primaryPosition?: GranularPosition,
    pillar1Shadow = false,
) {
    const isV3 = stats.engine_version === 'v3' || pillar1Shadow;
    const ref = refStats[position]
        ?? (position === 'LWB' ? refStats.LB : undefined)
        ?? (position === 'RWB' ? refStats.RB : undefined)
        ?? refStats.CM
        ?? DEFAULT_REFERENCE_STATS[position]
        ?? DEFAULT_REFERENCE_STATS.CM;

    const defaultRefForPos = DEFAULT_REFERENCE_STATS[position] ?? DEFAULT_REFERENCE_STATS.CM;
    const miV3Ref = ref.match_impact_v3 ?? defaultRefForPos.match_impact_v3 ?? ref.match_impact;
    const defWorkRef = ref.defensive_work ?? defaultRefForPos.defensive_work ?? ref.defensive;

    const m = stats.minutes_played ?? 0;
    const rates = (fotmobCenteringRates.ratesPerMinute as Record<string, { lbpPerMin: number; pftPerMin: number; netAdPerMin: number }>)[position]
        ?? { lbpPerMin: 0, pftPerMin: 0, netAdPerMin: 0 };

    const deltaLbp = (pillar1Shadow && stats.line_breaking_passes !== undefined)
        ? (stats.line_breaking_passes - rates.lbpPerMin * m) * fotmobCenteringRates.weights.lineBreakingPassBps
        : 0;
    const deltaPft = (pillar1Shadow && stats.passes_into_final_third !== undefined)
        ? (stats.passes_into_final_third - rates.pftPerMin * m) * fotmobCenteringRates.weights.finalThirdPassInfluence
        : 0;
    const deltaNetAd = (pillar1Shadow && stats.aerials_won !== undefined && stats.aerials_lost !== undefined)
        ? ((stats.aerials_won - stats.aerials_lost) - rates.netAdPerMin * m) * fotmobCenteringRates.weights.netAerialDefensive
        : 0;

    // 1. Match Impact (BPS)
    const rawBps = stats.bps ?? 0;
    let adjustedBps: number;
    let miNormRef = ref.match_impact;
    if (isV3) {
        const elType = stats.fpl_element_type ?? defaultElementTypeForPosition(primaryPosition ?? position);
        const goalBpsUnit = elType <= 2 ? 12 : elType === 3 ? 18 : 24;
        const goalAssistBps = stats.goals * goalBpsUnit + stats.assists * 9;
        const defCsGcBps = elType === 2
            ? (((stats.clean_sheet && m >= 60) ? 12 : 0) - (stats.goals_conceded ?? 0) * 4)
            : 0;
        adjustedBps = Math.max(0, rawBps - goalAssistBps - defCsGcBps + deltaLbp);
        miNormRef = miV3Ref;
    } else {
        const goalAssistBps = stats.goals * 12 + stats.assists * 9;
        adjustedBps = Math.max(0, rawBps - goalAssistBps);
    }

    const matchImpact: ComponentResult = {
        score: sigmoidNormalize(adjustedBps, miNormRef.median, miNormRef.stddev),
        detail: `BPS: ${rawBps} (adj: ${Math.round(adjustedBps)})`,
    };

    // 2. Influence
    const infl = Math.max(0, (stats.influence ?? 0) + deltaPft);
    const influence: ComponentResult = {
        score: sigmoidNormalize(infl, ref.influence.median, ref.influence.stddev),
        detail: `${infl.toFixed(1)}`,
    };

    // 3. Creativity
    const crea = stats.creativity ?? 0;
    const creaZ = computeZScore(crea, ref.creativity.median, ref.creativity.stddev);
    const creativity: ComponentResult = {
        score: sigmoidNormalize(crea, ref.creativity.median, ref.creativity.stddev),
        detail: `${crea.toFixed(1)}`,
        z: creaZ,
    };

    // 4. Threat
    const thr = stats.threat ?? 0;
    const threat: ComponentResult = {
        score: sigmoidNormalize(thr, ref.threat.median, ref.threat.stddev),
        detail: `${thr.toFixed(1)}`,
    };

    // 5. Defensive Score
    const gc = stats.goals_conceded;
    const xgc = stats.expected_goals_conceded ?? 0;
    const posGroup = getPositionGroup(position);
    let csBonus = 0;
    if (stats.clean_sheet && stats.minutes_played >= 60) {
        let baseCs = 0;
        if (position === 'GK') {
            baseCs = 16; // Elevated Clean Sheet bonus for GK under Strategy A.4
        } else if (posGroup === 'DEF' || position === 'DM') {
            baseCs = 12; // Full bonus for DEF and DM
        } else if (position === 'CM') {
            baseCs = 4; // Reduced bonus for CM
        }
        
        // Option B: Capped CS strictly for AM playing at CB/LB/RB
        if (primaryPosition && primaryPosition === 'AM' && ['CB', 'LB', 'RB'].includes(position)) {
            csBonus = 0;
        } else {
            csBonus = baseCs;
        }
    }
    const canGetCS = csBonus > 0;
    const xgcOutperf = Math.max(0, xgc - gc) * 5;
    const gcPenalty = Math.max(0, gc - xgc) * 5;

    const tackles = Math.max(0, stats.fpl_tackles ?? 0);
    const cbi = Math.max(0, stats.fpl_cbi ?? 0);
    const recoveries = Math.max(0, stats.fpl_recoveries ?? 0);
    const dc = Math.max(0, stats.fpl_def_contrib ?? 0);

    let defActionsRaw: number;
    if (position === 'GK') {
        defActionsRaw = recoveries * 0.4;
    } else if (position === 'CB') {
        defActionsRaw = isV3
            ? tackles + cbi * 0.5 + recoveries * 0.5
            : tackles + cbi * 0.5;
    } else {
        // Symmetric 0.5x recoveries for all outfield positions to reward active
        // defending (tackles + cbi) and prevent low-block recovery farming.
        defActionsRaw = (tackles + cbi) + recoveries * 0.5;
    }

    let defensiveScore: number;
    if (position === 'GK') {
        let gkCsVal = 0;
        const sv = Math.max(0, stats.saves ?? 0);
        if (stats.clean_sheet && canGetCS) {
            gkCsVal = GK_CLEAN_SHEET + Math.min(GK_CLEAN_SHEET_SAVE_CAP, sv * 1.0);
        }
        const xgcDiff = Math.max(-2.5, Math.min(2.5, xgc - gc));
        let zeroSavePenalty = 0;
        if (!stats.clean_sheet && sv === 0 && gc >= 1) {
            zeroSavePenalty = 4.5 * gc;
        }
        const defensiveRaw = defActionsRaw + gkCsVal - gc * GK_GOAL_CONCEDED + xgcDiff * GK_XGC_DIFF - zeroSavePenalty;
        defensiveScore = sigmoidNormalize(defensiveRaw, ref.defensive.median, ref.defensive.stddev);
    } else if (isV3 && (posGroup === 'DEF' || position === 'DM')) {
        // V3: Normalize pure defensive work against defensive_work reference stats,
        // then apply the clean-sheet offset in z-space: sigmoid(z_work + c_pos).
        const defWorkRaw = defActionsRaw + deltaNetAd + xgcOutperf - gcPenalty;
        const zWork = computeZScore(defWorkRaw, defWorkRef.median, defWorkRef.stddev);
        const cPos = (stats.clean_sheet && canGetCS)
            ? (position === 'CB' ? 1.70 : position === 'DM' ? 1.05 : 1.32)
            : 0;
        defensiveScore = 1 / (1 + Math.exp(-(zWork + cPos)));
    } else {
        const defNormRef = isV3 ? defWorkRef : ref.defensive;
        const defensiveRaw = defActionsRaw + deltaNetAd + csBonus + xgcOutperf - gcPenalty;
        defensiveScore = sigmoidNormalize(defensiveRaw, defNormRef.median, defNormRef.stddev);
    }

    const defensive: ComponentResult = {
        score: defensiveScore,
        detail: position === 'GK'
            ? (stats.clean_sheet && canGetCS)
                ? `CS, R ${recoveries}`
                : `R ${recoveries}`
            : (stats.clean_sheet && canGetCS)
                ? `CS, ${gc} conceded vs ${xgc.toFixed(1)} xGC (DC ${dc}, T ${tackles}, CBI ${cbi}, R ${recoveries})`
                : `${gc} conceded vs ${xgc.toFixed(1)} xGC (DC ${dc}, T ${tackles}, CBI ${cbi}, R ${recoveries})`,
    };



    // 7. Goal Involvement  (goals × 6 + assists × 4 — mirrors on-pitch impact)
    const g = stats.goals;
    const a = stats.assists;
    const goalInvRaw = g * 6 + a * 4;

    const goalParts: string[] = [];
    if (g > 0) goalParts.push(`${g} goal(s)`);
    if (a > 0) goalParts.push(`${a} assist(s)`);

    const goalInvolvement: ComponentResult = {
        score: sigmoidNormalize(goalInvRaw, GLOBAL_GI_MEDIAN, GLOBAL_GI_STDDEV),
        detail: goalParts.length > 0 ? goalParts.join(', ') : 'No goals or assists',
    };

    const xg = stats.expected_goals ?? 0;
    const xa = stats.expected_assists ?? 0;
    const xgOutperf = g - xg;
    const xaOutperf = a - xa;
    const finInput = xgOutperf + (xaOutperf * 0.5);

    const finishing: ComponentResult = {
        score: sigmoidNormalize(finInput, GLOBAL_FINISHING_MEDIAN, GLOBAL_FINISHING_STDDEV),
        detail: `${xgOutperf >= 0 ? '+' : ''}${xgOutperf.toFixed(2)} vs xG, ${xaOutperf >= 0 ? '+' : ''}${xaOutperf.toFixed(2)} vs xA`,
    };

    // 9. Save Score (GK-only — non-GKs get a neutral 0.5)
    let saveScore: ComponentResult;
    if (position === 'GK') {
        const sv = Math.max(0, stats.saves ?? 0);
        const psav = Math.max(0, stats.penalty_saves ?? 0);
        const shotsFaced = sv + gc;

        let matchSavePct = 0.70;
        if (shotsFaced > 0) {
            matchSavePct = sv / shotsFaced;
        } else if (stats.clean_sheet && canGetCS) {
            matchSavePct = 1.0;
        }

        const saveVolRaw = sv * 2.5 + psav * 6;
        const saveVolScore = sigmoidNormalize(saveVolRaw, ref.save_score.median, ref.save_score.stddev);
        const savePctScore = sigmoidNormalize(matchSavePct, 0.70, 0.15);
        const scoreVal = saveVolScore * 0.45 + savePctScore * 0.55;

        saveScore = {
            score: scoreVal,
            detail: `${sv} save(s)${psav > 0 ? `, ${psav} pen save(s)` : ''}`,
        };
    } else {
        saveScore = { score: 0.5, detail: '—' };
    }

    return {
        match_impact: matchImpact,
        influence,
        creativity,
        threat,
        defensive,
        goal_involvement: goalInvolvement,
        finishing,
        save_score: saveScore,
    } satisfies Record<RatingComponent, ComponentResult>;
}

// ════════════════════════════════════════════════════════════════════════════
// Step 2 — Apply Position Weights → weighted composite (0-1)
// ════════════════════════════════════════════════════════════════════════════

export function applyPositionWeights(
    scores: ComponentScores,
    position: GranularPosition,
    isV3 = false,
) {
    const normalizedPos = normalizePosition(position);
    const weightTable = isV3 ? V3_POSITION_WEIGHTS : POSITION_WEIGHTS;
    const flexTable = isV3 ? V3_FLEX_CONFIG : FLEX_CONFIG;
    const weights = weightTable[normalizedPos] || weightTable.CM;
    const flexConfig = flexTable[normalizedPos] || flexTable.CM;

    let maxScore = -1;
    let maxComponent: RatingComponent | '' = '';

    for (const key of flexConfig.components) {
        if (scores[key] > maxScore) {
            maxScore = scores[key];
            maxComponent = key;
        }
    }

    let composite = 0;
    const breakdown: RatingBreakdownItem[] = [];

    for (const key of Object.keys(weights) as RatingComponent[]) {
        const weight = weights[key];

        let finalWeight = weight;
        if (key === maxComponent) {
            finalWeight += flexConfig.flex;
        }

        if (finalWeight === 0) continue;

        const score = scores[key];
        const weighted = score * finalWeight;
        composite += weighted;

        // For breakdown, we need the original score and the final weight applied
        breakdown.push({
            component: COMPONENT_DISPLAY[key],
            key,
            score,
            weight: finalWeight, // Use finalWeight for breakdown
            weighted,
            detail: '', // Detail is not available here, would need to be passed from computeComponentScores
        });
    }

    return { composite: Math.min(1.0, composite), breakdown } satisfies {
        composite: number;
        breakdown: RatingBreakdownItem[];
    };
}

// ════════════════════════════════════════════════════════════════════════════
// Step 3 & 4 — Rating display + Fantasy Points
//
// Two separate scales exist:
//
//  • SCORING SCALE  (internal, unchanged)  1.0 + 9.0 × composite → [1, 10]
//    Used only as the input to calculateFantasyPoints so the points curve
//    calibration is never disturbed.
//
//  • DISPLAY SCALE  (curveFinalRating, exported)  3.0 + 7.0 × composite
//    Shifted so the median player (composite ≈ 0.50) lands near 6.5,
//    matching the Fotmob / SofaScore rating distribution that fans expect.
//    Top performers reach 8–9, poor games dip to 5.0–6.0.
//
// Fantasy points are intentionally decoupled from the display rating so
// that aesthetic re-calibration of the display never changes game balance.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Internal scoring-scale rating, used only to feed calculateFantasyPoints.
 * Never stored or shown in the UI — curveFinalRating() is the display value.
 */
function computeScoringRating(composite: number, minutesPlayed: number): number {
    if (composite < 0 || minutesPlayed === 0) return 0;
    const r = 1.0 + 9.0 * composite;
    return Math.max(1.0, Math.min(10.0, r));
}

/**
 * Display rating on the 1–10 scale shown to users.
 * 3.0 + 7.0 × composite maps the median composite (~0.50) to ≈ 6.5,
 * consistent with Fotmob/SofaScore where average PL starters rate 6.0–6.5.
 */
export function curveFinalRating(composite: number, minutesPlayed: number): number {
    if (composite < 0 || minutesPlayed === 0) return 0;

    // Compressed scale: keeps the 6.5 median starter floor, cools the elite averagers
    // down to 8.0, and elevates the absolute floor to 3.5 (matching Fotmob/SofaScore).
    const rating = 3.5 + 6.0 * composite;

    return Math.max(1.0, Math.min(10.0, rating));
}

/**
 * Rare-feat bonus — flat points added AFTER the curve, for the handful of
 * performances the sigmoid pipeline structurally cannot separate once
 * several correlated components have already saturated near 1.0.
 *
 * Diagnosed 2026-08: real median-by-rating ST games rated 6.44 (0G) / 8.34
 * (1G) / 8.99 (2G) / 9.16 (3G) — by 2 goals, match_impact/influence/threat/
 * goal_involvement/finishing are ALL independently past 90-99% of their own
 * ceiling (they all correlate with "scored a lot"), so a 3rd goal has almost
 * nowhere left to register. Widening goal_involvement's own stddev doesn't
 * fix it — tripling it only grew the 2-vs-3-goal gap from 0.17 to 0.28
 * rating while dragging every scoring game down with it. The fix has to
 * live outside the saturated components entirely.
 *
 * WHY POINTS AND NOT COMPOSITE (changed 2026-08-25, see
 * docs/superpowers/specs/2026-08-25-rare-feat-bonus-design.md).
 * The first version of this bumped the COMPOSITE, consuming a fraction of
 * the remaining headroom toward 1.0. Composite 1.0 maps to 44.69 points, so
 * that design could never separate the games it existed to separate:
 * measured at the composite a real hat-trick reaches (~0.94), a hat-trick
 * paid 42.47 and a five-goal-two-assist game 44.58 — 2.9 points apart with
 * the ceiling doing all the work. It reproduced, one tier up, exactly the
 * compression it was built to remove.
 *
 * Worse, spending *remaining* headroom paid a BIGGER bonus to a WORSE
 * supporting performance: the same 2G+1A was worth +7.24 off a 0.84
 * composite and +2.90 off a 0.94 one. A hat-trick should be worth a
 * hat-trick regardless of how the other eighty minutes went.
 *
 * Adding flat points after the curve fixes both. Nothing fights composite's
 * cap, every increment is worth the same wherever it lands, and the scale is
 * unbounded. The feat range spreads from 2.89 points to 11.00.
 *
 * The display rating deliberately does NOT receive this. A hat-trick reads
 * 9.14 rather than 9.37; that is a realistic match rating for one, and one
 * mechanism is worth more than 0.21 of display rating.
 *
 * `excess` is continuous, not an event count — "1 goal + 2 assists" is past
 * the goal-involvement line on combined raw value even though neither stat
 * alone reaches 3, so it must count.
 *
 * Checked before landing on these two triggers: goalkeeping doesn't need one
 * (a 10-save clean sheet already rates 9.17), defense doesn't either (the
 * season's best defensive day sits at 96.6% of ceiling with real separation
 * still visible below it), and match_impact/influence don't need their own
 * since every extreme case in the data is already either a hat-trick
 * (covered here) or elite goalkeeping (already fine).
 */

/** Points per unit of excess. Sized so a hat-trick pays +3.25, which is
 * inside the "usually 3 to 5 extra points" docs/USER_GUIDE.md publishes —
 * the common case needs no guide change. */
const FEAT_POINTS_PER_UNIT = 3.0;

/** Raw goal_involvement (goals×6 + assists×4) above which a feat has fired.
 * 2 goals or 3 assists alone already clear it. */
export const FEAT_GI_SATURATION_RAW = 11.5;
/** One unit of goal-involvement excess — i.e. one goal. */
export const FEAT_GI_UNIT = 6;

/** Raw FPL creativity above which a creative feat has fired.
 *
 * Was a positional z-score of 3.9 until 2026-08-25, which was measuring the
 * wrong thing entirely. A z-score asks "unusual FOR THIS POSITION", and for a
 * position that never creates, unusual is one decent ball: clearing z 3.9
 * needed raw creativity of 94.1 as an AM, 26.1 as a CB and 8.2 as a GK. Over
 * 2025-26 it fired 96 times in 11,355 appearances (2.53/gw — more often than
 * the goal trigger), and 54 of those 96 were goalkeepers and centre-backs
 * against 13 for all four playmaking positions combined. Keepers were kept
 * out only by the unrelated `posWeights.creativity > 0` gate at the call
 * site; centre-backs weight creativity at 0.05 and were being paid.
 *
 * An absolute bar self-selects for playmakers with no position rule at all —
 * no centre-back reached 90 all season. At 90 it fires 11 times a year
 * (0.29/gw): Bruno ×3, Longstaff, Foden, Enzo, Groß, Anderson, Cherki,
 * Pedro Porro, Szoboszlai. */
export const FEAT_CREATIVITY_RAW = 90;
/** One unit of creative excess. Calibrated so the season's best creative
 * game (Bruno, 106.8 → 1.12 units → +3.36) is worth about what a hat-trick
 * is worth (+3.25). That parity is the argument for this number. */
export const FEAT_CREATIVITY_UNIT = 15;

/**
 * How far past the rare-feat bars this appearance went, in units.
 *
 * Exported because three surfaces need the SAME number: the engine (to pay the
 * bonus), the player card and the matchup breakdown (to promote a performance
 * block's row past the ordinary band scale). They each had their own inline
 * copy of this arithmetic, and the card's copy had already drifted — it left
 * out the positional gates below, so it would have credited a feat to a
 * position that is not scored on the component that produced it.
 *
 * BOTH GATES STAY. "A component weighted 0.00 for a position must never move
 * that position's score" is structural; resting it on "the data says it cannot
 * happen" is weaker than resting it on "the code says it cannot". The golden
 * suite enforces this for goalkeeper creativity.
 */
export function featExcessFor(
    stats: Pick<RawStats, 'goals' | 'assists' | 'creativity'>,
    position: GranularPosition,
): number {
    const posWeights = POSITION_WEIGHTS[position] ?? POSITION_WEIGHTS.CM;
    let excess = 0;
    if (posWeights.goal_involvement > 0) {
        const goalInvRaw = Number(stats.goals ?? 0) * 6 + Number(stats.assists ?? 0) * 4;
        excess += Math.max(0, goalInvRaw - FEAT_GI_SATURATION_RAW) / FEAT_GI_UNIT;
    }
    if (posWeights.creativity > 0) {
        excess += Math.max(0, Number(stats.creativity ?? 0) - FEAT_CREATIVITY_RAW) / FEAT_CREATIVITY_UNIT;
    }
    return excess;
}

/** Flat points for a rare feat. Never negative, unbounded above. */
function featPointsBonus(excess: number): number {
    if (excess <= 0) return 0;
    return FEAT_POINTS_PER_UNIT * excess;
}

/**
 * Fantasy points from the SCORING-scale rating (1 + 9×composite), never the
 * display rating. Calibration: base=0.0, scale=8.6, pivot=4.0, exponent=1.5.
 *
 * Because the two scales differ (display = 3.5 + 6×composite), the points a
 * user sees against a rating on the card are NOT this function's input. In
 * display terms the curve is:
 *
 *   display   5.5    6.0    6.5    7.0    7.5    8.0    9.0
 *   points    0.00   1.98   5.59   10.26  15.80  22.07  36.58
 *
 * Two consequences worth preserving. A display rating at or below **5.5**
 * pays exactly zero — composite 0.333 maps to scoring 4.0, the pivot — so a
 * below-par game is worth nothing rather than a little. And the curve is
 * convex: 7.0 → 8.0 is worth more than 6.0 → 7.0, so one decisive performance
 * outweighs several adequate ones. Composite is clamped to [0, 1], so the
 * ceiling is a display 9.5 / scoring 10.0 ≈ 44.7 pts.
 *
 * Was pivot=4.5/scale=10.0 (zero-line at display 5.83) until 2026-08-24: a
 * merely-decent game (6.0-6.5, well below the 6.5 median-starter floor but
 * clearly not a poor one) was scoring next to nothing — a 6.23 paid ~1.6,
 * indistinguishable from a genuinely bad game. Lowering the pivot to 4.0 and
 * rescaling to 8.6 moves the zero-line down to 5.5 and lifts every rating
 * above it, while holding the elite ceiling (9.0+) roughly where it was.
 *
 * Changing base/scale/pivot/exponent silently rewrites every historical
 * comparison — see scripts/backfill-scoring-v2.mjs and docs/USER_GUIDE.md §4,
 * which publishes the table above to players.
 */
/**
 * Goalkeeper `defensive` knobs.
 *
 * These four decide how much of a keeper's rating is the scoreline and how much
 * is his own work. Before 2026-08-23 they were 20 / 4.2 / 2.5 / 4, which made
 * the clean sheet so dominant that the component stopped discriminating: 193
 * clean sheets in 2025-26 produced ratings with a standard deviation of 0.21.
 *
 * Fitted against all 767 keeper appearances of that season, against SEASON-level
 * targets rather than per-match dispersion. A first attempt optimised per-match
 * spread alone (clean sheet 5, conceded 2.6, xGC 4.5, weights 0.34/0.26) and got
 * the per-match behaviour right while wrecking the leaderboard: cutting the
 * clean sheet that hard removed what actually separates keepers over 38 games,
 * so season-average spread fell from 0.271 to 0.181 and the best keepers were
 * hit hardest — Raya 7.14 to 6.58, Donnarumma 7.21 to 6.76. Per-match spread was
 * the wrong objective; how keepers rank across a season is the visible one.
 *
 * These values keep both: season mean 6.67 against the old 6.72, and per-match
 * spread among clean sheets 0.34 against the old 0.21 — so an earned shutout
 * still separates from an untroubled one. Season spread lands at 0.19 against
 * the old 0.271; keepers sit slightly closer together over a season than they
 * did, which is the residual cost of the clean sheet counting for less.
 *
 * Note the weights are constrained: match_impact 0.14 + influence 0.06 +
 * defensive + save_score + the 0.20 flex must total exactly 1.00, so defensive
 * and save_score have to sum to 0.60. weights.test.ts enforces it.
 */
export const GK_CLEAN_SHEET = 20;
/**
 * Was 10, exactly the season's max recorded save count (José Sá, 10 saves,
 * clean sheet) — meaning no real game could ever have earned more from this
 * term. Raised to comfortably clear that ceiling while staying a real cap,
 * not removed: this term is a raw linear addition with no sigmoid (unlike
 * save_score's own volume term, whose "uncapped" is tempered by one), so an
 * uncapped version reopens exactly the runaway-clean-sheet risk this
 * component was rebuilt to close (see the comment above GK_CLEAN_SHEET).
 */
export const GK_CLEAN_SHEET_SAVE_CAP = 16;
export const GK_GOAL_CONCEDED = 3.4;
export const GK_XGC_DIFF = 2.5;

/**
 * Keeper curve output is scaled by this before it becomes points.
 *
 * Was 0.72 and briefly deleted. Keeper composite is genuinely more dispersed
 * than an outfielder's even once the rating is fixed, and a convex points curve
 * turns spread into points, so some scaling is needed to keep the two positions
 * level. At 0.80 keepers average 7.27 points an appearance, exactly matching
 * outfielders. Deleting it entirely is only possible by flattening the rating so
 * far that the leaderboard stops distinguishing keepers at all.
 */
export const GK_CURVE_SCALE = 0.84;
export const V3_GK_CURVE_SCALE = 0.85;

export function calculateFantasyPoints(rating: number, minutesPlayed: number): number {
    if (minutesPlayed === 0 || rating === 0) return 0;

    const basePoints = 0.0;
    const scale = 8.6;

    const curve = Math.pow(Math.max(0, rating - 4.0) / 2.0, 1.5);
    const finalPoints = basePoints + (scale * curve);

    return Math.max(0, Number(finalPoints.toFixed(2)));
}

// ════════════════════════════════════════════════════════════════════════════
// Default Reference Stats — offline fallback only
//
// Per-position medians/stddevs for each component's raw input. At runtime the
// `rating_reference_stats` table (filled by `scripts/recompute_reference_stats.mjs`
// from the current season's FPL `event/{gw}/live` + our `players.primary_position`)
// overrides these via `loadReferenceStats()`.
//
// Older idea was multi-season vaastav/merged_gw CSVs; that path does not carry
// 25/26 granular defense or `defensive_contribution`, so it cannot match this
// engine's defensive raw input. Multi-season baselines would need a bespoke merge.
// ════════════════════════════════════════════════════════════════════════════

function makeRef(
    mi: [number, number], inf: [number, number], cre: [number, number],
    thr: [number, number], def: [number, number], 
    gi: [number, number], fin: [number, number], sav: [number, number],
    miV3?: [number, number], defWork?: [number, number],
): ReferenceStats {
    return {
        match_impact: { median: mi[0], stddev: mi[1] },
        influence: { median: inf[0], stddev: inf[1] },
        creativity: { median: cre[0], stddev: cre[1] },
        threat: { median: thr[0], stddev: thr[1] },
        defensive: { median: def[0], stddev: def[1] },
        goal_involvement: { median: gi[0], stddev: gi[1] },
        finishing: { median: fin[0], stddev: fin[1] },
        save_score: { median: sav[0], stddev: sav[1] },
        ...(miV3 ? { match_impact_v3: { median: miV3[0], stddev: miV3[1] } } : {}),
        ...(defWork ? { defensive_work: { median: defWork[0], stddev: defWork[1] } } : {}),
    };
}

// Per-position medians and stddevs for each rating-component raw input.
// These are FALLBACK values used only when the DB `rating_reference_stats`
// table is empty (e.g., a fresh deploy before the first sync). At runtime,
// `loadReferenceStats()` in src/lib/scoring/matchups.ts overlays the live DB
// values on top of these.
//
// Refresh: re-run `node scripts/recompute_reference_stats.mjs` whenever:
//   - A new season has accumulated >5 GWs of data
//   - The engine's raw-input formulas change (especially defensive)
//   - The 12-position taxonomy changes
//
// Values below were generated from 2025-26 FPL live data (GW1-35, minutes>=45).
//                 match_impact   influence      creativity     threat         defensive       goal_invol     finishing       save_score       match_impact_v3   defensive_work
export const DEFAULT_REFERENCE_STATS = {
    GK:  makeRef([12.00, 10.17], [21.00, 12.42], [ 0.00,  2.08], [ 0.00,  1.29], [ 2.950, 16.416], [0.00, 0.33], [ 0.000, 0.04], [ 7.500,  5.429], [12.00, 10.1770], [3.90, 10.6710]),
    CB:  makeRef([10.00,  9.84], [20.00, 11.85], [ 1.40,  6.41], [ 2.00, 10.33], [ 8.80,  9.19], [0.00, 1.55], [-0.010, 0.22], [0.00, 1.00], [15.00,  5.0218], [6.65,  5.6163]),
    LB:  makeRef([10.00,  9.86], [14.80, 10.64], [ 8.30, 12.79], [ 2.00,  8.82], [12.45,  9.79], [0.00, 1.66], [-0.020, 0.22], [0.00, 1.00], [13.00,  6.0609], [7.65,  6.3814]),
    RB:  makeRef([10.00,  9.86], [14.80, 10.64], [ 8.30, 12.79], [ 2.00,  8.82], [12.45,  9.79], [0.00, 1.66], [-0.020, 0.22], [0.00, 1.00], [13.00,  6.0345], [8.30,  6.5056]),
    LWB: makeRef([10.00,  9.86], [14.80, 10.64], [ 8.30, 12.79], [ 2.00,  8.82], [12.45,  9.79], [0.00, 1.66], [-0.020, 0.22], [0.00, 1.00], [14.00,  6.7317], [7.75,  5.6987]),
    RWB: makeRef([10.00,  9.86], [14.80, 10.64], [ 8.30, 12.79], [ 2.00,  8.82], [12.45,  9.79], [0.00, 1.66], [-0.020, 0.22], [0.00, 1.00], [13.00,  5.8335], [6.90,  5.2505]),
    DM:  makeRef([14.00,  6.57], [13.40, 12.96], [10.50, 13.26], [ 2.00,  9.62], [18.30,  7.44], [0.00, 2.06], [-0.025, 0.28], [0.00, 1.00], [14.00,  6.1030], [7.45,  6.0772]),
    CM:  makeRef([13.00,  6.71], [12.00, 14.24], [15.00, 15.81], [ 6.00, 11.59], [14.50,  5.60], [0.00, 2.46], [-0.045, 0.32], [0.00, 1.00], [13.00,  6.2785], [6.10,  6.8318]),
    AM:  makeRef([12.00,  7.69], [11.20, 19.28], [17.10, 19.55], [12.00, 15.09], [11.50,  5.49], [0.00, 3.40], [-0.065, 0.45], [0.00, 1.00], [11.00,  6.4539], [4.70,  5.5126]),
    LW:  makeRef([10.00,  7.02], [ 9.60, 16.12], [15.20, 15.29], [14.00, 15.63], [10.60,  4.95], [0.00, 2.91], [-0.065, 0.39], [0.00, 1.00], [ 9.00,  6.1565], [4.15,  5.0686]),
    RW:  makeRef([10.00,  7.02], [ 9.60, 16.12], [15.20, 15.29], [14.00, 15.63], [10.60,  4.95], [0.00, 2.91], [-0.065, 0.39], [0.00, 1.00], [ 9.00,  6.1565], [4.15,  5.0686]),
    ST:  makeRef([ 6.00,  9.21], [ 6.80, 20.62], [ 6.10,  9.30], [19.00, 21.93], [ 9.00,  4.29], [0.00, 3.77], [-0.050, 0.47], [0.00, 1.00], [ 5.00,  4.7820], [3.25,  5.0617]),
} satisfies Record<GranularPosition, ReferenceStats>;

// ════════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ════════════════════════════════════════════════════════════════════════════

function calculateMatchRatingInternal(
    stats: RawStats,
    position: GranularPosition,
    refStats: Record<GranularPosition, ReferenceStats> = DEFAULT_REFERENCE_STATS,
    primaryPosition?: GranularPosition,
    pillar1Shadow = false,
): MatchRating {
    // Player didn't play → zero rating
    if (stats.minutes_played === 0) {
        return { rating: 0, fantasyPoints: 0, position, breakdown: [] };
    }

    const isV3 = stats.engine_version === 'v3' || pillar1Shadow;

    // Step 1: Normalize each component to 0-1 via sigmoid
    const components = computeComponentScores(stats, position, refStats, primaryPosition, pillar1Shadow);

    const scores: ComponentScores = {} as ComponentScores;
    for (const [k, v] of Object.entries(components)) {
        scores[k as RatingComponent] = v.score;
    }

    // Step 2: Weighted composite
    const { composite, breakdown } = applyPositionWeights(scores, position, isV3);

    // Add detail to breakdown
    for (const item of breakdown) {
        item.detail = components[item.key as RatingComponent].detail;
    }

    const featExcess = featExcessFor(stats, position);

    // Step 3: Display rating (Fotmob-calibrated scale for UI). Deliberately
    // takes the RAW composite — the feat bonus is a points-scale reward.
    let rating = curveFinalRating(composite, stats.minutes_played);

    // Step 4: Fantasy points — uses internal scoring scale (1+9×composite),
    // completely decoupled from the display rating so points calibration is
    // never affected by display-scale adjustments.
    const scoringRating = computeScoringRating(composite, stats.minutes_played);
    let fantasyPoints = calculateFantasyPoints(scoringRating, stats.minutes_played);

    // Keeper curve output is scaled so the two positions bank the same points on
    // average — see GK_CURVE_SCALE / V3_GK_CURVE_SCALE.
    if (position === 'GK') {
        fantasyPoints *= isV3 ? V3_GK_CURVE_SCALE : GK_CURVE_SCALE;
    }

    fantasyPoints += featPointsBonus(featExcess);

    // Out-of-Position (OOP) penalty:
    // If a player's primary role is a midfielder or attacker (DM, CM, AM, LW, RW, ST)
    // and they are slotted into a defensive position (CB, LB, RB, LWB, RWB), apply a 20% penalty
    // to account for baseline-mismatch volume inflation.
    const isMidOrAtt = ['DM', 'CM', 'AM', 'LW', 'RW', 'ST'].includes(primaryPosition || '');
    const isDefSlot = ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position);
    if (primaryPosition && isMidOrAtt && isDefSlot) {
        rating = rating * 0.80;
        fantasyPoints = fantasyPoints * 0.80;
    }

    return {
        rating: Math.round(rating * 100) / 100,
        fantasyPoints: Math.round(fantasyPoints * 100) / 100,
        position,
        breakdown,
    };
}

export function calculateMatchRating(
    stats: RawStats,
    position: GranularPosition,
    refStats: Record<GranularPosition, ReferenceStats> = DEFAULT_REFERENCE_STATS,
    primaryPosition?: GranularPosition,
): MatchRating {
    return calculateMatchRatingInternal(stats, position, refStats, primaryPosition, false);
}

/**
 * Computes the Pillar 1 shadow score (V3 + centered FotMob line-breaking passes,
 * passes into final third, and net aerial duels) for storage on `stats` JSON.
 */
export function calculateShadowPillar1Rating(
    stats: RawStats,
    position: GranularPosition,
    refStats: Record<GranularPosition, ReferenceStats> = DEFAULT_REFERENCE_STATS,
    primaryPosition?: GranularPosition,
): MatchRating {
    return calculateMatchRatingInternal(stats, position, refStats, primaryPosition, true);
}
