import type { App } from './data';
export const v = (a: App, k: string) => a.f[k]?.value ?? 0;
export const tot = (a: App, k: string) => a.f[k]?.total ?? 0;
export const BPS_GOAL: Record<number, number> = { 1: 12, 2: 12, 3: 18, 4: 24 };

/** BPS lines FPL publishes, 2025-26 values; `count` reads the event from FPL's or FotMob's stats. */
export interface Line { key: string; bps: number; count: (a: App) => number }
export const passBand = (a: App) => {
  const att = tot(a, 'Accurate passes'), pct = att ? v(a, 'Accurate passes') / att : 0;
  return att < 30 ? 0 : pct >= 0.9 ? 6 : pct >= 0.8 ? 4 : pct >= 0.7 ? 2 : 0;
};
export const LINES: Line[] = [
  { key: 'minutes', bps: 1, count: (a) => (a.s.minutes_played > 60 ? 6 : 3) },
  { key: 'goal (open play)', bps: 1, count: (a) => (a.s.goals - a.penalty_goals) * BPS_GOAL[a.et] },
  { key: 'goal (penalty)', bps: 12, count: (a) => a.penalty_goals },
  { key: 'assist', bps: 9, count: (a) => a.s.assists },
  { key: 'clean sheet (GK/DEF)', bps: 12, count: (a) => (a.et <= 2 && a.s.clean_sheet ? 1 : 0) },
  { key: 'goal conceded (GK/DEF)', bps: -4, count: (a) => (a.et <= 2 ? a.s.goals_conceded : 0) },
  { key: 'penalty save', bps: 8, count: (a) => a.s.penalty_saves ?? 0 },
  { key: 'save inside box', bps: 3, count: (a) => v(a, 'Saves inside box') },
  { key: 'save outside box', bps: 2, count: (a) => Math.max(0, v(a, 'Saves') - v(a, 'Saves inside box')) },
  { key: 'open-play cross', bps: 1, count: (a) => v(a, 'Accurate crosses') },
  { key: 'big chance created', bps: 3, count: (a) => v(a, 'Big chances created') },
  { key: 'key pass', bps: 1, count: (a) => Math.max(0, v(a, 'Chances created') - a.s.assists) },
  { key: 'CBI (per 2)', bps: 1, count: (a) => Math.floor((a.s.fpl_cbi ?? 0) / 2) },
  { key: 'recoveries (per 3)', bps: 1, count: (a) => Math.floor((a.s.fpl_recoveries ?? 0) / 3) },
  { key: 'tackle', bps: 2, count: (a) => a.s.fpl_tackles ?? 0 },
  { key: 'dribble', bps: 1, count: (a) => v(a, 'Successful dribbles') },
  { key: 'goal-line clearance', bps: 9, count: (a) => v(a, 'Clearance off the line') },
  { key: 'foul won', bps: 1, count: (a) => v(a, 'Was fouled') },
  { key: 'shot on target', bps: 2, count: (a) => v(a, 'Shots on target') },
  { key: 'pass completion band', bps: 1, count: passBand },
  { key: 'penalty conceded', bps: -3, count: (a) => v(a, 'Conceded penalty') },
  { key: 'penalty missed', bps: -6, count: (a) => a.s.penalties_missed ?? 0 },
  { key: 'yellow card', bps: -3, count: (a) => a.s.yellow_cards ?? 0 },
  { key: 'red card', bps: -9, count: (a) => a.s.red_cards ?? 0 },
  { key: 'own goal', bps: -6, count: (a) => a.s.own_goals ?? 0 },
  { key: 'big chance missed', bps: -3, count: (a) => v(a, 'Big chances missed') },
  { key: 'error leading to goal', bps: -3, count: (a) => v(a, 'Error led to goal') },
  { key: 'dispossessed', bps: -1, count: (a) => v(a, 'Dispossessed') },
  { key: 'foul conceded', bps: -1, count: (a) => v(a, 'Fouls committed') },
  { key: 'offside', bps: -1, count: (a) => v(a, 'Offsides') },
  { key: 'shot off target', bps: -1, count: (a) => v(a, 'Shots off target') },
];

export function ols(X: number[][], y: number[]): number[] {
  const k = X[0].length, A = Array.from({ length: k }, () => Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b]; A[a][k] += X[i][a] * y[i]; }
  for (let a = 0; a < k; a++) A[a][a] += 1e-6;
  for (let c = 0; c < k; c++) {
    let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) if (r !== c) { const m = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= m * A[c][j]; }
  }
  return A.map((row, i) => row[k] / row[i]);
}
export const r2 = (y: number[], yh: number[]) => {
  const m = y.reduce((s, x) => s + x, 0) / y.length;
  return 1 - y.reduce((s, x, i) => s + (x - yh[i]) ** 2, 0) / y.reduce((s, x) => s + (x - m) ** 2, 0);
};
export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
