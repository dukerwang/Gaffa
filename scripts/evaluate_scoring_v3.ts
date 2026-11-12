/**
 * Scores a whole season under V2 and under each V3 step in turn, from the
 * stats stored in `player_stats` plus the FotMob scrape, and writes a
 * per-player leaderboard with one column per step.
 *
 *   node_modules/.bin/tsx scripts/evaluate_scoring_v3.ts [--season=2025-26]
 *
 * Needs .fotmob-cache/<season>/matched.json (scripts/scrape_fotmob_season.ts).
 * Read-only against the database. Output: scratch/v3_eval/leaderboard_<season>.json
 *
 * Steps. Each step adds one change to the one before, so a column shows the
 * effect of everything up to and including that change. A step's FotMob
 * fields are merged into each appearance's stats; fields a step doesn't list
 * are left out, which the engine counts as zero.
 *
 * References. Each step is normalized against reference stats computed from
 * its own formulas. V2 uses the stored `rating_reference_stats` rows, as
 * production does. A V3 step uses the same rows with the components it
 * changes (listed in its `recompute`) recomputed per position, using the
 * method of scripts/recompute_reference_stats.mjs (appearances of 45+
 * minutes, wide defenders pooled, LW/RW pooled, median and population
 * stddev). The script also recomputes V2's references the same way and
 * prints them beside the stored values, so any gap in method shows up before it
 * is trusted.
 *
 * FPL element types come from the season's own player list, resolved by
 * scripts/lib/fplSeasonPlayers.ts.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  calculateMatchRating,
  DEFAULT_REFERENCE_STATS,
  defensiveRawInput,
  type EngineOptions,
  fallbackElementType,
  matchImpactRawInput,
  PENALTY_XG,
  shotFinishingRaw,
  threatRawInput,
} from '../src/lib/scoring/matchRating';
import { CLUB_BY_SLUG, clubByFplCode } from '../src/lib/clubs/registry';
import type { GranularPosition, RawStats, ReferenceStats } from '../src/types';
import { resolveSeasonPlayers, type ElementType } from './lib/fplSeasonPlayers';
import { fetchAll } from './lib/fetchAll';

for (const line of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split('\n') : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

const season = process.argv.find((a) => a.startsWith('--season='))?.split('=')[1] ?? '2025-26';
const OUT_DIR = 'scratch/v3_eval';
const POSITIONS: GranularPosition[] = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const WIDE_DEF: GranularPosition[] = ['LB', 'RB', 'LWB', 'RWB'];
type RefMap = Record<GranularPosition, ReferenceStats>;

type StepKey = 'v2' | 'goal' | 'lbp' | 'aerial' | 'subs' | 'pen' | 'neutral' | 'csbps' | 'csonly' | 'gkgp' | 'csgk' | 'nocs' | 'nocsdef' | 'cshalf' | 'xgcdef' | 'xgcgk' | 'cmw10' | 'cmw15' | 'finxgot' | 'wlikest' | 'finl0' | 'finl5' | 'finl1' | 'finl0w' | 'finl5w';
type Component = 'match_impact' | 'defensive' | 'threat';
/** `recompute` lists the components whose raw input the step changes; their references are recomputed. */
interface Step {
  key: StepKey; label: string; version: 'v2' | 'v3'; fields: (keyof RawStats)[]; recompute: Component[];
  /** Experimental steps change an input here instead of in the engine, until one is adopted. */
  adjust?: (s: RawStats) => RawStats;
  /** Engine switches; a step leaves off the V3 changes that come after it. */
  options?: EngineOptions;
}
const STEPS: Step[] = [
  { key: 'v2', label: 'V2', version: 'v2', fields: [], recompute: [] },
  { key: 'goal', label: 'Goal BPS fix', version: 'v3', fields: ['penalty_goals'], recompute: ['match_impact'], options: { substituteScaling: false, v3References: false, penaltiesOnce: false, neutralTeamDefence: false } },
  {
    key: 'lbp', label: '+ Line-breaking passes', version: 'v3', fields: ['penalty_goals', 'line_breaking_passes'],
    recompute: ['match_impact'], options: { substituteScaling: false, v3References: false, penaltiesOnce: false, neutralTeamDefence: false },
  },
  {
    key: 'aerial', label: '+ Net aerial duels', version: 'v3',
    fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost'], recompute: ['match_impact', 'defensive'],
    options: { substituteScaling: false, v3References: false, penaltiesOnce: false, neutralTeamDefence: false },
  },
  {
    key: 'subs', label: '+ Substitute scoring', version: 'v3',
    fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost'], recompute: ['match_impact', 'defensive'],
    options: { v3References: false, penaltiesOnce: false, neutralTeamDefence: false },
  },
  {
    // Penalties out of Threat and Finishing (PENALTY_THREAT, PENALTY_XG). Threat
    // keeps V2's references: 92 kicks in a season barely move a position's
    // typical match, and recomputing them would instead swap in this script's
    // method (the threat table shows the gap) and, at AM, a median that jumps
    // between tied values, raising every AM's Threat.
    key: 'pen', label: '+ Penalties counted once', version: 'v3',
    fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost'], recompute: ['match_impact', 'defensive'],
    options: { v3References: false, neutralTeamDefence: false },
  },
  {
    // Outfielders' Defensive neutral on the opponent's chances (defensiveRawInput).
    key: 'neutral', label: '+ Team defence neutral on chances', version: 'v3',
    fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost'], recompute: ['match_impact', 'defensive'],
    options: { v3References: false },
  },
];

