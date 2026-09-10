/**
 * src/lib/projections/playerProjections.ts
 *
 * Calculates matchday projected points for an individual player given their
 * position, market value calibre, availability, and their club's fixture environment.
 *
 * Grounded in Gaffa's curved scoring engine (calculateFantasyPoints) and accounts
 * for non-linear minutes dampening and event bonuses.
 */

import type { GranularPosition } from '@/types';
import { GK_CURVE_SCALE } from '@/lib/scoring/matchRating';
import type { TeamMatchEnvironment } from './teamExpectations';

export interface PlayerProjectionInput {
  id?: string;
  primary_position: GranularPosition;
  market_value: number | null;
  fpl_status?: string | null;
  fpl_chance_next_round?: number | null;
  fpl_starts?: number | null;
  fpl_minutes?: number | null;
  minutesRole?: string;
  priorP90?: number | null;
}

const DEFENSIVE_POSITIONS = new Set<GranularPosition>(['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB']);
const FULLBACK_POSITIONS = new Set<GranularPosition>(['LB', 'RB', 'LWB', 'RWB']);

/**
 * Estimates expected minutes based on FPL availability status, Futbolpedia role,
 * position, and chance of playing next round.
 */
export function estimateExpectedMinutes(
  status: string | null | undefined,
  minutesRole: string | undefined,
  marketValue: number | null,
  position?: GranularPosition,
  chanceNextRound?: number | null,
): number {
  const code = (status ?? 'a').toLowerCase();
  // Injured, suspended, or inactive
  if (code === 'i' || code === 's' || code === 'u' || code === 'n') return 0;
  if (chanceNextRound === 0) return 0;

  let baseMinutes = 76;
  if (minutesRole === 'nailed') {
    baseMinutes = 84;
  } else if (minutesRole === 'likely_starter') {
    baseMinutes = 76;
  } else if (minutesRole === 'rotation_risk') {
    baseMinutes = position === 'GK' ? 0 : 35;
  } else if (minutesRole === 'fringe') {
    baseMinutes = position === 'GK' ? 0 : 12;
  } else if (marketValue != null && marketValue >= 40) {
    baseMinutes = 84;
  } else {
    baseMinutes = 76;
  }

  // FPL chance of playing next round percentage (e.g. 75%, 50%, 25%)
  if (chanceNextRound != null && chanceNextRound > 0 && chanceNextRound < 100) {
    baseMinutes *= chanceNextRound / 100;
  } else if (code === 'd') {
    baseMinutes *= 0.5;
  }

  return baseMinutes;
}

/**
 * Calculates projected fantasy points for a single player in a specific match.
 */
