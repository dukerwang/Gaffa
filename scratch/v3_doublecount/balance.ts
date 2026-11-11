// Positional balance, 2025-26, 60+ minutes: mean rating per position under
// Gaffa V2 / V3 and FotMob, and each position's share of the season's best
// performances (top 10% by each rating, all positions pooled).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { calculateMatchRating, DEFAULT_REFERENCE_STATS } from '../../src/lib/scoring/matchRating';
import type { GranularPosition, RawStats } from '../../src/types';
import { loadApps, type App } from './data';
import { v } from './lib';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
const v3 = (a: App): RawStats => ({ ...(a.s as RawStats), engine_version: 'v3', fpl_element_type: a.et, penalty_goals: a.penalty_goals,
  line_breaking_passes: v(a, 'Line breaking passes'), aerials_won: v(a, 'Aerial duels won'), aerials_lost: Math.max(0, (a.f['Aerial duels won']?.total ?? 0) - v(a, 'Aerial duels won')) });
const G: Record<string, string> = { GK: 'GK', CB: 'CB', LB: 'FB', RB: 'FB', LWB: 'WB', RWB: 'WB', DM: 'DM', CM: 'CM', AM: 'AM', LW: 'W', RW: 'W', ST: 'ST' };
(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from('rating_reference_stats').select('position_group, component, median, stddev').eq('season', '2025-26');
  const ref: any = JSON.parse(JSON.stringify(DEFAULT_REFERENCE_STATS));
  for (const r of data!) if (ref[r.position_group]?.[r.component]) ref[r.position_group][r.component] = { median: +r.median, stddev: +r.stddev };
  const rows = (await loadApps()).filter((a) => a.s.minutes_played >= 60 && typeof a.f['FotMob rating']?.value === 'number').map((a) => {
    const pos = a.pos as GranularPosition;
    const r2 = calculateMatchRating(a.s as RawStats, pos, ref, pos), r3 = calculateMatchRating(v3(a), pos, ref, pos);
    return { g: G[pos], fm: a.f['FotMob rating'].value, v2: r2.rating, v3: r3.rating, p2: r2.fantasyPoints, p3: r3.fantasyPoints };
  });
  const groups = ['GK', 'CB', 'FB', 'WB', 'DM', 'CM', 'AM', 'W', 'ST'];
  const mean = (x: number[]) => x.reduce((s, y) => s + y, 0) / x.length;
  const top = (k: 'fm' | 'v2' | 'v3') => { const cut = [...rows].sort((a, b) => b[k] - a[k])[Math.floor(rows.length * 0.1)][k]; return rows.filter((r) => r[k] > cut); };
  const tops = { fm: top('fm'), v2: top('v2'), v3: top('v3') };
  const share = (t: typeof rows, g: string) => (100 * t.filter((r) => r.g === g).length / t.length);
  const all = (g: string) => (100 * rows.filter((r) => r.g === g).length / rows.length);
  console.log(`${rows.length} appearances of 60+ min`);
  console.log('pos     n  share | mean rating: FotMob  V2    V3  | V3 pts | top-10% share: FotMob  V2   V3');
  for (const g of groups) {
    const s = rows.filter((r) => r.g === g);
    console.log(`${g.padEnd(4)} ${String(s.length).padStart(5)} ${all(g).toFixed(1).padStart(5)}% |  ${mean(s.map((r) => r.fm)).toFixed(2).padStart(12)} ${mean(s.map((r) => r.v2)).toFixed(2).padStart(5)} ${mean(s.map((r) => r.v3)).toFixed(2).padStart(5)} | ${mean(s.map((r) => r.p3)).toFixed(1).padStart(6)} | ${share(tops.fm, g).toFixed(1).padStart(14)}% ${share(tops.v2, g).toFixed(1).padStart(4)}% ${share(tops.v3, g).toFixed(1).padStart(4)}%`);
  }
})();