// Experimental steps, run with --try=<key>[,<key>]. Each builds on the last step above.
const EXPERIMENTS: Step[] = [
  {
    // FPL's BPS pays keepers and defenders +12 for a clean sheet (60+ min) and
    // -4 per goal conceded. Defensive scores both outcomes too, so this removes
    // the BPS copy from Match Impact.
    key: 'csbps', label: 'Exp: clean sheet out of BPS', version: 'v3',
    fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost'], recompute: ['match_impact', 'defensive'],
    options: { v3References: false },
    adjust: (st) => {
      if (st.fpl_element_type !== 1 && st.fpl_element_type !== 2) return st;
      const cs = st.clean_sheet && st.minutes_played >= 60 ? 12 : 0;
      return { ...st, bps: (st.bps ?? 0) - cs + 4 * (st.goals_conceded ?? 0) };
    },
  },
  {
    // As csbps, but only the +12 clean-sheet BPS comes out; the -4 per goal
    // conceded stays in Match Impact.
    key: 'csonly', label: 'Exp: clean-sheet BPS only out', version: 'v3',
    fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost'], recompute: ['match_impact', 'defensive'],
    options: { v3References: false },
    adjust: (st) => {
      if (st.fpl_element_type !== 1 && st.fpl_element_type !== 2) return st;
      return { ...st, bps: (st.bps ?? 0) - (st.clean_sheet && st.minutes_played >= 60 ? 12 : 0) };
    },
  },
  {
    // Keepers judged on shot-stopping: FotMob's goals prevented (xG on target
    // faced minus goals conceded) in place of the team's xGC minus goals
    // conceded in Defensive. Emulated by setting xGC so xGC - GC = goals prevented.
    key: 'gkgp', label: 'Exp: keeper goals prevented', version: 'v3',
    fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost', 'goals_prevented' as keyof RawStats], recompute: ['match_impact', 'defensive'],
    options: { v3References: false },
    adjust: (st) => {
      const gp = (st as any).goals_prevented;
      if (st.fpl_element_type !== 1 || typeof gp !== 'number') return st;
      return { ...st, expected_goals_conceded: Math.max(0, (st.goals_conceded ?? 0) + gp) };
    },
  },
];
// cshalf: half of the +12 clean-sheet BPS out (6), keeper goals prevented as in csgk.
EXPERIMENTS.push({
  ...EXPERIMENTS.find((e) => e.key === 'gkgp')!, key: 'cshalf', label: 'Exp: half the clean-sheet BPS out + keeper goals prevented',
  adjust: (st) => EXPERIMENTS.find((e) => e.key === 'gkgp')!.adjust!(
    st.fpl_element_type === 1 || st.fpl_element_type === 2 ? { ...st, bps: (st.bps ?? 0) - (st.clean_sheet && st.minutes_played >= 60 ? 6 : 0) } : st),
});
// xgcdef: outfield defenders credited for the chances the team prevented,
// not for whether the chances allowed went in. Defensive today adds
// 5 x (xGC - goals conceded), which pays more the more chances the opponent
// had. This makes it -5 x xGC (plus a constant the recomputed references
// absorb); goals conceded still count through the clean-sheet bonus and BPS.
// Emulated through xGC: 5 x (xGC' - GC) = 15 - 5 x xGC when xGC' = GC - xGC + 3.
const preventChances = (st: RawStats): RawStats => st.fpl_element_type === 1 ? st
  : { ...st, expected_goals_conceded: (st.goals_conceded ?? 0) - (st.expected_goals_conceded ?? 0) + 3 };
EXPERIMENTS.push({
  key: 'xgcdef', label: 'Exp: defenders credited for chances prevented', version: 'v3',
  fields: ['penalty_goals', 'line_breaking_passes', 'aerials_won', 'aerials_lost'], recompute: ['match_impact', 'defensive'],
  options: { v3References: false, neutralTeamDefence: false }, adjust: preventChances,
});
EXPERIMENTS.push({
  ...EXPERIMENTS.find((e) => e.key === 'gkgp')!, key: 'xgcgk', label: 'Exp: xgcdef + keeper goals prevented',
  options: { v3References: false, neutralTeamDefence: false },
  adjust: (st) => EXPERIMENTS.find((e) => e.key === 'gkgp')!.adjust!(preventChances(st)),
});
// CM weight splits: move weight from Creativity (and Threat) to Defensive,
// so ball-winning counts closer to creating. Today CM is Match Impact 0.20,
// Influence 0.15, Creativity 0.15, Threat 0.10, Defensive 0.05, GI 0.10.
const NEUTRAL_STEP: Step = STEPS.find((st) => st.key === 'neutral')!;
EXPERIMENTS.push({ ...NEUTRAL_STEP, key: 'cmw10', label: 'Exp: CM Creativity 0.10, Defensive 0.10',
  options: { v3References: false, positionWeights: { CM: { creativity: 0.10, defensive: 0.10 } } } });
EXPERIMENTS.push({ ...NEUTRAL_STEP, key: 'cmw15', label: 'Exp: CM Creativity 0.10, Threat 0.05, Defensive 0.15',
  options: { v3References: false, positionWeights: { CM: { creativity: 0.10, threat: 0.05, defensive: 0.15 } } } });
// Attackers. finxgot: Finishing as shot quality (xGOT - xG), so a goal counts
// once, in Goal Involvement. wlikest: wingers weighted like strikers
// (Finishing 0.25 -> 0.10, the 0.15 spread to Influence, Creativity, Threat).
const W_AS_ST = { influence: 0.10, creativity: 0.10, threat: 0.15, finishing: 0.10 };
EXPERIMENTS.push({ ...NEUTRAL_STEP, key: 'finxgot', label: 'Exp: Finishing as shot quality',
  fields: [...NEUTRAL_STEP.fields, 'xgot'], options: { v3References: false, finishingFromXgot: true } });
EXPERIMENTS.push({ ...NEUTRAL_STEP, key: 'wlikest', label: 'Exp: wingers weighted like strikers',
  options: { v3References: false, positionWeights: { LW: W_AS_ST, RW: W_AS_ST } } });
