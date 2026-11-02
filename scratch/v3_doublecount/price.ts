// Step 3: points one more event earns through each component, V3 as it stands.
// For every 90-minute 2025-26 appearance at a position, add one event, move
// only the raw input of one component by what that event adds to it, and
// rescore. Averaged over the position's appearances. Raw deltas:
//   Match Impact: the event's 2026-27 BPS value, through matchImpactRawInput
//   Defensive:    through defensiveRawInput (exact engine formula)
//   Influence/Creativity/Threat: FPL's per-event value from ict.ts (OLS per group)
//   Goal Involvement / Finishing / Save Score: the engine's own formulas
// A component's score moves as sigmoid(logit(score) + Δraw / stddev), which is
// exact for the sigmoid components at 90 minutes (no substitute scaling).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  applyPositionWeights, calculateFantasyPoints, calculateMatchRating, DEFAULT_REFERENCE_STATS, defensiveRawInput,
  GK_CURVE_SCALE, matchImpactRawInput, threatRawInput,
} from '../../src/lib/scoring/matchRating';
import v3File from '../../src/lib/scoring/v3ReferenceStats.json';
import type { GranularPosition, RawStats } from '../../src/types';
import { loadApps, type App } from './data';
import { fitIct, GROUP } from './ict';
import { v } from './lib';

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
type Comp = 'match_impact' | 'influence' | 'creativity' | 'threat' | 'defensive' | 'goal_involvement' | 'finishing' | 'save_score';
const COMPS: Comp[] = ['match_impact', 'influence', 'creativity', 'threat', 'defensive', 'goal_involvement', 'finishing', 'save_score'];
const SHORT: Record<Comp, string> = { match_impact: 'MI', influence: 'Infl', creativity: 'Crea', threat: 'Thr', defensive: 'Def', goal_involvement: 'GI', finishing: 'Fin', save_score: 'Save' };
const sig = (z: number) => 1 / (1 + Math.exp(-z));
const logit = (p: number) => Math.log(p / (1 - p));

const toStats = (a: App): RawStats => ({
  ...(a.s as RawStats), engine_version: 'v3', fpl_element_type: a.et, penalty_goals: a.penalty_goals,
  line_breaking_passes: v(a, 'Line breaking passes'), aerials_won: v(a, 'Aerial duels won'),
  aerials_lost: Math.max(0, (a.f['Aerial duels won']?.total ?? 0) - v(a, 'Aerial duels won')),
});

