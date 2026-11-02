// Which half of the penalty rule moves penalty games away from FotMob's rating?
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { calculateMatchRating, DEFAULT_REFERENCE_STATS, PENALTY_THREAT } from '../../src/lib/scoring/matchRating';
import type { GranularPosition, RawStats } from '../../src/types';
import { loadApps, type App } from './data';
import { v } from './lib';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
const toStats = (a: App): RawStats => ({ ...(a.s as RawStats), engine_version: 'v3', fpl_element_type: a.et, penalty_goals: a.penalty_goals,
  line_breaking_passes: v(a, 'Line breaking passes'), aerials_won: v(a, 'Aerial duels won'), aerials_lost: Math.max(0, (a.f['Aerial duels won']?.total ?? 0) - v(a, 'Aerial duels won')) });
(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from('rating_reference_stats').select('position_group, component, median, stddev').eq('season', '2025-26');
  const ref: any = JSON.parse(JSON.stringify(DEFAULT_REFERENCE_STATS));
  for (const r of data!) if (ref[r.position_group]?.[r.component]) ref[r.position_group][r.component] = { median: +r.median, stddev: +r.stddev };
  const apps = (await loadApps()).filter((a) => a.s.minutes_played >= 60 && typeof a.f['FotMob rating']?.value === 'number');
  const att = (a: App) => a.penalty_goals + (a.s.penalties_missed ?? 0);
  const variants: Record<string, (a: App) => number> = {
    'rule off': (a) => calculateMatchRating(toStats(a), a.pos as GranularPosition, ref, a.pos as GranularPosition, { penaltiesOnce: false }).rating,
    'Threat only': (a) => calculateMatchRating({ ...toStats(a), threat: Math.max(0, (a.s.threat ?? 0) - PENALTY_THREAT * att(a)) }, a.pos as GranularPosition, ref, a.pos as GranularPosition, { penaltiesOnce: false }).rating,
    'Finishing only': (a) => calculateMatchRating({ ...toStats(a), threat: (a.s.threat ?? 0) + PENALTY_THREAT * att(a) }, a.pos as GranularPosition, ref, a.pos as GranularPosition).rating,
    'full rule': (a) => calculateMatchRating(toStats(a), a.pos as GranularPosition, ref, a.pos as GranularPosition).rating,
  };
  const pct = (vals: number[]) => { const s = [...vals].sort((x, y) => x - y); return (x: number) => { let lo = 0, hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < x) lo = m + 1; else hi = m; } return lo / s.length; }; };
  const byPos = new Map<string, App[]>(); for (const a of apps) byPos.set(a.pos, [...(byPos.get(a.pos) ?? []), a]);
  const pens = apps.filter((a) => att(a) > 0);
  const gaps: Record<string, { scored: number[]; missed: number[] }> = {};
  for (const [name, f] of Object.entries(variants)) {
    gaps[name] = { scored: [], missed: [] };
    for (const [pos, sub] of byPos) {
      const ours = sub.map(f), p = pct(ours), fm = pct(sub.map((a) => a.f['FotMob rating'].value));
      sub.forEach((a, i) => { if (!att(a)) return; const g = 100 * Math.abs(p(ours[i]) - fm(a.f['FotMob rating'].value)); (a.s.penalties_missed ? gaps[name].missed : gaps[name].scored).push(g); });
    }
  }
  const m = (x: number[]) => (x.reduce((s, y) => s + y, 0) / x.length).toFixed(1);
  console.log(`penalty games 60+ min: ${pens.length} (${gaps['rule off'].scored.length} scored, ${gaps['rule off'].missed.length} missed or saved)`);
  for (const k of Object.keys(variants)) console.log(`${k.padEnd(15)} gap to FotMob percentile: scored ${m(gaps[k].scored)}, missed ${m(gaps[k].missed)}`);
  // Where do penalty scorers sit? Mean percentile, ours vs FotMob.
  for (const k of ['rule off', 'full rule']) {
    const ours: number[] = [], theirs: number[] = [];
    for (const [, sub] of byPos) { const o = sub.map(variants[k]), p = pct(o), fm = pct(sub.map((a) => a.f['FotMob rating'].value));
      sub.forEach((a, i) => { if (a.penalty_goals > 0 && !a.s.penalties_missed) { ours.push(100 * p(o[i])); theirs.push(100 * fm(a.f['FotMob rating'].value)); } }); }
    console.log(`${k}: penalty scorers sit at Gaffa percentile ${m(ours)}, FotMob percentile ${m(theirs)}`);
  }
})();
