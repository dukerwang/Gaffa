/**
 * Scrapes every finished Premier League match of a season from FotMob and
 * joins each player's stats to his Gaffa appearance.
 *
 *   node_modules/.bin/tsx scripts/scrape_fotmob_season.ts [--season=2025-26] [--concurrency=4]
 *
 * Runs locally, never on Vercel. Read-only against the database.
 *
 * Output, in .fotmob-cache/<season>/ (git-ignored):
 *   matches/<fotmobMatchId>.json  one file per match, as parsed; a rerun
 *                                 fetches only matches not already cached
 *   matched.json                  one row per appearance found in both
 *                                 sources: player_id, FPL fixture, gameweek,
 *                                 and every FotMob stat for that match
 *
 * Joining. A FotMob match maps to an FPL fixture by its two clubs (the pair
 * is unique within a season). A FotMob player maps to a Gaffa appearance in
 * that fixture by Opta id, which equals FPL's per-player code, so no names
 * are compared at this step.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fetchFotmobFixtures, fetchFotmobMatch, type FotmobMatch } from '../src/lib/fotmob/matchDetails';
import { resolveClub } from '../src/lib/clubs/registry';
import { resolveSeasonPlayers } from './lib/fplSeasonPlayers';
import { fetchAll } from './lib/fetchAll';

for (const line of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split('\n') : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const season = arg('season') ?? '2025-26';
const concurrency = Number(arg('concurrency') ?? 4);
const DIR = `.fotmob-cache/${season}`;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scrape(): Promise<FotmobMatch[]> {
  mkdirSync(`${DIR}/matches`, { recursive: true });
  const fixtures = (await fetchFotmobFixtures(season)).filter((f) => f.finished);
  const todo = fixtures.filter((f) => !existsSync(`${DIR}/matches/${f.matchId}.json`));
  console.log(`${season}: ${fixtures.length} finished matches, ${fixtures.length - todo.length} cached, ${todo.length} to fetch`);
  const failed: number[] = [];
  const t0 = Date.now();
  for (let i = 0; i < todo.length; i += concurrency) {
    await Promise.all(todo.slice(i, i + concurrency).map(async (f) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const match = await fetchFotmobMatch(f.matchId);
          writeFileSync(`${DIR}/matches/${f.matchId}.json`, JSON.stringify(match));
          return;
        } catch (e) {
          if (attempt === 3) { failed.push(f.matchId); console.warn(`  ${f.matchId}: ${(e as Error).message}`); }
          else await sleep(1500 * attempt);
        }
      }
    }));
    process.stdout.write(`\r  fetched ${Math.min(i + concurrency, todo.length)}/${todo.length}`);
    await sleep(300); // polite spacing between batches
  }
  if (todo.length) console.log(`\n  done in ${((Date.now() - t0) / 1000).toFixed(0)}s${failed.length ? `, ${failed.length} failed: ${failed.join(', ')}` : ''}`);
  return fixtures
    .filter((f) => existsSync(`${DIR}/matches/${f.matchId}.json`))
    .map((f) => JSON.parse(readFileSync(`${DIR}/matches/${f.matchId}.json`, 'utf8')));
}

async function main() {
  const matches = await scrape();

  const fixtures = await fetchAll<any>((f, t) => supabase.from('pl_fixtures')
    .select('fpl_fixture_id, gameweek, home_club, away_club').eq('season', season).order('fpl_fixture_id').range(f, t));
  const fixtureByClubs = new Map(fixtures.map((f) => [`${f.home_club}|${f.away_club}`, f]));

  const rows = await fetchAll<any>((f, t) => supabase.from('player_stats')
    .select('id, player_id, match_id, gameweek, stats, players!inner(web_name, fpl_id)')
    .eq('season', season).order('id').range(f, t));
  const apps = rows.filter((r) => (r.stats?.minutes_played ?? 0) > 0);
  const clubRows = await fetchAll<any>((f, t) => supabase.from('player_season_clubs')
    .select('player_id, club_slug').eq('season', season).order('player_id').range(f, t));
  const clubOf = new Map<string, string>(clubRows.map((r) => [r.player_id, r.club_slug]));
  const ids = await resolveSeasonPlayers(season, apps.map((r) => ({
    player_id: r.player_id, web_name: r.players.web_name, fpl_id: r.players.fpl_id, club_slug: clubOf.get(r.player_id),
  })), '.fotmob-cache');
  if (ids.unresolved.length) console.log(`No FPL code for: ${ids.unresolved.join(', ')}`);

  // Our appearances per FPL fixture, keyed by the player's FPL code.
  const appsByFixture = new Map<number, Map<number, any>>();
  for (const r of apps) {
    const code = ids.byPlayer.get(r.player_id)?.code;
    if (code == null) continue;
    const m = appsByFixture.get(r.match_id) ?? new Map();
    m.set(code, r);
    appsByFixture.set(r.match_id, m);
  }

  const matched: any[] = [];
  const unmappedMatches: string[] = [];
  const fotmobOnly: string[] = [];
  const minuteGaps: string[] = [];
  const usedApps = new Set<string>();
  for (const match of matches) {
    const home = resolveClub(match.home.name)?.slug, away = resolveClub(match.away.name)?.slug;
    const fx = fixtureByClubs.get(`${home}|${away}`);
    if (!fx) { unmappedMatches.push(`${match.matchId} ${match.home.name} v ${match.away.name}`); continue; }
    const ours = appsByFixture.get(fx.fpl_fixture_id) ?? new Map();
    for (const p of match.players) {
      const mins = p.stats['Minutes played']?.value ?? 0;
      if (mins <= 0) continue;
      const app = p.optaId != null ? ours.get(p.optaId) : undefined;
      if (!app) { fotmobOnly.push(`GW${fx.gameweek} ${p.name}`); continue; }
      usedApps.add(app.id);
      if (Math.abs(app.stats.minutes_played - mins) > 5) minuteGaps.push(`${p.name} GW${fx.gameweek}: FPL ${app.stats.minutes_played}, FotMob ${mins}`);
      matched.push({
        player_id: app.player_id, match_id: fx.fpl_fixture_id, gameweek: fx.gameweek,
        fotmob_match_id: match.matchId, fotmob_player_id: p.fotmobId, opta_id: p.optaId,
        minutes_fpl: app.stats.minutes_played, minutes_fotmob: mins, stats: p.stats,
      });
    }
  }
  const oursOnly = apps.filter((r) => !usedApps.has(r.id));

  writeFileSync(`${DIR}/matched.json`, JSON.stringify({ season, generated: new Date().toISOString(), rows: matched }));
  console.log(`\nJoin: ${matched.length} of ${apps.length} Gaffa appearances matched (${(100 * matched.length / apps.length).toFixed(1)}%)`);
  console.log(`  FotMob matches with no FPL fixture: ${unmappedMatches.length}${unmappedMatches.length ? ` (${unmappedMatches.slice(0, 5).join('; ')})` : ''}`);
  console.log(`  Gaffa appearances with no FotMob row: ${oursOnly.length}`);
  for (const r of oursOnly.slice(0, 12)) console.log(`    GW${r.gameweek} ${r.players.web_name} (${r.stats.minutes_played} min)`);
  console.log(`  FotMob appearances with no Gaffa row: ${fotmobOnly.length}${fotmobOnly.length ? ` (${fotmobOnly.slice(0, 8).join('; ')})` : ''}`);
  console.log(`  Minutes differing by more than 5: ${minuteGaps.length}${minuteGaps.length ? ` (${minuteGaps.slice(0, 5).join('; ')})` : ''}`);
  console.log(`Wrote ${DIR}/matched.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
