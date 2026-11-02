// Step 4: are Match Impact and Influence two measures of the same thing?
// Correlation per position of Match Impact's raw input with Influence, after
// taking FPL's goal and assist values out of Influence (ict.ts coefficients).
import { matchImpactRawInput } from '../../src/lib/scoring/matchRating';
import type { GranularPosition, RawStats } from '../../src/types';
import { loadApps } from './data';
import { fitIct, GROUP } from './ict';
const corr = (x: number[], y: number[]) => {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let s = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return s / Math.sqrt(dx * dy);
};
(async () => {
  const apps = (await loadApps()).filter((a) => a.s.minutes_played >= 60);
  const coef = Object.fromEntries(['GK', 'DEF', 'MID', 'ATT'].map((g) => [g, fitIct(apps, 'influence', g).coef]));
  for (const pos of ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']) {
    const rows = apps.filter((a) => a.pos === pos);
    const mi = rows.map((a) => matchImpactRawInput({ ...(a.s as RawStats), engine_version: 'v3', fpl_element_type: a.et, penalty_goals: a.penalty_goals }, pos as GranularPosition));
    const c = (a: any) => coef[GROUP[a.pos]];
    const infl = rows.map((a) => a.s.influence - c(a)['np goal'] * (a.s.goals - a.penalty_goals) - c(a)['pen goal'] * a.penalty_goals - c(a).assist * a.s.assists);
    const raw = rows.map((a) => a.s.influence);
    console.log(`${pos.padEnd(3)} n=${String(rows.length).padStart(4)}  r(MI, Influence ex G/A) ${corr(mi, infl).toFixed(2)}   r(MI, Influence as used) ${corr(mi, raw).toFixed(2)}`);
  }
})();
