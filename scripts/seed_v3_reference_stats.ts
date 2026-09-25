/**
 * Non-destructive V3 reference-stats seeder for `rating_reference_stats`.
 *
 * Why this exists instead of running `recompute_reference_stats.mjs`:
 *   1. `rating_reference_stats` currently holds 96 rows for `2025-26` (the 8 V2
 *      components across 12 positions), which `getLatestReferenceStatsSeason()`
 *      selects for all `2026-27` scoring.
 *   2. Writing any `2026-27` rows would switch `getLatestReferenceStatsSeason()`
 *      to `2026-27` and alter V2 re-scores of GW1–5 matchups.
 *   3. Deleting and re-inserting `2025-26` rows would risk perturbing the 96 V2
 *      rows last written on 2026-05-25.
 *
 * This script computes ONLY the two new V3 components (`match_impact_v3` and
 * `defensive_work` — 24 rows total across the 12 positions) from the `2025-26`
 * `player_stats` dataset (`minutes_played >= 45`) and upserts ONLY those 24 rows
 * under `season = '2025-26'`.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed_v3_reference_stats.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/seed_v3_reference_stats.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import type { GranularPosition } from '../src/types';
import { getPositionGroup } from '../src/lib/scoring/matchRating';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALL_POS: GranularPosition[] = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST',
];

function calcMedian(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function calcStddev(arr: number[]): number {
  if (!arr.length) return 1;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length) || 1;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const targetSeason = '2025-26';

  // Verify existing rating_reference_stats rows before doing anything
  const { data: existingRef } = await supabase
    .from('rating_reference_stats')
    .select('season, component')
    .order('season', { ascending: true });

  const bySeason = new Map<string, number>();
  for (const r of existingRef ?? []) {
    bySeason.set(r.season, (bySeason.get(r.season) ?? 0) + 1);
  }
  console.log('Existing rating_reference_stats counts by season:', Object.fromEntries(bySeason));

  // Fetch FPL bootstrap to map fpl_id -> element_type
  const fplRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
  const fplData = await fplRes.json();
  const fplIdToElementType = new Map<number, number>();
  for (const el of fplData.elements || []) {
    fplIdToElementType.set(Number(el.id), Number(el.element_type));
  }

  let rows: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('player_stats')
      .select('player_id, stats, players!inner(primary_position, fpl_id)')
      .eq('season', targetSeason)
      .range(from, from + 999);
    if (!data?.length) break;
    rows.push(...data.filter((d: any) => (d.stats?.minutes_played || 0) >= 45));
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Loaded ${rows.length} appearances with minutes >= 45 from ${targetSeason}`);

  function getElemType(r: any): number {
    const fplId = r.players?.fpl_id;
    if (fplId && fplIdToElementType.has(Number(fplId))) {
      return fplIdToElementType.get(Number(fplId))!;
    }
    const g = getPositionGroup(r.players.primary_position);
    return g === 'GK' ? 1 : g === 'DEF' ? 2 : g === 'MID' ? 3 : 4;
  }

  function computeMatchImpactV3Raw(r: any): number {
    const s = r.stats;
    const et = getElemType(r);
    const gUnit = et <= 2 ? 12 : et === 3 ? 18 : 24;
    const gaBps = Number(s.goals || 0) * gUnit + Number(s.assists || 0) * 9;
    const csGc = et === 2
      ? (((s.clean_sheet && Number(s.minutes_played || 0) >= 60) ? 12 : 0) - Number(s.goals_conceded || 0) * 4)
      : 0;
    return Math.max(0, Number(s.bps || 0) - gaBps - csGc);
  }

  function computeDefensiveWorkRaw(r: any, pos: GranularPosition): number {
    const s = r.stats;
    const gc = Number(s.goals_conceded || 0);
    const xgc = Number(s.expected_goals_conceded || 0);
    const m = Number(s.minutes_played || 0);
    const posGroup = getPositionGroup(pos);
    // For DEF and DM, clean sheet is applied in z-space post-normalization, so csBonus = 0 in defensive_work
    let csBonus = 0;
    if (s.clean_sheet && m >= 60) {
      if (pos === 'GK') csBonus = 16;
      else if (posGroup === 'DEF' || pos === 'DM') csBonus = 0;
      else if (pos === 'CM') csBonus = 4;
    }
    const xgcOutperf = Math.max(0, xgc - gc) * 5;
    const gcPenalty = Math.max(0, gc - xgc) * 5;
    const tackles = Math.max(0, Number(s.fpl_tackles || 0));
    const cbi = Math.max(0, Number(s.fpl_cbi || 0));
    const rec = Math.max(0, Number(s.fpl_recoveries || 0));
    let acts = 0;
    if (pos === 'GK') acts = rec * 0.4;
    else if (pos === 'CB') acts = tackles + cbi * 0.5 + rec * 0.5;
    else acts = tackles + cbi + rec * 0.5;
    return acts + csBonus + xgcOutperf - gcPenalty;
  }

  const upserts: {
    position_group: string;
    component: string;
    median: number;
    stddev: number;
    sample_size: number;
    season: string;
  }[] = [];

  for (const pos of ALL_POS) {
    const sub = rows.filter((r) => {
      const p = r.players.primary_position;
      return (pos === 'LW' || pos === 'RW') ? (p === 'LW' || p === 'RW') : p === pos;
    });
    const miList = sub.map((r) => computeMatchImpactV3Raw(r));
    const defWorkList = sub.map((r) => computeDefensiveWorkRaw(r, pos));

    const miMed = Number(calcMedian(miList).toFixed(4));
    const miStd = Number(calcStddev(miList).toFixed(4));
    const dwMed = Number(calcMedian(defWorkList).toFixed(4));
    const dwStd = Number(calcStddev(defWorkList).toFixed(4));

    upserts.push(
      {
        position_group: pos,
        component: 'match_impact_v3',
        median: miMed,
        stddev: miStd,
        sample_size: sub.length,
        season: targetSeason,
      },
      {
        position_group: pos,
        component: 'defensive_work',
        median: dwMed,
        stddev: dwStd,
        sample_size: sub.length,
        season: targetSeason,
      },
    );
    console.log(
      `${pos.padEnd(3)} (n=${String(sub.length).padStart(4)}) | match_impact_v3: [${miMed.toFixed(2)}, ${miStd.toFixed(2)}] | defensive_work: [${dwMed.toFixed(2)}, ${dwStd.toFixed(2)}]`,
    );
  }

  if (apply) {
    const { error } = await supabase
      .from('rating_reference_stats')
      .upsert(upserts, { onConflict: 'position_group,component,season' });
    if (error) {
      console.error('Upsert error:', error);
      process.exit(1);
    }
    console.log(`Successfully upserted ${upserts.length} V3 reference rows into rating_reference_stats for season ${targetSeason}.`);
  } else {
    console.log('\nDry run complete (--apply not passed). No database rows modified.');
  }
}

main();
