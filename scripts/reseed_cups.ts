/**
 * Re-draws a league's cups from the current table when they were seeded before
 * any games were played (alphabetical seeds, byes to the wrong clubs). Only
 * cups with no tie played are touched, and every manager gets a redraw notice.
 *
 *   node --experimental-strip-types --no-warnings --import ./scratch/register-ts.mjs \
 *     scripts/reseed_cups.ts --league <league-id> [--apply]
 *
 * Without --apply it prints each cup's current first round and writes nothing.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const i = process.argv.indexOf('--league');
const LEAGUE = i >= 0 ? process.argv[i + 1] : undefined;
if (!LEAGUE) throw new Error('--league <league-id> is required');
const APPLY = process.argv.includes('--apply');

// Loaded before the app modules so push (VAPID) and Supabase read their keys.
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const k = line.indexOf('=');
  process.env[line.slice(0, k).trim()] ??= line.slice(k + 1).trim().replace(/^["']|["']$/g, '');
}

const { reseedUnplayedCups } = await import('../src/lib/tournaments/reseedCups.ts');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: league, error } = await sb.from('leagues').select('name, current_season').eq('id', LEAGUE).single();
if (error || !league) throw new Error(`League not found: ${error?.message}`);

console.log(`${league.name} (${league.current_season}) ${APPLY ? 'APPLY' : 'dry run'}`);
const outcomes = await reseedUnplayedCups(sb, LEAGUE, league.current_season, { dryRun: !APPLY });
for (const o of outcomes) {
  if (o.status === 'kept') {
    console.log(`\n${o.type}: kept (${o.reason})`);
    continue;
  }
  console.log(`\n${o.type}: ${APPLY ? 'reseeded' : 'would reseed'}`);
  console.log('  before:', o.before.join(' | '));
  if (APPLY) console.log('  after: ', o.after.join(' | '));
}