// Per-shot Finishing (EngineOptions.shotFinishing). lambda 1 is goals minus xG
// shot by shot (a check against today's match-level figure); 0.5 and 0 pay
// less extra for a harder goal and charge more for a missed clear chance.
// Scales: 2025-26 outfield appearances of 45+ minutes, stddev matched to the
// spread of today's Finishing input (0.28 against its own sd), so only the
// shape of the scale changes. Set by --fit-shot-finishing.
const SHOT_FIN: Record<string, { lambda: number; median: number; stddev: number }> = JSON.parse(
  existsSync('scratch/v3_shots/shot_fin_scale.json') ? readFileSync('scratch/v3_shots/shot_fin_scale.json', 'utf8') : '{}');
for (const [key, lambda, w] of [['finl1', 1, false], ['finl5', 0.5, false], ['finl0', 0, false], ['finl5w', 0.5, true], ['finl0w', 0, true]] as const) {
  const sc = SHOT_FIN[String(lambda)];
  if (!sc) continue;
  EXPERIMENTS.push({ ...NEUTRAL_STEP, key, label: `Exp: per-shot Finishing, lambda ${lambda}${w ? ', wingers like strikers' : ''}`,
    fields: [...NEUTRAL_STEP.fields, 'np_shots' as keyof RawStats],
    options: { v3References: false, shotFinishing: sc, ...(w ? { positionWeights: { LW: W_AS_ST, RW: W_AS_ST } } : {}) } });
}
// nocs: csgk, and outfielders get no clean-sheet bonus in Defensive either.
// Team defending still counts through goals conceded against xGC (Defensive)
// and -4 BPS per goal conceded (Match Impact), which are continuous rather
// than a 0-or-1 cliff.
// csonly and gkgp together.
EXPERIMENTS.push({
  ...EXPERIMENTS.find((e) => e.key === 'gkgp')!, key: 'csgk', label: 'Exp: clean-sheet BPS out + keeper goals prevented',
  adjust: (st) => EXPERIMENTS.find((e) => e.key === 'gkgp')!.adjust!(EXPERIMENTS.find((e) => e.key === 'csonly')!.adjust!(st)),
});
EXPERIMENTS.push({
  ...EXPERIMENTS.find((e) => e.key === 'csgk')!, key: 'nocs', label: 'Exp: csgk + no outfield clean-sheet bonus',
  adjust: (st) => {
    const out = EXPERIMENTS.find((e) => e.key === 'csgk')!.adjust!(st);
    return st.fpl_element_type === 1 ? out : { ...out, clean_sheet: false };
  },
});
// nocsdef: as nocs, but only FPL defenders lose the Defensive clean-sheet bonus; DMs and CMs keep theirs.
EXPERIMENTS.push({
  ...EXPERIMENTS.find((e) => e.key === 'csgk')!, key: 'nocsdef', label: 'Exp: csgk + no clean-sheet bonus for defenders',
  adjust: (st) => {
    const out = EXPERIMENTS.find((e) => e.key === 'csgk')!.adjust!(st);
    return st.fpl_element_type === 2 ? { ...out, clean_sheet: false } : out;
  },
});
const tried = (process.argv.find((a) => a.startsWith('--try='))?.split('=')[1] ?? '').split(',').filter(Boolean);
for (const key of tried) {
  const exp = EXPERIMENTS.find((e) => e.key === key);
  if (!exp) throw new Error(`Unknown experiment ${key}; known: ${EXPERIMENTS.map((e) => e.key).join(', ')}`);
  STEPS.push(exp);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pstdev = (a: number[]) => {
  if (!a.length) return 1;
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length);
  return sd < 0.001 ? 1 : sd;
};
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

