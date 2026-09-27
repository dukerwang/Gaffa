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
 * production does. The V3 steps change only Match Impact's raw input, so they
 * use the same rows with match_impact recomputed per position, using the
 * method of scripts/recompute_reference_stats.mjs (appearances of 45+
 * minutes, wide defenders pooled, LW/RW pooled, median and population
 * stddev). The script also recomputes V2's match_impact the same way and
 * prints it beside the stored value, so any gap in method shows up before it
 * is trusted.
 *
 * FPL element types come from the season's own player list, resolved by
 * scripts/lib/fplSeasonPlayers.ts.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  calculateMatchRating,
  DEFAULT_REFERENCE_STATS,
  fallbackElementType,
  matchImpactRawInput,
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

type StepKey = 'v2' | 'goal' | 'lbp';
interface Step { key: StepKey; label: string; version: 'v2' | 'v3'; fields: (keyof RawStats)[] }
const STEPS: Step[] = [
  { key: 'v2', label: 'V2', version: 'v2', fields: [] },
  { key: 'goal', label: 'Goal BPS fix', version: 'v3', fields: ['penalty_goals'] },
  { key: 'lbp', label: '+ Line-breaking passes', version: 'v3', fields: ['penalty_goals', 'line_breaking_passes'] },
];

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
  const fotmobFields = (r: any): Partial<RawStats> => {
    const f = fotmob.get(`${r.player_id}:${r.match_id}`);
    return f ? { penalty_goals: f.penalty_goals, line_breaking_passes: f.stats['Line breaking passes']?.value ?? 0 } : {};
  };
  const statsFor = (r: any, step: Step): RawStats => {
    const extra = fotmobFields(r) as Record<string, unknown>;
    const picked = Object.fromEntries(step.fields.filter((k) => k in extra).map((k) => [k, extra[k]]));
    return { ...r.stats, ...picked, engine_version: step.version, fpl_element_type: playerMeta.get(r.player_id)!.et };
  };

  // References per step: V2's stored rows, with match_impact recomputed for V3 steps.
  const pool = (pos: GranularPosition): GranularPosition[] =>
    WIDE_DEF.includes(pos) ? WIDE_DEF : pos === 'LW' || pos === 'RW' ? ['LW', 'RW'] : [pos];
  const refs = {} as Record<StepKey, RefMap>;
  for (const step of STEPS) refs[step.key] = JSON.parse(JSON.stringify(v2Ref));
  console.log('\nMatch Impact reference, median / stddev (V2 as stored, then recomputed per step)');
  console.log('pos ' + ['stored', ...STEPS.map((s) => s.key)].map((h) => h.padStart(15)).join(''));
  for (const pos of POSITIONS) {
    const sample = apps.filter((r) => pool(pos).includes(r.players.primary_position) && r.stats.minutes_played >= 45);
    const cells = [`${v2Ref[pos].match_impact.median.toFixed(2)} / ${v2Ref[pos].match_impact.stddev.toFixed(2)}`];
    for (const step of STEPS) {
      const raw = sample.map((r) => matchImpactRawInput(statsFor(r, step), r.players.primary_position));
      const recomputed = { median: median(raw), stddev: Number(pstdev(raw).toFixed(4)) };
      if (step.version === 'v3') refs[step.key][pos].match_impact = recomputed;
      cells.push(`${recomputed.median.toFixed(2)} / ${recomputed.stddev.toFixed(2)}`);
    }
    console.log(`${pos.padEnd(4)}${cells.map((c) => c.padStart(15)).join('')}   n=${sample.length}`);
  }

  interface Line {
    player_id: string; name: string; pos: GranularPosition; club: string; et: ElementType;
    apps: number; minutes: number; goals: number; assists: number; lbp: number;
    pts: Record<StepKey, number>;
  }
  const lines = new Map<string, Line>();
  const perApp = {} as Record<string, Record<StepKey, number[]>>;
  for (const r of apps) {
    const pos = r.players.primary_position as GranularPosition;
    const meta = playerMeta.get(r.player_id)!;
    const slug = clubOf.get(r.player_id) ?? clubByFplCode(meta.teamCode)?.slug;
    const line = lines.get(r.player_id) ?? {
      player_id: r.player_id, name: r.players.web_name, pos, et: meta.et,
      club: (slug && CLUB_BY_SLUG.get(slug)?.shortName) ?? '—',
      apps: 0, minutes: 0, goals: 0, assists: 0, lbp: 0, pts: { v2: 0, goal: 0, lbp: 0 },
    };
    line.apps++; line.minutes += r.stats.minutes_played;
    line.goals += r.stats.goals ?? 0; line.assists += r.stats.assists ?? 0;
    line.lbp += fotmobFields(r).line_breaking_passes ?? 0;
    perApp[pos] ??= { v2: [], goal: [], lbp: [] };
    for (const step of STEPS) {
      const pts = calculateMatchRating(statsFor(r, step), pos, refs[step.key], pos).fantasyPoints;
      line.pts[step.key] += pts;
      perApp[pos][step.key].push(pts);
    }
    lines.set(r.player_id, line);
  }

  console.log('\nMean points per appearance');
  console.log('pos      n' + STEPS.map((s) => s.key.padStart(8)).join(''));
  for (const pos of POSITIONS) {
    const a = perApp[pos];
    if (a) console.log(`${pos.padEnd(4)} ${String(a.v2.length).padStart(5)}` + STEPS.map((s) => mean(a[s.key]).toFixed(2).padStart(8)).join(''));
  }

  const all = [...lines.values()].map((l) => ({
    ...l,
    lbp90: +(l.minutes ? (l.lbp * 90) / l.minutes : 0).toFixed(2),
    pts: Object.fromEntries(STEPS.map((s) => [s.key, +l.pts[s.key].toFixed(1)])) as Record<StepKey, number>,
  }));
  const ranks = Object.fromEntries(STEPS.map((s) => [s.key,
    new Map([...all].sort((a, b) => b.pts[s.key] - a.pts[s.key]).map((l, i) => [l.player_id, i + 1]))])) as Record<StepKey, Map<string, number>>;
  const last = STEPS[STEPS.length - 1].key;
  const board = all
    .map((l) => ({ ...l, rank: Object.fromEntries(STEPS.map((s) => [s.key, ranks[s.key].get(l.player_id)!])) as Record<StepKey, number> }))
    .sort((a, b) => a.rank[last] - b.rank[last]);
  const positions = POSITIONS.filter((p) => perApp[p]).map((p) => ({
    pos: p, apps: perApp[p].v2.length,
    ...Object.fromEntries(STEPS.map((s) => [s.key, +mean(perApp[p][s.key]).toFixed(2)])),
  }));
  const out = `${OUT_DIR}/leaderboard_${season}.json`;
  writeFileSync(out, JSON.stringify({
    season, generated: new Date().toISOString(),
    steps: STEPS.map(({ key, label }) => ({ key, label })), positions, players: board,
  }, null, 1));

  console.log('\nTop 25 after all steps: points and rank at each step');
  for (const l of board.slice(0, 25)) {
    console.log(`${l.name.padEnd(16)} ${l.pos.padEnd(3)} ${l.club.padEnd(4)} ` +
      STEPS.map((s) => `${l.pts[s.key].toFixed(0).padStart(5)} #${String(l.rank[s.key]).padEnd(4)}`).join(' ') + `  lbp/90 ${l.lbp90}`);
  }
  console.log(`\nWrote ${board.length} players to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
