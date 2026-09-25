/**
 * Refits `src/lib/scoring/fotmobCenteringRates.json` from `player_stats` rows
 * that carry FotMob passing and aerial fields (`line_breaking_passes`,
 * `passes_into_final_third`, `aerials_won`, `aerials_lost`).
 *
 * Mirrors the workflow of `scripts/fit_ict_imputation.ts` and
 * `src/lib/scoring/ictImputation.json`.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fit_fotmob_centering_rates.ts [--season=2026-27] [--write]
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { GranularPosition } from '../src/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALL_POS: GranularPosition[] = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST',
];

async function main() {
  const writeFlag = process.argv.includes('--write');
  const seasonArg = process.argv.find((a) => a.startsWith('--season='))?.split('=')[1] ?? '2026-27';

  let rows: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('player_stats')
      .select('stats, players!inner(primary_position)')
      .eq('season', seasonArg)
      .range(from, from + 999);
    if (!data?.length) break;
    rows.push(
      ...data.filter(
        (d: any) =>
          (d.stats?.minutes_played || 0) >= 45 &&
          d.stats?.line_breaking_passes !== undefined,
      ),
    );
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Found ${rows.length} FotMob-enriched appearances (minutes >= 45) in season ${seasonArg}`);
  if (rows.length === 0) {
    console.log('No FotMob-enriched rows in player_stats yet; keeping existing fotmobCenteringRates.json.');
    return;
  }

  const outPath = path.resolve(__dirname, '../src/lib/scoring/fotmobCenteringRates.json');
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));

  for (const pos of ALL_POS) {
    const sub = rows.filter((r) => r.players.primary_position === pos);
    if (sub.length < 10) continue;
    const totalMin = sub.reduce((s, r) => s + Number(r.stats.minutes_played || 0), 0) || 1;
    const lbp = sub.reduce((s, r) => s + Number(r.stats.line_breaking_passes || 0), 0);
    const pft = sub.reduce((s, r) => s + Number(r.stats.passes_into_final_third || 0), 0);
    const netAd = sub.reduce(
      (s, r) => s + (Number(r.stats.aerials_won || 0) - Number(r.stats.aerials_lost || 0)),
      0,
    );
    existing.ratesPerMinute[pos] = {
      lbpPerMin: Number((lbp / totalMin).toFixed(4)),
      pftPerMin: Number((pft / totalMin).toFixed(4)),
      netAdPerMin: Number((netAd / totalMin).toFixed(4)),
    };
  }

  existing.fittedOn = `${seasonArg} (n=${rows.length})`;
  console.log('Computed per-minute rates:', existing.ratesPerMinute);

  if (writeFlag) {
    fs.writeFileSync(outPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
    console.log(`Updated ${outPath}`);
  }
}

main();