export function calculatePlayerProjectedPoints(
  player: PlayerProjectionInput,
  fixtureEnv: TeamMatchEnvironment,
): number {
  const expMinutes = estimateExpectedMinutes(
    player.fpl_status,
    player.minutesRole,
    player.market_value,
    player.primary_position,
    player.fpl_chance_next_round,
  );
  if (expMinutes <= 0) return 0.0;

  const pos = player.primary_position;
  const isGk = pos === 'GK';
  const isDef = DEFENSIVE_POSITIONS.has(pos);
  const isFb = FULLBACK_POSITIONS.has(pos);
  const isDm = pos === 'DM';
  const isCm = pos === 'CM';

  // Calibre normalizer (0.10 to 1.00) based on Transfermarkt valuation
  const mv = player.market_value ?? 15;
  const calibre = Math.min(1.0, Math.max(0.1, mv / 100));

  // Dominance ratio: territorial control and possession proxy (0.25 to 0.85)
  const totalExpectedGoals = fixtureEnv.expectedGoals + fixtureEnv.expectedConceded;
  const dominance = totalExpectedGoals > 0 ? fixtureEnv.expectedGoals / totalExpectedGoals : 0.50;

  // Goal and assist shares by position and calibre
  let xgShare = 0.02;
  let xaShare = 0.02;

  if (pos === 'ST') {
    xgShare = 0.28 + 0.16 * calibre;
    xaShare = 0.06 + 0.04 * calibre;
  } else if (pos === 'LW' || pos === 'RW') {
    xgShare = 0.18 + 0.14 * calibre;
    xaShare = 0.15 + 0.12 * calibre;
  } else if (pos === 'AM') {
    xgShare = 0.14 + 0.14 * calibre;
    xaShare = 0.18 + 0.14 * calibre;
  } else if (pos === 'CM') {
    xgShare = 0.06 + 0.05 * calibre;
    xaShare = 0.12 + 0.08 * calibre;
  } else if (pos === 'DM') {
    xgShare = 0.02 + 0.02 * calibre;
    xaShare = 0.05 + 0.05 * calibre;
  } else if (isFb) {
    xgShare = 0.03 + 0.03 * calibre;
    xaShare = 0.10 + 0.08 * calibre;
  } else if (pos === 'CB') {
    // Aerial set-piece threat in the box
    xgShare = 0.03 + 0.02 * calibre;
    xaShare = 0.01 + 0.01 * calibre;
  } else if (isGk) {
    xgShare = 0.0;
    xaShare = 0.0;
  }

  const pXg = fixtureEnv.expectedGoals * xgShare;
  const pXa = fixtureEnv.expectedGoals * xaShare;

  let baseRating = 6.65 + 0.20 * calibre;

  if (pos === 'CB') {
    // Centre-backs: clean sheet leverage + box aerial / clearance presence
    baseRating = 6.65 + 0.20 * calibre;
    baseRating += fixtureEnv.cleanSheetProb * 0.90;
    const excessConceded = Math.max(0, fixtureEnv.expectedConceded - 1.20);
    baseRating -= excessConceded * 0.30;
  } else if (isFb) {
    // Fullbacks: two-way involvement (crosses, carries, and clean sheets)
    baseRating = 6.60 + 0.25 * calibre;
    baseRating += fixtureEnv.cleanSheetProb * 0.85;
    baseRating += pXg * 0.80 + pXa * 0.60;
    const excessConceded = Math.max(0, fixtureEnv.expectedConceded - 1.20);
    baseRating -= excessConceded * 0.25;
  } else if (isDm) {
    // Holding midfielders: driven by possession dominance, passing volume, and duel control
    baseRating = 6.55 + 0.25 * calibre;
    const dominanceFactor = (dominance - 0.50) * 1.20;
    baseRating += dominanceFactor;
    baseRating += fixtureEnv.cleanSheetProb * 0.40;
    baseRating += pXg * 0.50 + pXa * 0.40;
  } else if (isCm) {
    // Central midfielders: box-to-box dominance, tempo control, and chance involvement
    baseRating = 6.55 + 0.25 * calibre;
    const dominanceFactor = (dominance - 0.50) * 1.00;
    baseRating += dominanceFactor;
    baseRating += pXg * 0.70 + pXa * 0.55;
  } else if (isGk) {
    // Goalkeepers: clean sheet + save volume
    baseRating = 6.55 + 0.20 * calibre;
    baseRating += fixtureEnv.cleanSheetProb * 0.80;
    const excessConceded = Math.max(0, fixtureEnv.expectedConceded - 1.20);
    baseRating -= excessConceded * 0.35;
  } else {
    // Attackers: driven by chance creation and defensive vulnerability
    baseRating = 6.50 + 0.25 * calibre;
    baseRating += pXg * 0.85 + pXa * 0.50;
  }

  // Linear map display rating -> scoring scale rating (1 + 9 * composite)
  const composite = (baseRating - 3.5) / 6.0;
  const scoringRating = 1.0 + 9.0 * Math.max(0, Math.min(1.0, composite));

  let curvePoints = 0;
  if (scoringRating > 4.0) {
    curvePoints = 8.6 * Math.pow((scoringRating - 4.0) / 2.0, 1.5);
  }

  // Flat bonuses (land after the curve, matching Gaffa's scoring engine)
  let flatBonuses = 0;
  if (isDef || isGk) {
    // Gaffa rewards clean sheets with 12-16 defensive points
    flatBonuses += fixtureEnv.cleanSheetProb * 4.5;
  } else if (isDm) {
    flatBonuses += fixtureEnv.cleanSheetProb * 2.0;
  }

  if (isGk) {
    curvePoints *= GK_CURVE_SCALE;
  }

  // Minutes dampener: linear minutes scaling for starters
  const minsRatio = expMinutes / 90;
  const minsFactor = Math.pow(minsRatio, 0.95);

  const total = (curvePoints + flatBonuses) * minsFactor;
  return Number(Math.max(0, total).toFixed(1));
}
