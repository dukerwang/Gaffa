/**
 * Dry run of the V3 stats sync for one finished gameweek. Writes nothing.
 *
 *   node_modules/.bin/tsx scripts/dry_run_v3_gameweek.ts --gw=5 [--season=2026-27]
 *
 * Rebuilds each appearance from FPL's live payload the way /api/sync/stats
 * does, then:
 *   1. rescores it as V2 and compares with the points stored in player_stats,
 *      which checks this rebuild matches what the sync actually wrote;
 *   2. adds the FotMob fields through the sync's own functions
 *      (fetchGameweekEnrichment, withV3Fields) and scores it as V3.
 *
 * Only the season's current gameweeks can be checked: FPL's live endpoint
 * serves the current season.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { calculateMatchRating, mapFplLiveToRawStats } from '../src/lib/scoring/engine';
import { loadReferenceStats } from '../src/lib/scoring/matchups';
import { appearanceKey, fetchGameweekEnrichment, withV3Fields } from '../src/lib/fotmob/gameweekEnrichment';
import { slugMapFromBootstrapTeams } from '../src/lib/clubs/registry';
import type { GranularPosition } from '../src/types';
import { fetchAll } from './lib/fetchAll';

for (const line of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split('\n') : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
process.env.VITEST = '1'; // loadReferenceStats: read the table directly instead of Next's cache
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const gameweek = Number(arg('gw'));
const season = arg('season') ?? '2026-27';
const FPL = 'https://fantasy.premierleague.com/api';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  if (!gameweek) throw new Error('--gw=N required');
  const [live, fixtures, boot] = await Promise.all([
    fetch(`${FPL}/event/${gameweek}/live/`).then((r) => r.json()),
    fetch(`${FPL}/fixtures/?event=${gameweek}`).then((r) => r.json()),
    fetch(`${FPL}/bootstrap-static/`).then((r) => r.json()),
  ]);
  const refStats = await loadReferenceStats(supabase as any, '2025-26');
  const players = await fetchAll<any>((f, t) => supabase.from('players').select('id, fpl_id, primary_position, web_name').not('fpl_id', 'is', null).order('id').range(f, t));
  const byFpl = new Map(players.map((p) => [p.fpl_id, p]));
  const stored = await fetchAll<any>((f, t) => supabase.from('player_stats').select('player_id, match_id, fantasy_points')
    .eq('season', season).eq('gameweek', gameweek).order('id').range(f, t));
  const storedPts = new Map(stored.map((r) => [`${r.player_id}:${r.match_id}`, Number(r.fantasy_points)]));
  const info = new Map<number, { code: number; et: 1 | 2 | 3 | 4 }>(boot.elements.map((e: any) => [e.id, { code: e.code, et: e.element_type }]));
  const slugOf = slugMapFromBootstrapTeams(boot.teams);

  const t0 = Date.now();
  const enrichment = await fetchGameweekEnrichment(season, (fixtures as any[]).map((f) => ({
    fplFixtureId: f.id, homeSlug: slugOf.get(f.team_h) ?? '', awaySlug: slugOf.get(f.team_a) ?? '',
  })));
  console.log(`GW${gameweek} ${season}: FotMob ${enrichment.fixtures.filter((f) => f.ok).length}/${enrichment.fixtures.length} fixtures in ${Date.now() - t0} ms, ${enrichment.byAppearance.size} appearances`);
  for (const f of enrichment.fixtures.filter((x) => !x.ok)) console.log(`  failed: fixture ${f.fplFixtureId}: ${f.error}`);

  let compared = 0, v2Match = 0, missing = 0;
  const v2Diffs: string[] = [];
  const rows: { name: string; pos: string; min: number; v2: number; v3: number }[] = [];
  for (const el of live.elements as any[]) {
    const p = byFpl.get(el.id);
    if (!p || !el.explain?.length) continue;
    for (const ex of el.explain) {
      const mins = ex.stats.find((s: any) => s.identifier === 'minutes')?.value ?? 0;
      if (mins <= 0) continue;
      // Same construction as /api/sync/stats (post-lockdown pass, ICT present).
      const ratio = mins / (el.stats.minutes || 1);
      const find = (k: string) => ex.stats.find((s: any) => s.identifier === k)?.value;
      const raw = mapFplLiveToRawStats({
        ...el.stats, minutes: mins,
        goals_scored: find('goals_scored') ?? 0, assists: find('assists') ?? 0,
        clean_sheets: find('clean_sheets') ?? (el.stats.clean_sheets ?? 0),
        goals_conceded: find('goals_conceded') ?? Math.round((el.stats.goals_conceded ?? 0) * ratio),
        saves: find('saves') ?? Math.round((el.stats.saves ?? 0) * ratio),
        penalties_saved: find('penalties_saved') ?? 0, penalties_missed: find('penalties_missed') ?? 0,
        yellow_cards: find('yellow_cards') ?? 0, red_cards: find('red_cards') ?? 0, own_goals: find('own_goals') ?? 0,
        bonus: find('bonus') ?? 0, bps: Math.round((el.stats.bps ?? 0) * ratio),
        influence: (parseFloat(el.stats.influence) * ratio).toString(), creativity: (parseFloat(el.stats.creativity) * ratio).toString(),
        threat: (parseFloat(el.stats.threat) * ratio).toString(), ict_index: (parseFloat(el.stats.ict_index) * ratio).toString(),
        expected_goals: (parseFloat(el.stats.expected_goals) * ratio).toString(), expected_assists: (parseFloat(el.stats.expected_assists) * ratio).toString(),
        expected_goals_conceded: (parseFloat(el.stats.expected_goals_conceded) * ratio).toString(),
        tackles: Math.round((el.stats.tackles ?? 0) * ratio),
        clearances_blocks_interceptions: Math.round((el.stats.clearances_blocks_interceptions ?? 0) * ratio),
        recoveries: Math.round((el.stats.recoveries ?? 0) * ratio),
        defensive_contribution: Math.round((el.stats.defensive_contribution ?? 0) * ratio),
      });
      const pos = p.primary_position as GranularPosition;
      const v2 = calculateMatchRating(raw, pos, refStats as any).fantasyPoints;
      const key = `${p.id}:${ex.fixture}`;
      if (storedPts.has(key)) {
        compared++;
        if (Math.abs(storedPts.get(key)! - v2) < 0.005) v2Match++;
        else if (v2Diffs.length < 5) v2Diffs.push(`${p.web_name} stored ${storedPts.get(key)} rebuilt ${v2}`);
      }
      const i = info.get(el.id);
      const fotmob = i ? enrichment.byAppearance.get(appearanceKey(ex.fixture, i.code)) : undefined;
      if (!fotmob) missing++;
      const v3 = calculateMatchRating(withV3Fields(raw, i?.et, fotmob), pos, refStats as any).fantasyPoints;
      rows.push({ name: p.web_name, pos, min: mins, v2, v3 });
    }
  }
  console.log(`Rebuilt V2 matches stored points for ${v2Match}/${compared} appearances${v2Diffs.length ? `; e.g. ${v2Diffs.join('; ')}` : ''}`);
  console.log(`Appearances without FotMob fields: ${missing} of ${rows.length}`);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  console.log(`Mean points per appearance: V2 ${mean(rows.map((r) => r.v2)).toFixed(2)}, V3 ${mean(rows.map((r) => r.v3)).toFixed(2)}`);
  const top = [...rows].sort((a, b) => b.v3 - a.v3).slice(0, 10);
  console.log('Top 10 by V3: ' + top.map((r) => `${r.name} ${r.pos} ${r.v2.toFixed(1)}→${r.v3.toFixed(1)}`).join('; '));
  const moved = [...rows].sort((a, b) => Math.abs(b.v3 - b.v2) - Math.abs(a.v3 - a.v2)).slice(0, 8);
  console.log('Biggest moves: ' + moved.map((r) => `${r.name} ${r.pos} ${r.min}' ${r.v2.toFixed(1)}→${r.v3.toFixed(1)}`).join('; '));
}

main().catch((e) => { console.error(e); process.exit(1); });