async function main() {
  const refRows = await fetchAll<any>((f, t) => supabase.from('rating_reference_stats')
    .select('position_group, component, median, stddev').eq('season', season).order('id').range(f, t));
  const v2Ref: RefMap = JSON.parse(JSON.stringify(DEFAULT_REFERENCE_STATS));
  for (const r of refRows) {
    const slot = (v2Ref as any)[r.position_group]?.[r.component];
    if (slot) (v2Ref as any)[r.position_group][r.component] = { median: +r.median, stddev: +r.stddev };
  }
  console.log(`${season}: ${refRows.length} stored reference rows`);

  const rows = await fetchAll<any>((f, t) => supabase.from('player_stats')
    .select('id, player_id, match_id, gameweek, stats, players!inner(web_name, primary_position, fpl_id)')
    .eq('season', season).order('id').range(f, t));
  const clubRows = await fetchAll<any>((f, t) => supabase.from('player_season_clubs')
    .select('player_id, club_slug').eq('season', season).order('player_id').range(f, t));
  const clubOf = new Map<string, string>(clubRows.map((r) => [r.player_id, r.club_slug]));

  // Season identity per player (see scripts/lib/fplSeasonPlayers.ts); a
  // player it can't resolve falls back to a position-based element type.
  const withMinutes = rows.filter((r) => (r.stats?.minutes_played ?? 0) > 0);
  const ids = await resolveSeasonPlayers(season, withMinutes.map((r) => ({
    player_id: r.player_id, web_name: r.players.web_name, fpl_id: r.players.fpl_id, club_slug: clubOf.get(r.player_id),
  })), OUT_DIR);
  const playerMeta = new Map<string, { et: ElementType; teamCode?: number }>();
  for (const r of withMinutes) {
    playerMeta.set(r.player_id, ids.byPlayer.get(r.player_id) ?? { et: fallbackElementType(r.players.primary_position) });
  }
  console.log(`Element types for players with minutes: ${ids.viaCode} by FPL code, ${ids.viaName} by name, ${ids.unresolved.length} guessed from position`);
  if (ids.unresolved.length) console.log(`  guessed: ${ids.unresolved.join(', ')}`);

  const apps = rows.filter((r) => (r.stats?.minutes_played ?? 0) > 0 && POSITIONS.includes(r.players.primary_position));

  const fotmobFile = `.fotmob-cache/${season}/matched.json`;
  if (!existsSync(fotmobFile)) throw new Error(`${fotmobFile} missing: run scripts/scrape_fotmob_season.ts first`);
  const fotmob = new Map<string, any>(JSON.parse(readFileSync(fotmobFile, 'utf8')).rows
    .map((r: any) => [`${r.player_id}:${r.match_id}`, r]));
  // Per-shot xG from FotMob shot maps (scratch/v3_shots/fetch_shots.mts), for the shot-finishing experiments.
  const shotDir = `.fotmob-cache/${season}/shots`;
  const shotsByMatch = new Map<number, any[]>(existsSync(shotDir) ? readdirSync(shotDir).map((fn) => {
    const j = JSON.parse(readFileSync(`${shotDir}/${fn}`, 'utf8')); return [j.matchId, j.shots];
  }) : []);
  const fotmobFields = (r: any): Partial<RawStats> => {
    const f = fotmob.get(`${r.player_id}:${r.match_id}`);
    if (!f) return {};
    const aerialWon = f.stats['Aerial duels won']?.value ?? 0;
    return {
      penalty_goals: f.penalty_goals,
      line_breaking_passes: f.stats['Line breaking passes']?.value ?? 0,
      aerials_won: aerialWon,
      aerials_lost: (f.stats['Aerial duels won']?.total ?? 0) - aerialWon,
      ...(typeof f.stats['Goals prevented']?.value === 'number' ? { goals_prevented: f.stats['Goals prevented'].value } : {}),
      xgot: f.stats['Expected goals on target (xGOT)']?.value ?? 0,
      ...(shotsByMatch.has(f.fotmob_match_id) ? { np_shots: shotsByMatch.get(f.fotmob_match_id)!
        .filter((s: any) => s.playerId === f.fotmob_player_id && s.situation !== 'Penalty' && !s.isOwnGoal)
        .map((s: any) => ({ xg: s.xg ?? 0, goal: s.eventType === 'Goal' })) } : {}),
    } as Partial<RawStats>;
  };
  // --fit-shot-finishing: scales for the per-shot Finishing experiments, from
  // outfield appearances of 45+ minutes with a shot map. Each lambda keeps its
  // own median, and its stddev is 0.28 times its spread over today's spread.
  if (process.argv.includes('--fit-shot-finishing')) {
    const sample = apps.filter((r) => r.stats.minutes_played >= 45 && r.players.primary_position !== 'GK')
      .map((r) => ({ r, f: fotmobFields(r) as any })).filter((x) => x.f.np_shots);
    const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
    const sd = (xs: number[]) => { const m = xs.reduce((t, x) => t + x, 0) / xs.length; return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / xs.length); };
    const xaPart = (st: any) => 0.5 * ((st.assists ?? 0) - (st.expected_assists ?? 0));
    const today = sample.map(({ r, f }) => {
      const pg = f.penalty_goals ?? 0, pm = r.stats.penalties_missed ?? 0;
      return (r.stats.goals - pg) - Math.max(0, (r.stats.expected_goals ?? 0) - PENALTY_XG * (pg + pm)) + xaPart(r.stats);
    });
    const out: Record<string, { lambda: number; median: number; stddev: number }> = {};
    console.log(`\nPer-shot Finishing scales, ${sample.length} appearances. Today: median ${pct(today, 0.5).toFixed(3)}, sd ${sd(today).toFixed(3)}`);
    for (const lambda of [1, 0.5, 0]) {
      const xs = sample.map(({ r, f }) => shotFinishingRaw(f.np_shots, lambda) + xaPart(r.stats));
      out[String(lambda)] = { lambda, median: +pct(xs, 0.5).toFixed(4), stddev: +(0.28 * sd(xs) / sd(today)).toFixed(4) };
      console.log(`  lambda ${lambda}: median ${pct(xs, 0.5).toFixed(3)}, sd ${sd(xs).toFixed(3)} -> scale ${out[String(lambda)].stddev}`);
    }
    writeFileSync('scratch/v3_shots/shot_fin_scale.json', JSON.stringify(out, null, 2));
    return;
  }
  const statsFor = (r: any, step: Step): RawStats => {
    const extra = fotmobFields(r) as Record<string, unknown>;
    const picked = Object.fromEntries(step.fields.filter((k) => k in extra).map((k) => [k, extra[k]]));
    const st: RawStats = { ...r.stats, ...picked, engine_version: step.version, fpl_element_type: playerMeta.get(r.player_id)!.et };
    return step.adjust ? step.adjust(st) : st;
  };

  // References per step: V2's stored rows, with the components a step changes recomputed.
  const pool = (pos: GranularPosition): GranularPosition[] =>
    WIDE_DEF.includes(pos) ? WIDE_DEF : pos === 'LW' || pos === 'RW' ? ['LW', 'RW'] : [pos];
  const rawInput: Record<Component, (s: RawStats, pos: GranularPosition, o?: EngineOptions) => number> = {
    match_impact: (st, pos, o) => matchImpactRawInput(st, pos, o),
    defensive: (st, pos, o) => defensiveRawInput(st, pos, pos, o).defensiveRaw,
    threat: (st, _pos, o) => threatRawInput(st, o),
  };
  const refs = {} as Record<StepKey, RefMap>;
  // The last adopted (non-experimental) step is V3 as it stands; --write-v3-refs saves its references.
  const FINAL = [...STEPS].reverse().find((s) => !s.adjust)!.key;
  const recomputedFor: Partial<Record<StepKey, Set<string>>> = {};
  const refSample: Record<string, { n: number; ties: number; below: number }> = {};
  for (const step of STEPS) refs[step.key] = JSON.parse(JSON.stringify(v2Ref));
  for (const comp of ['match_impact', 'defensive', 'threat'] as Component[]) {
    console.log(`\n${comp} reference, median / stddev (V2 as stored, then recomputed per step; * = input unchanged, stored V2 kept)`);
    console.log('pos ' + ['stored', ...STEPS.map((s) => s.key)].map((h) => h.padStart(15)).join(''));
    for (const pos of POSITIONS) {
      const sample = apps.filter((r) => pool(pos).includes(r.players.primary_position) && r.stats.minutes_played >= 45);
      const cells = [`${v2Ref[pos][comp].median.toFixed(2)} / ${v2Ref[pos][comp].stddev.toFixed(2)}`];
      const v2Raw = sample.map((r) => rawInput[comp](statsFor(r, STEPS[0]), r.players.primary_position));
      for (const step of STEPS) {
        const raw = sample.map((r) => rawInput[comp](statsFor(r, step), r.players.primary_position, step.options));
        // Recompute only where the step actually changed this input; otherwise
        // the stored V2 reference stays, so an unchanged input scores exactly as in V2.
        const changed = raw.some((x, i) => Math.abs(x - v2Raw[i]) > 1e-9);
        const recomputed = { median: median(raw), stddev: Number(pstdev(raw).toFixed(4)) };
        if (step.recompute.includes(comp) && changed) {
          refs[step.key][pos][comp] = recomputed;
          (recomputedFor[step.key] ??= new Set()).add(`${comp}:${pos}`);
          if (step.key === FINAL) {
            const ties = raw.filter((x) => Math.abs(x - recomputed.median) < 1e-9).length / raw.length;
            const below = raw.filter((x) => x < recomputed.median - 1e-9).length / raw.length;
            refSample[`${comp}:${pos}`] = { n: raw.length, ties, below };
          }
        }
        cells.push(`${recomputed.median.toFixed(2)} / ${recomputed.stddev.toFixed(2)}${step.recompute.includes(comp) && !changed ? '*' : ' '}`);
      }
      console.log(`${pos.padEnd(4)}${cells.map((c) => c.padStart(16)).join('')}   n=${sample.length}`);
    }
  }

  // Reference sample check for V3 as it stands: a large share of values tied
  // exactly at the median means the median can jump by a whole step.
  console.log(`\nV3 (${FINAL}) references recomputed: ${[...(recomputedFor[FINAL] ?? [])].length}; share of sample tied at the median:`);
  console.log('  ' + Object.entries(refSample).map(([k, v]) => `${k} ${(100 * v.ties).toFixed(1)}%`).join(', '));
  for (const [k, v] of Object.entries(refSample).filter(([, v]) => v.ties >= 0.03)) {
    console.log(`  ${k}: ${(100 * v.below).toFixed(1)}% of the sample sits below the median value and ${(100 * (v.below + v.ties)).toFixed(1)}% at or below it`);
  }

  const V3_REF_FILE = 'src/lib/scoring/v3ReferenceStats.json';
  if (process.argv.includes('--write-v3-refs')) {
    const components: Record<string, Record<string, { median: number; stddev: number; n: number }>> = {};
    for (const key of [...(recomputedFor[FINAL] ?? [])].sort()) {
      const [comp, pos] = key.split(':') as [Component, GranularPosition];
      (components[comp] ??= {})[pos] = { ...refs[FINAL][pos][comp], n: refSample[key].n };
    }
    writeFileSync(V3_REF_FILE, JSON.stringify({
      engine: 'v3',
      season,
      generated: new Date().toISOString().slice(0, 10),
      source: `player_stats ${season} + FotMob scrape, appearances of 45+ minutes`,
      method: 'median and population stddev per position; wide defenders pooled, LW/RW pooled (as scripts/recompute_reference_stats.mjs)',
      components,
    }, null, 2) + '\n');
    console.log(`Wrote ${V3_REF_FILE}`);
  }

  interface Line {
    player_id: string; name: string; pos: GranularPosition; club: string; et: ElementType;
    apps: number; minutes: number; goals: number; assists: number; lbp: number; aerialNet: number;
    pts: Record<StepKey, number>;
  }
  const lines = new Map<string, Line>();
  // Mean points by goals conceded (0, 1, 2, 3+), 80+ minutes, for positions scored on defending.
  const GC_GROUP: Partial<Record<GranularPosition, string>> = { GK: 'GK', CB: 'CB', LB: 'FB', RB: 'FB', LWB: 'FB', RWB: 'FB', DM: 'DM' };
  const gcAgg: Record<string, Record<number, Record<StepKey, number[]>>> = {};
  // Clean-sheet dependence, 80+ minutes, same groups as gcAgg.
  const csDep: Record<string, Partial<Record<StepKey, { pts: number; cs: boolean; xgc: number }[]>>> = {};
  const perApp = {} as Record<string, Record<StepKey, number[]>>;
  // Starts: FPL doesn't record who started, so 60+ minutes stands in for it.
  const perStart = {} as Record<string, Record<StepKey, number[]>>;
  // Agreement with FotMob's own match rating, 60+ minutes (see printAgreement).
  const agreement: { pos: GranularPosition; fotmob: number; ours: Record<StepKey, number> }[] = [];
  // --dump-apps: every 80+ minute appearance with points and Defensive per step.
  const dumped: Record<string, unknown>[] = [];
  for (const r of apps) {
    const pos = r.players.primary_position as GranularPosition;
    const meta = playerMeta.get(r.player_id)!;
    const slug = clubOf.get(r.player_id) ?? clubByFplCode(meta.teamCode)?.slug;
    const line = lines.get(r.player_id) ?? {
      player_id: r.player_id, name: r.players.web_name, pos, et: meta.et,
      club: (slug && CLUB_BY_SLUG.get(slug)?.shortName) ?? '—',
      apps: 0, minutes: 0, goals: 0, assists: 0, lbp: 0, aerialNet: 0,
      pts: Object.fromEntries(STEPS.map((s) => [s.key, 0])) as Record<StepKey, number>,
    };
    line.apps++; line.minutes += r.stats.minutes_played;
    line.goals += r.stats.goals ?? 0; line.assists += r.stats.assists ?? 0;
    const extra = fotmobFields(r);
    line.lbp += extra.line_breaking_passes ?? 0;
    line.aerialNet += (extra.aerials_won ?? 0) - (extra.aerials_lost ?? 0);
    perApp[pos] ??= Object.fromEntries(STEPS.map((s) => [s.key, []])) as unknown as Record<StepKey, number[]>;
    const gcGroup = GC_GROUP[pos];
    const gcKey = Math.min(r.stats.goals_conceded ?? 0, 3);
    const fotmobRating = fotmob.get(`${r.player_id}:${r.match_id}`)?.stats['FotMob rating']?.value;
    const agreeRow = r.stats.minutes_played >= 60 && typeof fotmobRating === 'number'
      ? { pos, fotmob: fotmobRating, ours: {} as Record<StepKey, number> } : null;
    if (agreeRow) agreement.push(agreeRow);
    const dumpRow = process.argv.includes('--dump-apps') && r.stats.minutes_played >= 80 ? {
      name: r.players.web_name, club: clubOf.get(r.player_id), gw: r.gameweek, pos, gc: r.stats.goals_conceded,
      xgc: r.stats.expected_goals_conceded, cs: !!r.stats.clean_sheet, tackles: r.stats.fpl_tackles, cbi: r.stats.fpl_cbi,
      recoveries: r.stats.fpl_recoveries, aerials: fotmobFields(r).aerials_won, fotmob: fotmobRating,
      goals: r.stats.goals, assists: r.stats.assists, xg: r.stats.expected_goals, xa: r.stats.expected_assists,
      xgot: fotmob.get(`${r.player_id}:${r.match_id}`)?.stats['Expected goals on target (xGOT)']?.value ?? 0,
      shots: fotmob.get(`${r.player_id}:${r.match_id}`)?.stats['Total shots']?.value ?? 0,
      penalty_goals: fotmobFields(r).penalty_goals ?? 0,
      chances: fotmob.get(`${r.player_id}:${r.match_id}`)?.stats['Chances created']?.value ?? 0,
      duels: fotmob.get(`${r.player_id}:${r.match_id}`)?.stats['Ground duels won']?.value ?? 0,
      steps: {} as Record<string, unknown>,
    } : null;
    if (dumpRow) dumped.push(dumpRow);
    for (const step of STEPS) {
      const result = calculateMatchRating(statsFor(r, step), pos, refs[step.key], pos, step.options);
      if (dumpRow) dumpRow.steps[step.key] = {
        pts: +result.fantasyPoints.toFixed(2), rating: +result.rating.toFixed(2),
        defRaw: +defensiveRawInput(statsFor(r, step), pos, pos, step.options).defensiveRaw.toFixed(2),
        defScore: +(result.breakdown.find((b) => b.key === 'defensive')?.score ?? 0).toFixed(3),
        defRef: refs[step.key][pos].defensive,
      };
      const pts = result.fantasyPoints;
      if (agreeRow) agreeRow.ours[step.key] = result.rating;
      line.pts[step.key] += pts;
      perApp[pos][step.key].push(pts);
      if (r.stats.minutes_played >= 60) ((perStart[pos] ??= {} as Record<StepKey, number[]>)[step.key] ??= []).push(pts);
      if (gcGroup && r.stats.minutes_played >= 80) (((csDep[gcGroup] ??= {})[step.key] ??= [])).push({ pts, cs: !!r.stats.clean_sheet, xgc: r.stats.expected_goals_conceded ?? 0 });
      if (gcGroup && r.stats.minutes_played >= 80) ((gcAgg[gcGroup] ??= {})[gcKey] ??= {} as Record<StepKey, number[]>)[step.key] = [...(gcAgg[gcGroup][gcKey][step.key] ?? []), pts];
    }
    lines.set(r.player_id, line);
  }

  // The checked-in V3 references must reproduce the final column exactly.
  const finalStep = STEPS.find((s) => s.key === FINAL)!;
  const mismatches = apps.filter((r) => {
    const pos = r.players.primary_position as GranularPosition;
    const withFile = calculateMatchRating(statsFor(r, finalStep), pos, v2Ref, pos, { ...finalStep.options, v3References: true }).fantasyPoints;
    return Math.abs(withFile - calculateMatchRating(statsFor(r, finalStep), pos, refs[FINAL], pos, finalStep.options).fantasyPoints) > 1e-9;
  }).length;
  console.log(mismatches
    ? `\nWARNING: ${V3_REF_FILE} does not reproduce the '${FINAL}' column for ${mismatches} appearances. Rerun with --write-v3-refs.`
    : `\n${V3_REF_FILE} reproduces the '${FINAL}' column exactly.`);

  console.log('\nMean points per appearance');
  console.log('pos      n' + STEPS.map((s) => s.key.padStart(8)).join(''));
  for (const pos of POSITIONS) {
    const a = perApp[pos];
    if (a) console.log(`${pos.padEnd(4)} ${String(a.v2.length).padStart(5)}` + STEPS.map((s) => mean(a[s.key]).toFixed(2).padStart(8)).join(''));
  }

  const all = [...lines.values()].map((l) => ({
    ...l,
    lbp90: +(l.minutes ? (l.lbp * 90) / l.minutes : 0).toFixed(2),
    aerial90: +(l.minutes ? (l.aerialNet * 90) / l.minutes : 0).toFixed(2),
    pts: Object.fromEntries(STEPS.map((s) => [s.key, +l.pts[s.key].toFixed(1)])) as Record<StepKey, number>,
  }));
  const ranks = Object.fromEntries(STEPS.map((s) => [s.key,
    new Map([...all].sort((a, b) => b.pts[s.key] - a.pts[s.key]).map((l, i) => [l.player_id, i + 1]))])) as Record<StepKey, Map<string, number>>;
  const last = STEPS[STEPS.length - 1].key;
  const board = all
    .map((l) => ({ ...l, rank: Object.fromEntries(STEPS.map((s) => [s.key, ranks[s.key].get(l.player_id)!])) as Record<StepKey, number> }))
    .sort((a, b) => a.rank[last] - b.rank[last]);
  const positions = POSITIONS.filter((p) => perApp[p]).map((p) => ({
    pos: p, apps: perApp[p].v2.length, starts: perStart[p]?.v2.length ?? 0,
    ...Object.fromEntries(STEPS.map((s) => [s.key, +mean(perApp[p][s.key]).toFixed(2)])),
    startPpg: Object.fromEntries(STEPS.map((s) => [s.key, +mean(perStart[p]?.[s.key] ?? []).toFixed(2)])),
  }));
  console.log('\nPoints per start (60+ min) by position');
  console.log('pos  starts' + STEPS.map((s) => s.key.padStart(8)).join(''));
  for (const p of positions) console.log(`${p.pos.padEnd(4)} ${String(p.starts).padStart(6)}` + STEPS.map((s) => (p.startPpg as any)[s.key].toFixed(2).padStart(8)).join(''));
  printAgreement(agreement);
  if (dumped.length) {
    writeFileSync(`${OUT_DIR}/apps_${season}.json`, JSON.stringify(dumped));
    console.log(`Wrote ${dumped.length} appearances of 80+ minutes to ${OUT_DIR}/apps_${season}.json`);
  }
  console.log('\nMean points by goals conceded, 80+ minutes');
  console.log('group gc ' + STEPS.map((s) => s.key.padStart(8)).join(''));
  const gcTable = Object.entries(gcAgg).flatMap(([group, byGc]) => Object.entries(byGc).map(([gc, bySteps]) => ({
    group, gc: Number(gc), n: bySteps.v2.length,
    ...Object.fromEntries(STEPS.map((s) => [s.key, +mean(bySteps[s.key]).toFixed(1)])),
  })));
  for (const row of gcTable) console.log(`${row.group.padEnd(5)} ${row.gc === 3 ? '3+' : row.gc}  ` + STEPS.map((s) => String((row as any)[s.key]).padStart(8)).join(''));
  // How much of a defender's score is the clean sheet? Share of the variance
  // in points explained by whether the team kept one, the mean with and
  // without, and how many 20+ point games came without one.
  console.log('\nClean-sheet dependence, 80+ minutes: % of points variance explained by the clean sheet | mean with / without | 20+ pt games without one');
  for (const [group, bySteps] of Object.entries(csDep)) {
    console.log(group + '   ' + STEPS.map((st) => {
      const a = bySteps[st.key] ?? []; if (!a.length) return '';
      const all = mean(a.map((x) => x.pts)), w = a.filter((x) => x.cs), wo = a.filter((x) => !x.cs);
      const tot = a.reduce((t, x) => t + (x.pts - all) ** 2, 0);
      const between = w.length * (mean(w.map((x) => x.pts)) - all) ** 2 + wo.length * (mean(wo.map((x) => x.pts)) - all) ** 2;
      const big = a.filter((x) => x.pts >= 20), bigNo = big.filter((x) => !x.cs).length;
      return `${st.key} ${(100 * between / tot).toFixed(0)}% ${mean(w.map((x) => x.pts)).toFixed(1)}/${mean(wo.map((x) => x.pts)).toFixed(1)} ${bigNo}/${big.length}`;
    }).join(' | '));
  }
  // Clean sheets by the opponent's chances: controlled (xGC < 0.6), middling, survived (1.2+).
  console.log('\nClean-sheet games by opponent chances, 80+ minutes: mean points at xGC <0.6 / 0.6-1.2 / 1.2+');
  for (const [group, bySteps] of Object.entries(csDep)) {
    console.log(group + '   ' + STEPS.map((st) => {
      const cs = (bySteps[st.key] ?? []).filter((x) => x.cs);
      const band = (lo: number, hi: number) => mean(cs.filter((x) => x.xgc >= lo && x.xgc < hi).map((x) => x.pts)).toFixed(1);
      return `${st.key} ${band(0, 0.6)}/${band(0.6, 1.2)}/${band(1.2, 99)}`;
    }).join(' | '));
  }
  const out = `${OUT_DIR}/leaderboard_${season}.json`;
  writeFileSync(out, JSON.stringify({
    season, generated: new Date().toISOString(),
    steps: STEPS.map(({ key, label }) => ({ key, label })), positions, gcTable, players: board,
  }, null, 1));

  console.log('\nTop 25 after all steps: points and rank at each step');
  for (const l of board.slice(0, 25)) {
    console.log(`${l.name.padEnd(16)} ${l.pos.padEnd(3)} ${l.club.padEnd(4)} ` +
      STEPS.map((s) => `${l.pts[s.key].toFixed(0).padStart(5)} #${String(l.rank[s.key]).padEnd(4)}`).join(' ') + `  lbp/90 ${l.lbp90}  aerial net/90 ${l.aerial90}`);
  }
  console.log(`\nWrote ${board.length} players to ${out}`);
}