/** What one event adds to each component's raw input, for this appearance. */
type Deltas = Partial<Record<Comp, number>>;
interface Event { key: string; who: (a: App) => boolean; deltas: (s: RawStats, pos: GranularPosition, a: App, ict: IctCoef) => Deltas }
type IctCoef = Record<'influence' | 'creativity' | 'threat', Record<string, number>>;
const mi = (s: RawStats, pos: GranularPosition, bps: number) => matchImpactRawInput({ ...s, bps: (s.bps ?? 0) + bps }, pos) - matchImpactRawInput(s, pos);
const def = (s: RawStats, pos: GranularPosition, change: Partial<RawStats>) => defensiveRawInput({ ...s, ...change }, pos, pos).defensiveRaw - defensiveRawInput(s, pos, pos).defensiveRaw;
const ictOf = (ict: IctCoef, f: string) => ({ influence: ict.influence[f], creativity: ict.creativity[f], threat: ict.threat[f] });
const all = () => true;
const EVENTS: Event[] = [
  { key: 'goal, beyond its shot', who: all, deltas: (s, p, a, ict) => ({ goal_involvement: 6, finishing: 1, influence: ict.influence['np goal'], threat: ict.threat['np goal'] }) },
  { key: 'assist', who: all, deltas: (s, p, a, ict) => ({ goal_involvement: 4, finishing: 0.5, ...ictOf(ict, 'assist') }) },
  { key: 'shot on target', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 2), ...ictOf(ict, 'shot on target') }) },
  { key: 'shot off target', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, -1), ...ictOf(ict, 'shot off target') }) },
  { key: 'key pass', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 1), ...ictOf(ict, 'key pass') }) },
  { key: 'big chance created (+ its key pass)', who: all, deltas: (s, p, a, ict) => {
    const kp = ictOf(ict, 'key pass'), bc = ictOf(ict, 'big chance created');
    return { match_impact: mi(s, p, 4), influence: kp.influence + bc.influence, creativity: kp.creativity + bc.creativity, threat: kp.threat + bc.threat };
  } },
  { key: 'cross', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 1), ...ictOf(ict, 'cross') }) },
  { key: 'tackle', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 2), defensive: def(s, p, { fpl_tackles: (s.fpl_tackles ?? 0) + 1 }), ...ictOf(ict, 'tackle') }) },
  { key: '3 clearances/blocks/interceptions', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 1), defensive: def(s, p, { fpl_cbi: (s.fpl_cbi ?? 0) + 3 }), influence: 3 * ict.influence.CBI, creativity: 3 * ict.creativity.CBI, threat: 3 * ict.threat.CBI }) },
  { key: '3 recoveries', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 1), defensive: def(s, p, { fpl_recoveries: (s.fpl_recoveries ?? 0) + 3 }), influence: 3 * ict.influence.recovery, creativity: 3 * ict.creativity.recovery, threat: 3 * ict.threat.recovery }) },
  { key: 'dribble', who: all, deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 1), ...ictOf(ict, 'dribble') }) },
  { key: '3 line-breaking passes', who: all, deltas: (s, p, a, ict) => ({ match_impact: matchImpactRawInput({ ...s, line_breaking_passes: (s.line_breaking_passes ?? 0) + 3 }, p) - matchImpactRawInput(s, p), influence: 3 * ict.influence['line-breaking pass'], creativity: 3 * ict.creativity['line-breaking pass'], threat: 3 * ict.threat['line-breaking pass'] }) },
  { key: 'save (inside the box)', who: (a) => a.pos === 'GK', deltas: (s, p, a, ict) => ({ match_impact: mi(s, p, 3), defensive: def(s, p, { saves: (s.saves ?? 0) + 1 }), save_score: 1, influence: ict.influence.save }) },
  { key: 'clean sheet kept (vs not)', who: (a) => !!a.s.clean_sheet && a.s.minutes_played >= 60, deltas: (s, p, a, ict) => ({
    match_impact: a.et <= 2 ? -(mi(s, p, -12)) : 0, defensive: -def(s, p, { clean_sheet: false }), ...Object.fromEntries(Object.entries(ictOf(ict, 'clean sheet')).map(([k, x]) => [k, x])),
  }) },
  { key: 'goal conceded', who: (a) => a.pos !== 'AM' && a.pos !== 'LW' && a.pos !== 'RW' && a.pos !== 'ST', deltas: (s, p, a, ict) => ({
    match_impact: a.et <= 2 ? mi(s, p, -4) : 0, defensive: def(s, p, { goals_conceded: s.goals_conceded + 1, clean_sheet: false }), ...ictOf(ict, 'goal conceded'),
  }) },
];

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: refRows } = await sb.from('rating_reference_stats').select('position_group, component, median, stddev').eq('season', '2025-26');
  const ref: any = JSON.parse(JSON.stringify(DEFAULT_REFERENCE_STATS));
  for (const r of refRows!) if (ref[r.position_group]?.[r.component]) ref[r.position_group][r.component] = { median: +r.median, stddev: +r.stddev };
  const sd = (pos: GranularPosition, c: Comp): number => {
    if (c === 'goal_involvement') return 2.5;
    if (c === 'finishing') return 0.28;
    return (v3File as any).components[c]?.[pos]?.stddev ?? ref[pos][c].stddev;
  };

  const apps = (await loadApps()).filter((a) => a.s.minutes_played >= 90);
  const ict: Record<string, IctCoef> = {};
  const allApps = await loadApps();
  for (const g of ['GK', 'DEF', 'MID', 'ATT']) ict[g] = {
    influence: fitIct(allApps, 'influence', g).coef, creativity: fitIct(allApps, 'creativity', g).coef, threat: fitIct(allApps, 'threat', g).coef,
  };

  const GROUPS: Record<string, GranularPosition[]> = { GK: ['GK'], CB: ['CB'], FB: ['LB', 'RB', 'LWB', 'RWB'], DM: ['DM'], CM: ['CM'], AM: ['AM'], W: ['LW', 'RW'], ST: ['ST'] };
  const out: Record<string, Record<string, Record<Comp, number> & { n: number }>> = {};
  let checked = 0, mismatched = 0;
  for (const [label, positions] of Object.entries(GROUPS)) {
    out[label] = {};
    for (const ev of EVENTS) {
      const sums = Object.fromEntries(COMPS.map((c) => [c, 0])) as Record<Comp, number>; let n = 0;
      for (const a of apps.filter((x) => positions.includes(x.pos as GranularPosition) && ev.who(x))) {
        const pos = a.pos as GranularPosition, s = toStats(a);
        const r = calculateMatchRating(s, pos, ref, pos);
        const scores = Object.fromEntries(COMPS.map((c) => [c, 0.5])) as Record<Comp, number>;
        for (const b of r.breakdown) scores[b.key as Comp] = b.score;
        // Flex candidates the position weights at 0 aren't in the breakdown.
        const g = s.goals, xg = Math.max(0, (s.expected_goals ?? 0) - 0.79 * (a.penalty_goals + (s.penalties_missed ?? 0)));
        if (!r.breakdown.some((b) => b.key === 'goal_involvement')) scores.goal_involvement = sig((g * 6 + s.assists * 4) / 2.5);
        if (!r.breakdown.some((b) => b.key === 'finishing')) scores.finishing = sig(((g - a.penalty_goals - xg) + 0.5 * (s.assists - (s.expected_assists ?? 0)) + 0.03) / 0.28);
        const pts = (sc: Record<Comp, number>) => {
          const c = applyPositionWeights(sc as any, pos).composite;
          return calculateFantasyPoints(Math.max(1, Math.min(10, 1 + 9 * c)), 90) * (pos === 'GK' ? GK_CURVE_SCALE : 1);
        };
        const base = pts(scores);
        checked++;
        if (Math.abs(base - r.fantasyPoints) > 0.02) { mismatched++; continue; } // feat bonus or OOP: skip
        n++;
        const d = ev.deltas(s, pos, a, ict[GROUP[pos]]);
        for (const c of COMPS) {
          const dr = d[c]; if (!dr) continue;
          const moved = { ...scores };
          if (c === 'save_score') {
            const sv = s.saves ?? 0, gc = s.goals_conceded, rs = ref.GK.save_score;
            const score = (k: number) => {
              const pct = k + gc > 0 ? k / (k + gc) : 0.7;
              return sig(((k * 2.5 + (s.penalty_saves ?? 0) * 6) - rs.median) / rs.stddev) * 0.45 + sig((pct - 0.7) / 0.15) * 0.55;
            };
            moved.save_score = scores.save_score + score(sv + 1) - score(sv);
          } else {
            const p0 = Math.min(Math.max(scores[c], 1e-9), 1 - 1e-9);
            moved[c] = sig(logit(p0) + dr / sd(pos, c));
          }
          sums[c] += pts(moved) - base;
        }
      }
      out[label][ev.key] = Object.assign(Object.fromEntries(COMPS.map((c) => [c, n ? sums[c] / n : 0])) as Record<Comp, number>, { n });
    }
  }
  console.log(`checked ${checked}, skipped ${mismatched} (feat bonus) — base points reproduced for the rest`);
  for (const ev of EVENTS) {
    console.log(`\n${ev.key}`);
    for (const [label, rows] of Object.entries(out)) {
      const r = rows[ev.key]; if (!r.n) continue;
      const parts = COMPS.filter((c) => Math.abs(r[c]) >= 0.05).map((c) => `${SHORT[c]} ${r[c] >= 0 ? '+' : ''}${r[c].toFixed(2)}`);
      const total = COMPS.reduce((s, c) => s + r[c], 0);
      const homes = COMPS.filter((c) => Math.abs(r[c]) >= 0.1).length;
      console.log(`  ${label.padEnd(3)} ${(total >= 0 ? '+' : '') + total.toFixed(2)} pts  ${homes >= 2 ? '×' + homes : '  '}  ${parts.join(', ')}   (n=${r.n})`);
    }
  }
  require('node:fs').writeFileSync('scratch/v3_doublecount/price.json', JSON.stringify(out, null, 1));
})();
