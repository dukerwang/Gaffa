// Step 1: can BPS be rebuilt line by line from FPL + FotMob counts?
import { loadApps } from './data';
import { LINES, mean, ols, r2 } from './lib';
(async () => {
  const apps = await loadApps();
  const y = apps.map((a) => a.s.bps);
  const table = apps.map((a) => LINES.reduce((s, l) => s + l.bps * l.count(a), 0));
  console.log(`Published table: R² ${r2(y, table).toFixed(3)}, mean |error| ${mean(y.map((x, i) => Math.abs(x - table[i]))).toFixed(2)} BPS, mean error ${mean(y.map((x, i) => x - table[i])).toFixed(2)}`);
  // Free fit of every line's value (minutes and goals held at the table).
  const fixed = new Set(['minutes', 'goal (open play)']);
  const free = LINES.filter((l) => !fixed.has(l.key));
  const X = apps.map((a) => [1, ...free.map((l) => l.count(a))]);
  const yr = apps.map((a, i) => y[i] - LINES.filter((l) => fixed.has(l.key)).reduce((s, l) => s + l.bps * l.count(a), 0));
  const b = ols(X, yr);
  const fit = X.map((row) => row.reduce((s, x, j) => s + x * b[j], 0));
  console.log(`Free fit: R² ${r2(yr, fit).toFixed(3)} (intercept ${b[0].toFixed(2)})`);
  console.log('line'.padEnd(26) + 'published   fitted   events');
  free.forEach((l, j) => console.log(l.key.padEnd(26) + String(l.bps).padStart(9) + b[j + 1].toFixed(2).padStart(9) + String(apps.reduce((s, a) => s + l.count(a), 0)).padStart(9)));
})();
