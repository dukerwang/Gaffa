/**
 * Re-draws a league's cups from the seeding table (src/lib/tournaments/seeding.ts)
 * when they were seeded from the wrong one. Only cups with no tie played are
 * touched.
 *
 *   node --experimental-strip-types --no-warnings --import ./scratch/register-ts.mjs \
 *     scripts/reseed_cups.ts --league <league-id> [--apply] [--announce]
 *
 * Without --apply it prints each cup's current first round and writes nothing.
 * --apply rebuilds the cups and sends NO notices. --announce sends each
 * manager their first-round draw notice from the brackets as they stand now,
 * as a separate step, so the wording can be agreed first.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const i = process.argv.indexOf('--league');
const LEAGUE = i >= 0 ? process.argv[i + 1] : undefined;
if (!LEAGUE) throw new Error('--league <league-id> is required');
const APPLY = process.argv.includes('--apply');
const ANNOUNCE = process.argv.includes('--announce');

// Loaded before the app modules so push (VAPID) and Supabase read their keys.
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const k = line.indexOf('=');
  process.env[line.slice(0, k).trim()] ??= line.slice(k + 1).trim().replace(/^["']|["']$/g, '');
}

const { reseedUnplayedCups } = await import('../src/lib/tournaments/reseedCups.ts');
const { announceFirstRound } = await import('../src/lib/tournaments/createTournaments.ts');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: league, error } = await sb.from('leagues').select('name, current_season').eq('id', LEAGUE).single();
if (error || !league) throw new Error(`League not found: ${error?.message}`);

if (ANNOUNCE) {
  const { data: cups } = await sb
    .from('tournaments')
    .select('id, name, type')
    .eq('league_id', LEAGUE)
    .eq('season', league.current_season)
    .in('type', ['primary_cup', 'secondary_cup']);
  for (const cup of cups ?? []) {
    await announceFirstRound(sb, cup.id, { corrected: true });
    console.log(`announced ${cup.name} first round`);
  }
  process.exit(0);
}

console.log(`${league.name} (${league.current_season}) ${APPLY ? 'APPLY (no notices)' : 'dry run'}`);
const outcomes = await reseedUnplayedCups(sb, LEAGUE, league.current_season, { dryRun: !APPLY, silent: true });
for (const o of outcomes) {
  if (o.status === 'kept') {
    console.log(`\n${o.type}: kept (${o.reason})`);
    continue;
  }
  console.log(`\n${o.type}: ${APPLY ? 'reseeded' : 'would reseed'}`);
  console.log('  before:', o.before.join(' | '));
  if (APPLY) console.log('  after: ', o.after.join(' | '));
}
