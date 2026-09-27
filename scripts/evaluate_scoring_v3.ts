/**
 * Scores a whole season under V2 and V3 side by side, from the stats already
 * stored in `player_stats`, and writes a per-player leaderboard.
 *
 *   node_modules/.bin/tsx scripts/evaluate_scoring_v3.ts [--season=2025-26]
 *
 * Read-only against the database. Output: scratch/v3_eval/leaderboard_<season>.json
 *
 * V3 references. Each engine version is normalized against reference stats
 * computed from its own formulas. V2 uses the stored `rating_reference_stats`
 * rows, as production does. V3 changes only Match Impact's raw input, so V3
 * uses the same rows with match_impact recomputed per position, using the
 * method of scripts/recompute_reference_stats.mjs (appearances of 45+
 * minutes, wide defenders pooled, LW/RW pooled, median and population
 * stddev). The script recomputes V2's match_impact the same way and prints it
 * beside the stored value, so any gap in method shows up before it is trusted.
 *
 * FPL element types. FPL reassigns player ids every season, and
 * `players.fpl_id` holds the current season's id. The season's own element
 * type comes from vaastav/Fantasy-Premier-League's players_raw.csv, joined on
 * FPL's stable per-player `code` via the current bootstrap.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  calculateMatchRating,
  DEFAULT_REFERENCE_STATS,
  fallbackElementType,
  matchImpactRawInput,
} from '../src/lib/scoring/matchRating';
import { CLUB_BY_SLUG, clubByFplCode } from '../src/lib/clubs/registry';
import type { GranularPosition, RawStats, ReferenceStats } from '../src/types';

for (const line of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split('\n') : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

const season = process.argv.find((a) => a.startsWith('--season='))?.split('=')[1] ?? '2025-26';
const OUT_DIR = 'scratch/v3_eval';
const POSITIONS: GranularPosition[] = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const WIDE_DEF: GranularPosition[] = ['LB', 'RB', 'LWB', 'RWB'];
type RefMap = Record<GranularPosition, ReferenceStats>;
type ElementType = 1 | 2 | 3 | 4;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function loadSeasonElementTypes(): Promise<{
  byCurrentFplId: Map<number, { et: ElementType; teamCode: number }>;
  bySeasonId: Map<number, { et: ElementType; teamCode: number; webName: string }>;
}> {
  mkdirSync(OUT_DIR, { recursive: true });
  const cache = `${OUT_DIR}/players_raw_${season}.csv`;
  if (!existsSync(cache)) {
    const url = `https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/${season}/players_raw.csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`players_raw.csv for ${season}: HTTP ${res.status}`);
    writeFileSync(cache, await res.text());
  }
  const seasonRows = parseCsv(readFileSync(cache, 'utf8'));
  const byCode = new Map<number, { et: ElementType; teamCode: number }>();
  const bySeasonId = new Map<number, { et: ElementType; teamCode: number; webName: string }>();
  for (const r of seasonRows) {
    const v = { et: Number(r.element_type) as ElementType, teamCode: Number(r.team_code) };
    byCode.set(Number(r.code), v);
    bySeasonId.set(Number(r.id), { ...v, webName: r.web_name });
  }
  const boot = await (await fetch('https://fantasy.premierleague.com/api/bootstrap-static/')).json();
  const byCurrentFplId = new Map<number, { et: ElementType; teamCode: number }>();
  for (const el of boot.elements) {
    const hit = byCode.get(el.code);
    if (hit) byCurrentFplId.set(el.id, hit);
  }
  return { byCurrentFplId, bySeasonId };
}

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

  const { byCurrentFplId, bySeasonId } = await loadSeasonElementTypes();

  const rows = await fetchAll<any>((f, t) => supabase.from('player_stats')
    .select('id, player_id, gameweek, stats, players!inner(web_name, primary_position, fpl_id)')
    .eq('season', season).order('id').range(f, t));
  const clubRows = await fetchAll<any>((f, t) => supabase.from('player_season_clubs')
    .select('player_id, club_slug').eq('season', season).order('player_id').range(f, t));
  const clubOf = new Map<string, string>(clubRows.map((r) => [r.player_id, r.club_slug]));

  // Element type per player: FPL's stable code when the player is still in
  // FPL. A player who has left has no current id (or a stale one), so match
  // him by name in the season's list, using his club that season to break
  // ties. Anything still unmatched falls back to a position-based guess.
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const seasonByName = new Map<string, { et: ElementType; teamCode: number }[]>();
  for (const v of bySeasonId.values()) {
    const k = norm(v.webName);
    seasonByName.set(k, [...(seasonByName.get(k) ?? []), v]);
  }
  const etSource = { code: 0, name: 0, fallback: 0 };
  const fallbackNames: string[] = [];
  const playerMeta = new Map<string, { et: ElementType; teamCode?: number }>();
  for (const r of rows) {
    if (playerMeta.has(r.player_id) || !((r.stats?.minutes_played ?? 0) > 0)) continue;
    const p = r.players;
    const byCode = p.fpl_id != null ? byCurrentFplId.get(p.fpl_id) : undefined;
    if (byCode) { playerMeta.set(r.player_id, byCode); etSource.code++; continue; }
    const clubCode = CLUB_BY_SLUG.get(clubOf.get(r.player_id) ?? '')?.fplCode;
    const named = seasonByName.get(norm(p.web_name)) ?? [];
    const hit = named.length === 1 ? named[0] : named.find((v) => v.teamCode === clubCode);
    if (hit) { playerMeta.set(r.player_id, hit); etSource.name++; continue; }
    playerMeta.set(r.player_id, { et: fallbackElementType(p.primary_position) });
    etSource.fallback++;
    fallbackNames.push(p.web_name);
  }
  console.log(`Element types for players with minutes: ${etSource.code} by FPL code, ${etSource.name} by name, ${etSource.fallback} guessed from position`);
  if (fallbackNames.length) console.log(`  guessed: ${fallbackNames.join(', ')}`);

  const apps = rows.filter((r) => (r.stats?.minutes_played ?? 0) > 0 && POSITIONS.includes(r.players.primary_position));
  const withEt = (r: any, version: 'v2' | 'v3'): RawStats =>
    ({ ...r.stats, engine_version: version, fpl_element_type: playerMeta.get(r.player_id)!.et });

  // V3 reference: V2's rows with match_impact recomputed from the V3 formula.
  const pool = (pos: GranularPosition): GranularPosition[] =>
    WIDE_DEF.includes(pos) ? WIDE_DEF : pos === 'LW' || pos === 'RW' ? ['LW', 'RW'] : [pos];
  const v3Ref: RefMap = JSON.parse(JSON.stringify(v2Ref));
  console.log('\nMatch Impact reference (median / stddev)');
  console.log('pos   stored V2        recomputed V2    recomputed V3     n');
  for (const pos of POSITIONS) {
    const sample = apps.filter((r) => pool(pos).includes(r.players.primary_position) && r.stats.minutes_played >= 45);
    const v2Raw = sample.map((r) => matchImpactRawInput(withEt(r, 'v2'), r.players.primary_position));
    const v3Raw = sample.map((r) => matchImpactRawInput(withEt(r, 'v3'), r.players.primary_position));
    v3Ref[pos].match_impact = { median: median(v3Raw), stddev: Number(pstdev(v3Raw).toFixed(4)) };
    const s = v2Ref[pos].match_impact;
    console.log(`${pos.padEnd(4)}  ${s.median.toFixed(2).padStart(6)} / ${s.stddev.toFixed(2).padStart(5)}   ` +
      `${median(v2Raw).toFixed(2).padStart(6)} / ${pstdev(v2Raw).toFixed(2).padStart(5)}   ` +
      `${median(v3Raw).toFixed(2).padStart(6)} / ${pstdev(v3Raw).toFixed(2).padStart(5)}   ${sample.length}`);
  }

  interface Line { player_id: string; name: string; pos: GranularPosition; club: string; et: ElementType; apps: number; minutes: number; goals: number; assists: number; v2: number; v3: number }
  const lines = new Map<string, Line>();
  const perApp: Record<string, { v2: number[]; v3: number[] }> = {};
  for (const r of apps) {
    const pos = r.players.primary_position as GranularPosition;
    const v2 = calculateMatchRating(withEt(r, 'v2'), pos, v2Ref, pos).fantasyPoints;
    const v3 = calculateMatchRating(withEt(r, 'v3'), pos, v3Ref, pos).fantasyPoints;
    (perApp[pos] ??= { v2: [], v3: [] }).v2.push(v2);
    perApp[pos].v3.push(v3);
    const meta = playerMeta.get(r.player_id)!;
    const slug = clubOf.get(r.player_id) ?? clubByFplCode(meta.teamCode)?.slug;
    const line = lines.get(r.player_id) ?? {
      player_id: r.player_id, name: r.players.web_name, pos, et: meta.et,
      club: (slug && CLUB_BY_SLUG.get(slug)?.shortName) ?? '—',
      apps: 0, minutes: 0, goals: 0, assists: 0, v2: 0, v3: 0,
    };
    line.apps++; line.minutes += r.stats.minutes_played;
    line.goals += r.stats.goals ?? 0; line.assists += r.stats.assists ?? 0;
    line.v2 += v2; line.v3 += v3;
    lines.set(r.player_id, line);
  }

  console.log('\nMean points per appearance');
  console.log('pos      n     V2     V3   change');
  for (const pos of POSITIONS) {
    const a = perApp[pos];
    if (!a) continue;
    console.log(`${pos.padEnd(4)} ${String(a.v2.length).padStart(5)}  ${mean(a.v2).toFixed(2).padStart(5)}  ${mean(a.v3).toFixed(2).padStart(5)}  ${(mean(a.v3) - mean(a.v2)).toFixed(2).padStart(6)}`);
  }

  const all = [...lines.values()].map((l) => ({ ...l, v2: +l.v2.toFixed(1), v3: +l.v3.toFixed(1) }));
  const rankBy = (k: 'v2' | 'v3') => new Map([...all].sort((a, b) => b[k] - a[k]).map((l, i) => [l.player_id, i + 1]));
  const r2 = rankBy('v2'), r3 = rankBy('v3');
  const board = all.map((l) => ({ ...l, rank_v2: r2.get(l.player_id)!, rank_v3: r3.get(l.player_id)! }))
    .sort((a, b) => a.rank_v3 - b.rank_v3);
  const out = `${OUT_DIR}/leaderboard_${season}.json`;
  const positions = POSITIONS.filter((p) => perApp[p]).map((p) => ({
    pos: p, apps: perApp[p].v2.length,
    v2: +mean(perApp[p].v2).toFixed(2), v3: +mean(perApp[p].v3).toFixed(2),
  }));
  writeFileSync(out, JSON.stringify({ season, generated: new Date().toISOString(), positions, players: board }, null, 1));
  console.log(`\nTop 20 under V3 (V2 rank in brackets)`);
  for (const l of board.slice(0, 20)) {
    console.log(`${String(l.rank_v3).padStart(3)} [${String(l.rank_v2).padStart(3)}] ${l.name.padEnd(16)} ${l.pos.padEnd(3)} ${l.club.padEnd(4)} ${l.v2.toFixed(0).padStart(5)} → ${l.v3.toFixed(0).padStart(5)}`);
  }
  console.log(`\nWrote ${board.length} players to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
