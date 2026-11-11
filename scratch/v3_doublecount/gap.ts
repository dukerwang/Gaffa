// What explains the gap between Gaffa V3 and FotMob, per position? For each
// 60+ minute 2025-26 appearance, gap = Gaffa's z-score within the position
// minus FotMob's. Correlate the gap with each per-match stat: a positive r
// means Gaffa rates games with more of that stat higher than FotMob does.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { calculateMatchRating, DEFAULT_REFERENCE_STATS } from '../../src/lib/scoring/matchRating';
import type { GranularPosition, RawStats } from '../../src/types';
import { loadApps, type App } from './data';
import { v, tot } from './lib';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
export const v3Stats = (a: App): RawStats => ({ ...(a.s as RawStats), engine_version: 'v3', fpl_element_type: a.et, penalty_goals: a.penalty_goals,
  line_breaking_passes: v(a, 'Line breaking passes'), aerials_won: v(a, 'Aerial duels won'), aerials_lost: Math.max(0, (a.f['Aerial duels won']?.total ?? 0) - v(a, 'Aerial duels won')) });
const FEATS: Record<string, (a: App) => number> = {
  'goals': (a) => a.s.goals, 'assists': (a) => a.s.assists, 'xG': (a) => a.s.expected_goals ?? 0, 'xA': (a) => a.s.expected_assists ?? 0,
  'shots': (a) => v(a, 'Total shots'), 'chances created': (a) => v(a, 'Chances created'),
  'accurate passes': (a) => v(a, 'Accurate passes'), 'pass accuracy': (a) => (tot(a, 'Accurate passes') ? v(a, 'Accurate passes') / tot(a, 'Accurate passes') : 0),
  'passes attempted': (a) => tot(a, 'Accurate passes'), 'long balls': (a) => v(a, 'Accurate long balls'), 'line-breaking passes': (a) => v(a, 'Line breaking passes'),
  'passes into final third': (a) => v(a, 'Passes into final third'), 'touches': (a) => v(a, 'Touches'),
  'dribbles': (a) => v(a, 'Successful dribbles'), 'ground duels won': (a) => v(a, 'Ground duels won'), 'duels lost': (a) => v(a, 'Duels lost'),
  'aerials won': (a) => v(a, 'Aerial duels won'), 'tackles': (a) => v(a, 'Tackles'), 'interceptions': (a) => v(a, 'Interceptions'),
  'recoveries': (a) => v(a, 'Recoveries'), 'clearances': (a) => v(a, 'Clearances'), 'dribbled past': (a) => v(a, 'Dribbled past'),
  'dispossessed': (a) => v(a, 'Dispossessed'), 'fouls': (a) => v(a, 'Fouls committed'), 'was fouled': (a) => v(a, 'Was fouled'),
  'clean sheet': (a) => (a.s.clean_sheet ? 1 : 0), 'goals conceded': (a) => a.s.goals_conceded, 'team xGC': (a) => a.s.expected_goals_conceded ?? 0,
  'saves': (a) => a.s.saves ?? 0, 'saves inside box': (a) => v(a, 'Saves inside box'), 'goals prevented': (a) => v(a, 'Goals prevented'),
  'xGOT faced': (a) => v(a, 'xGOT faced'), 'high claims': (a) => v(a, 'High claim'), 'sweeper actions': (a) => v(a, 'Acted as sweeper'),
  'minutes': (a) => a.s.minutes_played,
};
export async function loadRef() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from('rating_reference_stats').select('position_group, component, median, stddev').eq('season', '2025-26');
  const ref: any = JSON.parse(JSON.stringify(DEFAULT_REFERENCE_STATS));
  for (const r of data!) if (ref[r.position_group]?.[r.component]) ref[r.position_group][r.component] = { median: +r.median, stddev: +r.stddev };
  return ref;
}
const corr = (x: number[], y: number[]) => { const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let s = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return dx && dy ? s / Math.sqrt(dx * dy) : 0; };
const z = (x: number[]) => { const m = x.reduce((a, b) => a + b, 0) / x.length, sd = Math.sqrt(x.reduce((s, y) => s + (y - m) ** 2, 0) / x.length); return x.map((y) => (y - m) / sd); };
if (process.argv[1]?.endsWith('gap.ts')) (async () => {
  const ref = await loadRef();
  const apps = (await loadApps()).filter((a) => a.s.minutes_played >= 60 && typeof a.f['FotMob rating']?.value === 'number');
  for (const pos of (process.argv[2] ?? 'GK,DM,CM,AM,CB,ST').split(',')) {
    const s = apps.filter((a) => a.pos === pos);
    const ours = z(s.map((a) => calculateMatchRating(v3Stats(a), pos as GranularPosition, ref, pos as GranularPosition).rating));
    const fm = z(s.map((a) => a.f['FotMob rating'].value));
    const gap = ours.map((o, i) => o - fm[i]);
    const rs = Object.entries(FEATS).map(([k, f]) => { const x = s.map(f); return [k, corr(x, gap), corr(x, fm), corr(x, ours)] as const; }).filter(([, r]) => Math.abs(r) >= 0.12).sort((a, b) => b[1] - a[1]);
    console.log(`\n${pos} (n=${s.length}). r with gap (+ = Gaffa rates it higher than FotMob) | r with FotMob | r with Gaffa`);
    for (const [k, r, rf, ro] of rs) console.log(`  ${k.padEnd(24)} ${(r >= 0 ? '+' : '') + r.toFixed(2)}   FotMob ${rf.toFixed(2)}   Gaffa ${ro.toFixed(2)}`);
  }
})();
