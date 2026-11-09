/**
 * Removes a league's cups that were drawn under an earlier rule, so they are
 * drawn again when due (after the gameweek before their first round, from the
 * finished table; src/lib/tournaments/seeding.ts). Only cups with no tie played
 * are removed, and no notice is sent.
 *
 *   node --experimental-strip-types --no-warnings --import ./scratch/register-ts.mjs \
 *     scripts/undraw_cups.ts --league <league-id> [--apply]
 *
 * Without --apply it prints what would be removed and writes nothing.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const i = process.argv.indexOf('--league');
const LEAGUE = i >= 0 ? process.argv[i + 1] : undefined;
if (!LEAGUE) throw new Error('--league <league-id> is required');
const APPLY = process.argv.includes('--apply');

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const k = line.indexOf('=');
  process.env[line.slice(0, k).trim()] ??= line.slice(k + 1).trim().replace(/^["']|["']$/g, '');
}

const { undrawUnplayedCups } = await import('../src/lib/tournaments/undrawCups.ts');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: league, error } = await sb.from('leagues').select('name, current_season').eq('id', LEAGUE).single();
if (error || !league) throw new Error(`League not found: ${error?.message}`);

console.log(`${league.name} (${league.current_season}) ${APPLY ? 'APPLY' : 'dry run'}`);
for (const o of await undrawUnplayedCups(sb, LEAGUE, league.current_season, { dryRun: !APPLY })) {
  if (o.status === 'kept') console.log(`\n${o.type}: kept (${o.reason})`);
  else console.log(`\n${o.type}: ${o.status}\n  was: ${o.firstRound.join(' | ')}`);
}
