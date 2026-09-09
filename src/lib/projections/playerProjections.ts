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
  minutesRole?: string;
  priorP90?: number | null;
}

const DEFENSIVE_POSITIONS = new Set<GranularPosition>(['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB']);
const FULLBACK_POSITIONS = new Set<GranularPosition>(['LB', 'RB', 'LWB', 'RWB']);

/**
 * Estimates expected minutes based on FPL availability status and Futbolpedia role.
 */
export function estimateExpectedMinutes(
  status: string | null | undefined,
  minutesRole: string | undefined,
  marketValue: number | null,
): number {
  const code = (status ?? 'a').toLowerCase();
  // Injured, suspended, or inactive
  if (code === 'i' || code === 's' || code === 'u' || code === 'n') return 0;

  let baseMinutes = 76;
  if (minutesRole === 'nailed') baseMinutes = 84;
  else if (minutesRole === 'likely_starter') baseMinutes = 76;
  else if (minutesRole === 'rotation_risk') baseMinutes = 38;
  else if (minutesRole === 'fringe') baseMinutes = 15;
  else if (marketValue != null && marketValue >= 40) baseMinutes = 84;
  else baseMinutes = 76;

  // Doubtful status (75% or 50% chance of playing)
  if (code === 'd') baseMinutes *= 0.5;

  return baseMinutes;
}

/**
 * Calculates projected fantasy points for a single player in a specific match.
 */
export function calculatePlayerProjectedPoints(
  player: PlayerProjectionInput,
  fixtureEnv: TeamMatchEnvironment,
): number {
  const expMinutes = estimateExpectedMinutes(player.fpl_status, player.minutesRole, player.market_value);
  if (expMinutes <= 0) return 0.0;

  const pos = player.primary_position;
  const isGk = pos === 'GK';
  const isDef = DEFENSIVE_POSITIONS.has(pos);
  const isFb = FULLBACK_POSITIONS.has(pos);

  // Calibre normalizer (0.10 to 1.00) based on Transfermarkt valuation
  const mv = player.market_value ?? 15;
  const calibre = Math.min(1.0, Math.max(0.1, mv / 100));

  // Goal and assist shares by position and calibre
  let xgShare = 0.03;
  let xaShare = 0.03;

  if (pos === 'ST') {
    xgShare = 0.28 + 0.14 * calibre;
    xaShare = 0.06 + 0.04 * calibre;
  } else if (pos === 'LW' || pos === 'RW') {
    xgShare = 0.18 + 0.12 * calibre;
    xaShare = 0.15 + 0.10 * calibre;
  } else if (pos === 'AM') {
    xgShare = 0.14 + 0.12 * calibre;
    xaShare = 0.17 + 0.12 * calibre;
  } else if (pos === 'CM') {
    xgShare = 0.06 + 0.04 * calibre;
    xaShare = 0.10 + 0.06 * calibre;
  } else if (pos === 'DM') {
    xgShare = 0.02 + 0.02 * calibre;
    xaShare = 0.04 + 0.04 * calibre;
  } else if (isFb) {
    xgShare = 0.03 + 0.02 * calibre;
    xaShare = 0.09 + 0.06 * calibre;
  } else if (pos === 'CB') {
    xgShare = 0.02 + 0.01 * calibre;
    xaShare = 0.01 + 0.01 * calibre;
  } else if (isGk) {
    xgShare = 0.0;
    xaShare = 0.0;
  }

  const pXg = fixtureEnv.expectedGoals * xgShare;
  const pXa = fixtureEnv.expectedGoals * xaShare;

  // Base rating calibrated to empirical 10-12 pt starter baseline.
  // In Gaffa, defensive contributions (CBI, recoveries, tackles) keep starting
  // outfielders around a 6.8 to 7.1 display rating (~10-12 points).
  let baseRating = 6.80 + 0.15 * calibre;
  if (pos === 'CB') {
    baseRating = 6.85 + 0.15 * calibre;
  } else if (pos === 'DM') {
    baseRating = 6.85 + 0.15 * calibre;
  } else if (isFb) {
    baseRating = 6.80 + 0.20 * calibre;
  } else if (pos === 'CM') {
    baseRating = 6.75 + 0.15 * calibre;
  } else if (isGk) {
    baseRating = 6.85 + 0.15 * calibre;
  } else {
    // Attackers: base rating starts slightly lower (6.60-6.80) because attacking actions
    // account for their scoring upside
    baseRating = 6.60 + 0.20 * calibre;
  }

  // Add expected match impact from attacking metrics
  let expRating = baseRating + pXg * 0.75 + pXa * 0.45;

  if (isDef || isGk) {
    // Clean sheet adds match impact relative to league average clean sheet prob (~28%)
    expRating += (fixtureEnv.cleanSheetProb - 0.28) * 0.50;
    // Conceding heavily (xGA > 1.20) dings match impact
    const excessConceded = Math.max(0, fixtureEnv.expectedConceded - 1.20);
    expRating -= excessConceded * 0.22;
  }

  // Linear map display rating -> scoring scale rating (1 + 9 * composite)
  const composite = (expRating - 3.5) / 6.0;
  const scoringRating = 1.0 + 9.0 * Math.max(0, Math.min(1.0, composite));

  let curvePoints = 0;
  if (scoringRating > 4.0) {
    curvePoints = 8.6 * Math.pow((scoringRating - 4.0) / 2.0, 1.5);
  }

  // Clean sheet flat bonus for defenders and keepers (scaled by clean sheet probability)
  let flatBonuses = 0;
  if (isDef || isGk) {
    flatBonuses += fixtureEnv.cleanSheetProb * 3.5;
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
