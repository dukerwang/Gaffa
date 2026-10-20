/**
 * Stores where each starter stood for every match of a season that has kicked
 * off and has no stored lineup yet (pl_match_lineups, migration 177).
 *
 *   node --experimental-strip-types --no-warnings --import ./scratch/register-ts.mjs \
 *     scripts/backfill_pl_lineups.ts --season 2026-27
 *
 * The stats sync does the same for each gameweek as it goes; this catches up
 * the matches played before it did. Writes as it goes, and a second run only
 * fetches what is still missing. About one request per match.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { syncPlLineups } from '../src/lib/fixtures/plLineups.ts';

const ROOT = resolve(import.meta.dirname, '..');
const i = process.argv.indexOf('--season');
const SEASON = i >= 0 ? process.argv[i + 1] : undefined;
if (!SEASON || !/^\d{4}-\d{2}$/.test(SEASON)) throw new Error('--season YYYY-YY is required');

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const k = l.indexOf('='); return [l.slice(0, k).trim(), l.slice(k + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

const { data, error } = await sb
  .from('pl_fixtures')
  .select('fpl_fixture_id, gameweek, home_club, away_club, kickoff_time')
  .eq('season', SEASON)
  .lte('kickoff_time', new Date().toISOString())
  .order('kickoff_time');
if (error) throw error;

const targets = (data ?? []).map((f) => ({ id: f.fpl_fixture_id, gameweek: f.gameweek, home: f.home_club, away: f.away_club }));
console.log(`season ${SEASON}: ${targets.length} match(es) kicked off`);
const result = await syncPlLineups(sb as never, SEASON, targets);
console.log(`wrote ${result.written}, skipped ${result.skipped}`);
