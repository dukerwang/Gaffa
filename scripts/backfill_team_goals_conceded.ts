/**
 * Adds `team_goals_conceded` to a season's clean-sheet rows that predate it,
 * and rewrites the clean sheet wording in their stored performance block.
 *
 *   node --experimental-strip-types --no-warnings --import ./scratch/register-ts.mjs \
 *     scripts/backfill_team_goals_conceded.ts [--season 2026-27] [--apply]
 *
 * Why: FPL awards a clean sheet for a player's own minutes, so a defender
 * subbed off before his side conceded keeps one. The performance block now
 * says so ("clean sheet until subbed off after 64 minutes"), but it can only
 * tell when the row records what the side conceded, and the live sync only
 * started writing that on 2026-10-26.
 *
 * Only clean-sheet rows are touched: the field changes no other line.
 *
 * Scores and bands are NOT recomputed. Since migration 140 `perf` is the
 * snapshot of the engine that paid the points; this only swaps the evidence
 * sentence of the `defending` and `goalsPrevented` groups, which are built
 * from the stats alone.
 *
 * The club comes from `players.pl_team`, today's club, because
 * `player_season_clubs` is only written when a season is archived. A player
 * whose current club wasn't in the fixture (moved since) is skipped rather
 * than guessed. Run it on the live season only.
 *
 * Dry run by default. Idempotent.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveClub } from '../src/lib/clubs/registry.ts';
import { cleanSheetPhrase, type PerfGroup } from '../src/lib/scoring/perfBand.ts';
import type { RawStats } from '../src/types/index.ts';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const argOf = (flag: string, fallback: string) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const SEASON = argOf('--season', '2026-27');
const APPLY = args.includes('--apply');

const env = Object.fromEntries(
    readFileSync(resolve(ROOT, '.env.local'), 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

const PAGE = 1000;
async function page<T>(table: string, select: string, apply: (q: any) => any): Promise<T[]> {
    const out: T[] = [];
    for (let p = 0; ; p++) {
        const { data, error } = await apply(sb.from(table).select(select))
            .order('id', { ascending: true })
            .range(p * PAGE, (p + 1) * PAGE - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        if (!data?.length) break;
        out.push(...data);
        if (data.length < PAGE) break;
    }
    return out;
}

console.log(`season ${SEASON} — ${APPLY ? 'APPLY' : 'dry run'}`);

const { data: fixtures, error: fxErr } = await sb
    .from('pl_fixtures')
    .select('fpl_fixture_id, home_club, away_club, home_score, away_score')
    .eq('season', SEASON);
if (fxErr) throw new Error(`pl_fixtures: ${fxErr.message}`);
const fixtureById = new Map((fixtures ?? []).map((f) => [f.fpl_fixture_id, f]));

const rows = await page<any>(
    'player_stats',
    'id, match_id, stats, perf, players!inner(web_name, pl_team, primary_position)',
    (q: any) => q.eq('season', SEASON).eq('stats->>clean_sheet', 'true'),
);
console.log(`clean-sheet rows: ${rows.length}`);

let skipped = 0, unchanged = 0;
const updates: Array<{ id: string; stats: RawStats; perf: PerfGroup[] | null; label: string }> = [];
for (const r of rows) {
    const f = fixtureById.get(r.match_id);
    const slug = resolveClub(r.players.pl_team)?.slug;
    if (!f || f.home_score == null || f.away_score == null || !slug) { skipped++; continue; }
    const conceded = slug === f.home_club ? f.away_score : slug === f.away_club ? f.home_score : null;
    if (conceded == null) { skipped++; continue; }

    const stats: RawStats = { ...r.stats, team_goals_conceded: conceded };
    // Swap only the phrase, never regenerate the sentence: some snapshots were
    // written under an older position or wording (a player graded as a CB
    // then, so his recoveries were left out) and must stay as they were.
    let perf: PerfGroup[] | null = r.perf;
    const phrase = cleanSheetPhrase(stats);
    if (Array.isArray(r.perf) && phrase !== 'clean sheet') {
        perf = r.perf.map((g: PerfGroup) => {
            if (g.key !== 'defending' && g.key !== 'goalsPrevented') return g;
            const evidence = g.evidence
                .replace(/\bclean sheet\b(?! until| after| while)/, phrase)
                .replace(/^Clean sheet\b(?! until| after| while)/, `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`);
            return evidence === g.evidence ? g : { ...g, evidence };
        });
    }
    if (r.stats.team_goals_conceded === conceded && JSON.stringify(perf) === JSON.stringify(r.perf)) {
        unchanged++;
        continue;
    }
    const changedLine = perf?.find((g, i) => g.evidence !== r.perf?.[i]?.evidence)?.evidence;
    updates.push({ id: r.id, stats, perf, label: `${r.players.web_name}: ${changedLine ?? `(field only, conceded ${conceded})`}` });
}

console.log(`to write: ${updates.length}, unchanged: ${unchanged}, skipped (no fixture/club match): ${skipped}`);
for (const u of updates.filter((u) => !u.label.includes('(field only'))) console.log(`  ${u.label}`);

if (APPLY) {
    let written = 0;
    for (const u of updates) {
        const { error } = await sb.from('player_stats').update({ stats: u.stats, perf: u.perf }).eq('id', u.id);
        if (error) throw new Error(`update ${u.id}: ${error.message}`);
        written++;
    }
    console.log(`written: ${written}`);
}
