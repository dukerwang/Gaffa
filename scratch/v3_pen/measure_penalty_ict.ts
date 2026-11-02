// How much does a penalty add to FPL's real Threat and Influence? OLS over 2025-26 appearances.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const fm = new Map<string, any>(JSON.parse(readFileSync('.fotmob-cache/2025-26/matched.json', 'utf8')).rows.map((r: any) => [`${r.player_id}:${r.match_id}`, r]));
async function all() { const out: any[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from('player_stats').select('player_id,match_id,stats').eq('season', '2025-26').order('id').range(f, f + 999); if (error) throw error; out.push(...data!); if (data!.length < 1000) return out; } }
function ols(X: number[][], y: number[]) { const k = X[0].length; const A = Array.from({ length: k }, () => Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b]; A[a][k] += X[i][a] * y[i]; }
  for (let c = 0; c < k; c++) { let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) if (r !== c) { const m = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= m * A[c][j]; } }
  return A.map((row, i) => row[k] / row[i]); }
(async () => {
  const rows = (await all()).filter((r) => r.stats?.minutes_played > 0 && !r.stats.ict_imputed);
  const X: number[][] = [], T: number[] = [], I: number[] = [], C: number[] = [];
  let pens = 0;
  for (const r of rows) { const s = Object.fromEntries(Object.entries(r.stats).map(([k, v]) => [k, typeof v === "boolean" ? v : Number(v) || 0])) as any, f = fm.get(`${r.player_id}:${r.match_id}`); if (!f) continue;
    const pg = Math.min(f.penalty_goals ?? 0, s.goals), pm = s.penalties_missed ?? 0, att = pg + pm; pens += att;
    const npxg = Math.max(0, (s.expected_goals ?? 0) - 0.79 * att);
    const sot = f.stats['Shots on target']?.value ?? 0, shots = f.stats['Total shots']?.value ?? 0;
    X.push([1, npxg, shots - att, s.goals - pg, pg, pm, s.assists, s.minutes_played / 90, s.bps - 12 * pg + 6 * pm]);
    T.push(s.threat ?? 0); I.push(s.influence ?? 0); C.push(s.creativity ?? 0); }
  console.log("col sums", X[0].map((_, j) => X.reduce((a, r) => a + r[j], 0).toFixed(1)).join(" "));
  const names = ['const', 'npxG', 'np shots', 'np goals', 'pen goals', 'pen missed', 'assists', 'min/90', 'bps ex pen'];
  console.log(`appearances ${X.length}, penalty attempts ${pens}`);
  for (const [lab, y] of [['threat', T], ['influence', I], ['creativity', C]] as const) {
    const b = ols(X, y as number[]); console.log(lab.padEnd(10), names.map((n, i) => `${n} ${b[i].toFixed(1)}`).join(' | ')); }
})();
