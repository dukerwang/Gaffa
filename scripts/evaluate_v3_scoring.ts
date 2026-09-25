/**
 * scripts/evaluate_v3_scoring.ts
 *
 * Permanent, reproducible evaluation script for Gaffa Scoring Engine V3.
 * Reproduces:
 *   1. The 12-position V2 vs V3 comparison and quantile distribution (P10, P25, Median, P75, P90)
 *      on the 2026-27 sample (N = 1,419).
 *   2. The CB Clean-Sheet vs Non-Clean-Sheet split and z-space spread preservation check.
 *   3. The Pillar 1 Shadow Mode GW1-3 -> GW4-5 out-of-sample holdout evaluation (N = 528).
 *
 * Usage:
 *   npx tsx scripts/evaluate_v3_scoring.ts
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import {
  calculateMatchRating,
  calculateShadowPillar1Rating,
  DEFAULT_REFERENCE_STATS,
  defaultElementTypeForPosition,
} from '../src/lib/scoring/matchRating';
import type { GranularPosition, RawStats } from '../src/types';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const POSITIONS: GranularPosition[] = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST',
];

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
}

function quantile(arr: number[], q: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

async function fetchAllStats(season: string) {
  const rows: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('player_stats')
      .select('player_id, gameweek, match_id, stats, players!inner(primary_position, web_name)')
      .eq('season', season)
      .range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return rows;
}

async function main() {
  const rows = await fetchAllStats('2026-27');
  const active = rows.filter((r) => (r.stats?.minutes_played ?? 0) > 0);
  console.log(`Loaded ${active.length} active appearances from 2026-27.\n`);

  console.log('=== 1. 12-Position V2 vs V3 Comparison (2026-27, N = ' + active.length + ') ===');
  console.log(
    'Pos   |    N | V2 PPG | V3 PPG |  Delta | V3 P10 | V3 P25 | V3 Med | V3 P75 | V3 P90',
  );
  console.log('-'.repeat(84));

  for (const pos of POSITIONS) {
    const posRows = active.filter((r) => r.players.primary_position === pos);
    const v2Pts: number[] = [];
    const v3Pts: number[] = [];
    for (const r of posRows) {
      const baseStats: RawStats = {
        ...r.stats,
        fpl_element_type: r.stats?.fpl_element_type ?? defaultElementTypeForPosition(pos),
      };
      const v2 = calculateMatchRating(
        { ...baseStats, engine_version: 'v2' },
        pos,
        DEFAULT_REFERENCE_STATS,
      );
      const v3 = calculateMatchRating(
        { ...baseStats, engine_version: 'v3' },
        pos,
        DEFAULT_REFERENCE_STATS,
      );
      v2Pts.push(v2.fantasyPoints);
      v3Pts.push(v3.fantasyPoints);
    }
    const m2 = mean(v2Pts);
    const m3 = mean(v3Pts);
    const d = m3 - m2;
    console.log(
      `${pos.padEnd(5)} | ${String(posRows.length).padStart(4)} | ${m2.toFixed(2).padStart(6)} | ${m3.toFixed(2).padStart(6)} | ${(d >= 0 ? '+' : '') + d.toFixed(2).padStart(5)} | ${quantile(v3Pts, 0.1).toFixed(2).padStart(6)} | ${quantile(v3Pts, 0.25).toFixed(2).padStart(6)} | ${quantile(v3Pts, 0.5).toFixed(2).padStart(6)} | ${quantile(v3Pts, 0.75).toFixed(2).padStart(6)} | ${quantile(v3Pts, 0.9).toFixed(2).padStart(6)}`,
    );
  }

  // CB CS vs No-CS check
  const cbRows = active.filter((r) => r.players.primary_position === 'CB');
  const cbCs = cbRows.filter((r) => r.stats.clean_sheet && r.stats.minutes_played >= 60);
  const cbNoCs = cbRows.filter((r) => !(r.stats.clean_sheet && r.stats.minutes_played >= 60));

  const scoreSet = (subset: any[], ver: 'v2' | 'v3') =>
    subset.map((r) =>
      calculateMatchRating(
        {
          ...r.stats,
          engine_version: ver,
          fpl_element_type: r.stats?.fpl_element_type ?? 2,
        },
        'CB',
        DEFAULT_REFERENCE_STATS,
      ),
    );

  const cbCsV2 = scoreSet(cbCs, 'v2');
  const cbCsV3 = scoreSet(cbCs, 'v3');
  const cbNoCsV2 = scoreSet(cbNoCs, 'v2');
  const cbNoCsV3 = scoreSet(cbNoCs, 'v3');

  console.log('\n=== 2. CB Clean Sheet vs Non-Clean Sheet Spread Check ===');
  console.log(
    `CB Clean Sheet (N=${cbCs.length}):     V2 PPG=${mean(cbCsV2.map((x) => x.fantasyPoints)).toFixed(2)} (SD=${stdev(cbCsV2.map((x) => x.rating)).toFixed(3)}) -> V3 PPG=${mean(cbCsV3.map((x) => x.fantasyPoints)).toFixed(2)} (SD=${stdev(cbCsV3.map((x) => x.rating)).toFixed(3)})`,
  );
  console.log(
    `CB Non-Clean Sheet (N=${cbNoCs.length}): V2 PPG=${mean(cbNoCsV2.map((x) => x.fantasyPoints)).toFixed(2)} (SD=${stdev(cbNoCsV2.map((x) => x.rating)).toFixed(3)}) -> V3 PPG=${mean(cbNoCsV3.map((x) => x.fantasyPoints)).toFixed(2)} (SD=${stdev(cbNoCsV3.map((x) => x.rating)).toFixed(3)})`,
  );

  // Pillar 1 Shadow check on GW4-5 holdout
  const holdout = active.filter((r) => r.gameweek >= 4 && r.gameweek <= 5);
  const p1Deltas = holdout.map((r) => {
    const pos = r.players.primary_position as GranularPosition;
    const base: RawStats = {
      ...r.stats,
      engine_version: 'v3',
      fpl_element_type: r.stats?.fpl_element_type ?? defaultElementTypeForPosition(pos),
    };
    const v3 = calculateMatchRating(base, pos, DEFAULT_REFERENCE_STATS);
    const p1 = calculateShadowPillar1Rating(base, pos, DEFAULT_REFERENCE_STATS);
    return p1.fantasyPoints - v3.fantasyPoints;
  });
  console.log(
    `\n=== 3. Pillar 1 Shadow Fallback Neutrality on GW4-5 Holdout (N=${holdout.length}) ===`,
  );
  console.log(`Mean Fallback Points Delta (P1 Shadow - V3 Base): ${mean(p1Deltas).toFixed(4)} PPG`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