/** Spearman rank correlation. */
function spearman(x: number[], y: number[]): number {
  const rank = (a: number[]) => {
    const idx = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(x), ry = rank(y), n = x.length, mx = mean(rx), my = mean(ry);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * The no-regression gate. FotMob's rating is an independent judgement of each
 * performance, so a change should not make Gaffa's rating agree with it less,
 * at any position. Three views:
 *  - Spearman per position: does the change keep good games above bad ones?
 *  - Spearman pooled: does it keep positions on one scale with each other?
 *  - Changed appearances: for the games a step actually moves (rating moved
 *    by 0.01+ against the step before), the gap between Gaffa's percentile
 *    and FotMob's within the position, before and after. A whole-season
 *    correlation barely notices a rule that touches 1% of games; this does.
 * FotMob is a benchmark, not a target. Its rating is a model with its own
 * blind spots, and Gaffa aims to do better than it where FotMob and SofaScore
 * are unreliable. So a step is never tuned to agree, and a step that agrees
 * less somewhere either goes back or names the reason it disagrees on
 * purpose. The bootstrap interval is a rough guide to noise (resampling
 * duplicates appearances, which adds ties), not a test.
 */
function printAgreement(rows: { pos: GranularPosition; fotmob: number; ours: Record<StepKey, number> }[]) {
  console.log(`\nAgreement with FotMob rating (Spearman), ${rows.length} appearances of 60+ minutes`);
  console.log('pos      n' + STEPS.map((s) => s.key.padStart(8)).join(''));
  for (const pos of [...POSITIONS, 'all' as const]) {
    const sub = pos === 'all' ? rows : rows.filter((r) => r.pos === pos);
    if (sub.length < 30) continue;
    console.log(`${pos.padEnd(4)} ${String(sub.length).padStart(5)}` + STEPS.map((s) => spearman(sub.map((r) => r.ours[s.key]), sub.map((r) => r.fotmob)).toFixed(3).padStart(8)).join(''));
  }
  // Positional balance: each position's share of the season's best games (top
  // 10% by rating, all positions pooled), against its share of all games.
  console.log('\nShare of the top 10% of games by rating, all positions pooled (% ; FotMob first)');
  console.log('pos   games  FotMob' + STEPS.map((s) => s.key.padStart(8)).join(''));
  const topShare = (key: (r: (typeof rows)[number]) => number) => {
    const cut = [...rows].map(key).sort((a, b) => b - a)[Math.floor(rows.length * 0.1)];
    const top = rows.filter((r) => key(r) > cut);
    return (pos: GranularPosition) => (100 * top.filter((r) => r.pos === pos).length) / top.length;
  };
  const fmShare = topShare((r) => r.fotmob), stepShare = STEPS.map((s) => topShare((r) => r.ours[s.key]));
  for (const pos of POSITIONS) {
    const n = rows.filter((r) => r.pos === pos).length;
    if (n < 30) continue;
    console.log(`${pos.padEnd(4)} ${(100 * n / rows.length).toFixed(1).padStart(6)} ${fmShare(pos).toFixed(1).padStart(7)}` + stepShare.map((f) => f(pos).toFixed(1).padStart(8)).join(''));
  }
  // Each step against the one before, per position: the change in Spearman
  // with a 95% bootstrap interval (300 resamples of appearances, paired).
  // ▼ = significantly less agreement, ▲ = significantly more, · = within noise.
  console.log('\nChange in agreement against the step before (x1000), 95% bootstrap interval');
  console.log('pos  ' + STEPS.slice(1).map((s) => s.key.padStart(20)).join(''));
  let seed = 1;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const pos of [...POSITIONS, 'all' as const]) {
    const sub = pos === 'all' ? rows : rows.filter((r) => r.pos === pos);
    if (sub.length < 30) continue;
    const cells = STEPS.slice(1).map((step, i) => {
      const prev = STEPS[i].key, cur = step.key;
      const d = (rs: typeof sub) => spearman(rs.map((r) => r.ours[cur]), rs.map((r) => r.fotmob)) - spearman(rs.map((r) => r.ours[prev]), rs.map((r) => r.fotmob));
      const point = d(sub);
      if (sub.every((r) => r.ours[cur] === r.ours[prev])) return '0'.padStart(20);
      const boots = Array.from({ length: 300 }, () => d(Array.from({ length: sub.length }, () => sub[Math.floor(rand() * sub.length)]))).sort((a, b) => a - b);
      const lo = boots[7], hi = boots[292];
      const mark = hi < 0 ? '▼' : lo > 0 ? '▲' : '·';
      return `${mark}${(1000 * point).toFixed(1)} [${(1000 * lo).toFixed(1)},${(1000 * hi).toFixed(1)}]`.padStart(20);
    });
    console.log(`${pos.padEnd(4)} ${cells.join('')}`);
  }
  // Percentile within position, per step and for FotMob.
  const pct = (vals: number[]) => {
    const sorted = [...vals].sort((a, b) => a - b);
    return (x: number) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; } return lo / sorted.length; };
  };
  const byPos = new Map<GranularPosition, typeof rows>();
  for (const r of rows) byPos.set(r.pos, [...(byPos.get(r.pos) ?? []), r]);
  console.log('\nChanged appearances: gap between Gaffa and FotMob percentile within position, before -> after');
  for (let i = 1; i < STEPS.length; i++) {
    const prev = STEPS[i - 1].key, cur = STEPS[i].key;
    let n = 0, before = 0, after = 0, closer = 0, further = 0;
    for (const sub of byPos.values()) {
      const fm = pct(sub.map((r) => r.fotmob)), p0 = pct(sub.map((r) => r.ours[prev])), p1 = pct(sub.map((r) => r.ours[cur]));
      for (const r of sub) {
        if (Math.abs(r.ours[cur] - r.ours[prev]) < 0.01) continue;
        const g0 = Math.abs(p0(r.ours[prev]) - fm(r.fotmob)), g1 = Math.abs(p1(r.ours[cur]) - fm(r.fotmob));
        n++; before += g0; after += g1;
        if (g1 < g0 - 0.005) closer++; else if (g1 > g0 + 0.005) further++;
      }
    }
    console.log(`${cur.padEnd(7)} ${String(n).padStart(5)} changed   gap ${(100 * before / (n || 1)).toFixed(1)} -> ${(100 * after / (n || 1)).toFixed(1)} pct points   closer ${closer}, further ${further}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
