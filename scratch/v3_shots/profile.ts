// Per-player non-penalty shot profile from FotMob shot maps, 2025-26.
import { readFileSync, readdirSync } from 'node:fs';
export interface Shot { playerId: number; eventType: string; situation: string; isOwnGoal: boolean; xg: number | null; xgot: number | null; inBox: boolean }
const DIR = '.fotmob-cache/2025-26';
export const shotsByMatch = new Map<number, Shot[]>(readdirSync(`${DIR}/shots`).map((f) => {
  const j = JSON.parse(readFileSync(`${DIR}/shots/${f}`, 'utf8')); return [j.matchId, j.shots];
}));
export const matched: any[] = JSON.parse(readFileSync(`${DIR}/matched.json`, 'utf8')).rows;
/** Non-penalty shots a player took in his matched appearances (optionally one gameweek). */
export function playerShots(playerId: string | number, gw?: number): Shot[] {
  const rows = matched.filter((r) => String(r.player_id) === String(playerId) && (gw == null || r.gameweek === gw));
  return rows.flatMap((r) => (shotsByMatch.get(r.fotmob_match_id) ?? []).filter((s) => s.playerId === r.fotmob_player_id && s.situation !== 'Penalty' && !s.isOwnGoal));
}
export const BANDS = [['Clear', 0.3, 9], ['Half', 0.1, 0.3], ['Low', 0, 0.1]] as const;
export function profile(shots: Shot[]) {
  const goals = shots.filter((s) => s.eventType === 'Goal');
  const band = (xs: Shot[]) => BANDS.map(([, lo, hi]) => xs.filter((s) => (s.xg ?? 0) >= lo && (s.xg ?? 0) < hi).length);
  return { shots: shots.length, xg: shots.reduce((t, s) => t + (s.xg ?? 0), 0), goals: goals.length, shotBands: band(shots), goalBands: band(goals), goalXg: goals.map((s) => +(s.xg ?? 0).toFixed(2)) };
}
/** Goal xG for one appearance. In a double gameweek, picks the match whose
 *  non-penalty goal count matches the appearance; null when that's ambiguous. */
export function appearanceGoalXg(playerId: string | number, gw: number, npGoals: number): number[] | null {
  const rows = matched.filter((r) => String(r.player_id) === String(playerId) && r.gameweek === gw);
  const lists = rows.map((r) => (shotsByMatch.get(r.fotmob_match_id) ?? [])
    .filter((s) => s.playerId === r.fotmob_player_id && s.situation !== 'Penalty' && !s.isOwnGoal && s.eventType === 'Goal')
    .map((s) => +(s.xg ?? 0).toFixed(2)).sort((a, b) => b - a));
  const fit = lists.filter((l) => l.length === npGoals);
  return fit.length === 1 || (fit.length > 1 && fit.every((l) => l.join() === fit[0].join())) ? fit[0] : null;
}
