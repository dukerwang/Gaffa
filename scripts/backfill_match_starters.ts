/**
 * Writes the per-match `started` flag onto `player_stats.stats` for gameweeks
 * synced before the stats sync began recording it (2026-10-20).
 *
 *   node --experimental-strip-types --no-warnings --import ./scratch/register-ts.mjs \
 *     scripts/backfill_match_starters.ts --season 2026-27 [--to 7] [--apply]
 *
 * The Lineup Builder reads the flag to show a match's starting lineups. It
 * refetches `event/{gw}/live`, so it only reaches the season FPL is serving
 * now; FPL stops serving a season once it rolls over. Run it for the current
 * season only, and before the rollover.
 *
 * Merges the one key into each row's existing stats blob and writes nothing
 * else. Idempotent: a second pass reports nothing to write. Dry run by default.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startedFixtures } from '../src/lib/fixtures/starters.ts';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const argOf = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
};
const SEASON = argOf('--season');
const APPLY = args.includes('--apply');
if (!SEASON || !/^\d{4}-\d{2}$/.test(SEASON)) throw new Error('--season YYYY-YY is required');

const env = Object.fromEntries(
    readFileSync(resolve(ROOT, '.env.local'), 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
const FPL = 'https://fantasy.premierleague.com/api';
const SYNTHETIC_MATCH_ID_FLOOR = 1000;
const PAGE = 1000;

interface FplEvent { id: number; finished: boolean; is_current: boolean }
interface FplExplain { fixture: number; stats: { identifier: string; value: number }[] }
interface FplLiveElement { id: number; stats?: { starts?: number }; explain?: FplExplain[] }

const boot = await (await fetch(`${FPL}/bootstrap-static/`, { headers: { 'User-Agent': 'FantasyFutbol/1.0' } })).json();
const events = boot.events as FplEvent[];
const lastDone = Math.max(0, ...events.filter((e) => e.finished || e.is_current).map((e) => e.id));
const TO = Number(argOf('--to') ?? lastDone);
console.log(`season ${SEASON}, gameweeks 1-${TO}, ${APPLY ? 'APPLY' : 'dry run'}`);

const players: { id: string; fpl_id: number | null }[] = [];
for (let p = 0; ; p++) {
    const { data, error } = await sb.from('players').select('id, fpl_id').not('fpl_id', 'is', null)
        .order('id').range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) throw error;
    players.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
}
const playerByFpl = new Map(players.map((p) => [p.fpl_id, p.id]));

let total = 0;
for (let gw = 1; gw <= TO; gw++) {
    const live = await (await fetch(`${FPL}/event/${gw}/live/`, { headers: { 'User-Agent': 'FantasyFutbol/1.0' } })).json();
    // player id -> fixture id -> started
    const flags = new Map<string, Map<number, boolean>>();
    for (const el of (live.elements ?? []) as FplLiveElement[]) {
        const playerId = playerByFpl.get(el.id);
        if (!playerId) continue;
        const real = (el.explain ?? []).filter((ex) => ex.fixture < SYNTHETIC_MATCH_ID_FLOOR);
        const started = startedFixtures(el.stats?.starts, real);
        flags.set(playerId, new Map(real.map((ex) => [ex.fixture, started.has(ex.fixture)])));
    }

    const rows: { id: string; player_id: string; match_id: number; stats: Record<string, unknown> | null }[] = [];
    for (let p = 0; ; p++) {
        const { data, error } = await sb.from('player_stats').select('id, player_id, match_id, stats')
            .eq('season', SEASON).eq('gameweek', gw).order('id').range(p * PAGE, (p + 1) * PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
    }

    const updates = rows.flatMap((r) => {
        const started = r.match_id < SYNTHETIC_MATCH_ID_FLOOR ? flags.get(r.player_id)?.get(r.match_id) ?? false : false;
        if (r.stats?.started === started) return [];
        return [{ id: r.id, stats: { ...(r.stats ?? {}), started } }];
    });
    const starters = updates.filter((u) => u.stats.started).length;
    console.log(`GW${gw}: ${rows.length} rows, ${updates.length} to write (${starters} starters)`);
    total += updates.length;

    if (APPLY) {
        for (let i = 0; i < updates.length; i += 25) {
            const batch = updates.slice(i, i + 25);
            const results = await Promise.all(
                batch.map((u) => sb.from('player_stats').update({ stats: u.stats }).eq('id', u.id)),
            );
            const failed = results.find((res) => res.error);
            if (failed?.error) throw failed.error;
        }
    }
}
console.log(`${APPLY ? 'wrote' : 'would write'} ${total} rows`);
