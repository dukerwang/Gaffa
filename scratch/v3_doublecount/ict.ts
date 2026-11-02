// Step 2: what moves FPL's Influence, Creativity and Threat? OLS per position
// group on the same event counts, 2025-26 real ICT. Reports each family's
// unique share of variance (R² lost when the family is dropped) and the
// per-event coefficients that matter for double counting.
import { loadApps, type App } from './data';
import { ols, r2, v } from './lib';
export const FEATURES: { key: string; fam: string; get: (a: App) => number }[] = [
  { key: 'np goal', fam: 'goals & assists', get: (a) => a.s.goals - a.penalty_goals },
  { key: 'pen goal', fam: 'goals & assists', get: (a) => a.penalty_goals },
  { key: 'assist', fam: 'goals & assists', get: (a) => a.s.assists },
  { key: 'np xG', fam: 'shooting', get: (a) => Math.max(0, (a.s.expected_goals ?? 0) - 0.79 * (a.penalty_goals + (a.s.penalties_missed ?? 0))) },
  { key: 'pen taken', fam: 'shooting', get: (a) => a.penalty_goals + (a.s.penalties_missed ?? 0) },
  { key: 'shot on target', fam: 'shooting', get: (a) => v(a, 'Shots on target') },
  { key: 'shot off target', fam: 'shooting', get: (a) => v(a, 'Shots off target') },
  { key: 'touch in box', fam: 'shooting', get: (a) => v(a, 'Touches in opposition box') },
  { key: 'xA', fam: 'chance creation', get: (a) => a.s.expected_assists ?? 0 },
  { key: 'key pass', fam: 'chance creation', get: (a) => Math.max(0, v(a, 'Chances created') - a.s.assists) },
  { key: 'big chance created', fam: 'chance creation', get: (a) => v(a, 'Big chances created') },
  { key: 'cross', fam: 'chance creation', get: (a) => v(a, 'Accurate crosses') },
  { key: 'accurate pass', fam: 'passing', get: (a) => v(a, 'Accurate passes') },
  { key: 'line-breaking pass', fam: 'passing', get: (a) => v(a, 'Line breaking passes') },
  { key: 'dribble', fam: 'carrying', get: (a) => v(a, 'Successful dribbles') },
  { key: 'foul won', fam: 'carrying', get: (a) => v(a, 'Was fouled') },
  { key: 'tackle', fam: 'defending', get: (a) => a.s.fpl_tackles ?? 0 },
  { key: 'CBI', fam: 'defending', get: (a) => a.s.fpl_cbi ?? 0 },
  { key: 'recovery', fam: 'defending', get: (a) => a.s.fpl_recoveries ?? 0 },
  { key: 'save', fam: 'saves', get: (a) => a.s.saves ?? 0 },
  { key: 'clean sheet', fam: 'team defence', get: (a) => (a.s.clean_sheet ? 1 : 0) },
  { key: 'goal conceded', fam: 'team defence', get: (a) => a.s.goals_conceded ?? 0 },
  { key: 'minutes/90', fam: 'minutes', get: (a) => a.s.minutes_played / 90 },
];
export const GROUP: Record<string, string> = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', LW: 'ATT', RW: 'ATT', ST: 'ATT' };
export function fitIct(apps: App[], target: 'influence' | 'creativity' | 'threat', group: string) {
  const rows = apps.filter((a) => GROUP[a.pos] === group);
  const y = rows.map((a) => a.s[target] ?? 0);
  const X = rows.map((a) => [1, ...FEATURES.map((f) => f.get(a))]);
  const b = ols(X, y);
  const full = r2(y, X.map((r) => r.reduce((s, x, j) => s + x * b[j], 0)));
  const fams = [...new Set(FEATURES.map((f) => f.fam))];
  const unique = Object.fromEntries(fams.map((fam) => {
    const keep = [0, ...FEATURES.map((f, j) => (f.fam === fam ? -1 : j + 1)).filter((j) => j > 0)];
    const Xr = X.map((r) => keep.map((j) => r[j]));
    const br = ols(Xr, y);
    return [fam, full - r2(y, Xr.map((r) => r.reduce((s, x, j) => s + x * br[j], 0)))];
  }));
  return { n: rows.length, r2: full, coef: Object.fromEntries(FEATURES.map((f, j) => [f.key, b[j + 1]])), unique };
}
if (process.argv[1]?.endsWith('ict.ts')) (async () => {
  const apps = await loadApps();
  for (const target of ['influence', 'creativity', 'threat'] as const) {
    console.log(`\n${target.toUpperCase()}`);
    for (const g of ['GK', 'DEF', 'MID', 'ATT']) {
      const r = fitIct(apps, target, g);
      const fam = Object.entries(r.unique).filter(([, u]) => u > 0.005).sort((a, b) => b[1] - a[1]).map(([k, u]) => `${k} ${(100 * u).toFixed(0)}%`).join(', ');
      const top = Object.entries(r.coef).filter(([, c]) => Math.abs(c) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 9).map(([k, c]) => `${k} ${c.toFixed(1)}`).join(', ');
      console.log(`${g.padEnd(4)} n=${r.n} R² ${r.r2.toFixed(2)} | unique: ${fam}\n      per event: ${top}`);
    }
  }
})();
