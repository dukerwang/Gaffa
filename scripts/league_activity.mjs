/**
 * Read-only weekly engagement report for live leagues.
 *
 * Why it exists: surveys and interviews get almost no replies from the alpha
 * managers, so engagement is read from what they already do in the app:
 * visits, bids, trade offers and lineup changes. See docs/GROWTH_PLAN.md.
 *
 * Runs locally against the production database with the service role key
 * (no Vercel invocations). Prints team names but never emails or user ids.
 *
 * Usage:
 *   node scripts/league_activity.mjs                 # live leagues, latest season, last 7 days
 *   node scripts/league_activity.mjs --days 14
 *   node scripts/league_activity.mjs --season 2026-27
 *   node scripts/league_activity.mjs --league "Matchday Militia"
 *   node scripts/league_activity.mjs --json          # machine-readable
 *
 * Reading the signals:
 *  - Lineups are carried forward automatically, so "has a lineup" says nothing
 *    about the manager. "Lineup edits" counts how often a team's player set
 *    differs from its previous gameweek's, which includes repairs after an
 *    injury or a departure, so treat it as a rough proxy.
 *  - last_active_at is touched on league and dashboard visits and throttled to
 *    once an hour, so it measures visits, not time spent.
 *  - A person in two leagues is counted once in the "people" table.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

function loadEnv() {
  const candidates = [
    new URL('../.env.local', import.meta.url), // this checkout
    new URL('../../../../.env.local', import.meta.url), // main checkout, from .claude/worktrees/<name>/scripts
  ];
  const file = candidates.find((u) => existsSync(u));
  if (!file) {
    console.error('No .env.local found. Symlink it into this checkout (see CLAUDE.md).');
    process.exit(1);
  }
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

function parseArgs(argv) {
  const out = { days: 7, season: null, league: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--days') out.days = Number(argv[++i]);
    else if (a === '--season') out.season = argv[++i];
    else if (a === '--league') out.league = argv[++i];
    else if (a === '--json') out.json = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(out.days) || out.days <= 0) {
    console.error('--days needs a positive number');
    process.exit(1);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** PostgREST truncates at 1,000 rows and reports success, so page every read. */
async function fetchAll(build, orderCol) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().order(orderCol, { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const since = now - args.days * DAY;
const daysAgo = (iso) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : null);

/** All player ids named anywhere in a saved lineup, whatever its shape. */
function playerIds(node, acc = new Set()) {
  if (Array.isArray(node)) node.forEach((n) => playerIds(n, acc));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'player_id' && typeof v === 'string') acc.add(v);
      else playerIds(v, acc);
    }
  }
  return acc;
}
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// --- Leagues in scope -------------------------------------------------------
const allLeagues = await fetchAll(
  () => admin.from('leagues').select('id, name, status, current_season, is_dynasty'),
  'id',
);
let leagues = allLeagues.filter((l) => l.status === 'active');
const season =
  args.season ?? leagues.map((l) => l.current_season).sort().at(-1) ?? null;
leagues = leagues.filter((l) => l.current_season === season);
if (args.league) leagues = leagues.filter((l) => l.name === args.league);
if (leagues.length === 0) {
  console.error('No matching active leagues.');
  process.exit(1);
}
const leagueIds = leagues.map((l) => l.id);
const leagueById = new Map(leagues.map((l) => [l.id, l]));

// --- Data -------------------------------------------------------------------
const [teams, members, bids, trades, matchups] = await Promise.all([
  fetchAll(() => admin.from('teams').select('id, league_id, user_id, team_name').in('league_id', leagueIds), 'id'),
  fetchAll(
    () => admin.from('league_members').select('league_id, user_id, joined_at, last_active_at').in('league_id', leagueIds),
    'joined_at',
  ),
  fetchAll(
    () => admin.from('auction_bid_events').select('id, league_id, team_id, created_at').in('league_id', leagueIds),
    'id',
  ),
  fetchAll(
    () => admin.from('trade_proposals').select('id, league_id, team_a_id, created_at').in('league_id', leagueIds),
    'id',
  ),
  fetchAll(
    () =>
      admin
        .from('matchups')
        .select('id, league_id, gameweek, team_a_id, team_b_id, status, lineup_a, lineup_b')
        .in('league_id', leagueIds)
        .in('status', ['completed', 'live']),
    'id',
  ),
]);

const memberKey = (m) => `${m.league_id}:${m.user_id}`;
const lastActive = new Map(members.map((m) => [memberKey(m), m.last_active_at]));
const joinedAt = new Map(members.map((m) => [memberKey(m), m.joined_at]));

// Lineup edits per team: gameweek N player set vs gameweek N-1 player set.
const lineupsByTeam = new Map(); // teamId -> Map(gw -> Set)
for (const m of matchups) {
  for (const [teamId, lineup] of [
    [m.team_a_id, m.lineup_a],
    [m.team_b_id, m.lineup_b],
  ]) {
    if (!lineup) continue;
    if (!lineupsByTeam.has(teamId)) lineupsByTeam.set(teamId, new Map());
    lineupsByTeam.get(teamId).set(m.gameweek, playerIds(lineup));
  }
}
function lineupEdits(teamId) {
  const byGw = lineupsByTeam.get(teamId);
  if (!byGw) return { edits: 0, comparable: 0, recentEdits: 0, recentComparable: 0 };
  const gws = [...byGw.keys()].sort((a, b) => a - b);
  const lastGws = new Set(gws.slice(-4));
  let edits = 0;
  let comparable = 0;
  let recentEdits = 0;
  let recentComparable = 0;
  for (let i = 1; i < gws.length; i++) {
    const changed = !sameSet(byGw.get(gws[i]), byGw.get(gws[i - 1]));
    comparable++;
    if (changed) edits++;
    if (lastGws.has(gws[i])) {
      recentComparable++;
      if (changed) recentEdits++;
    }
  }
  return { edits, comparable, recentEdits, recentComparable };
}

// --- Per team ---------------------------------------------------------------
const teamRows = teams.map((t) => {
  const league = leagueById.get(t.league_id);
  const key = `${t.league_id}:${t.user_id}`;
  const teamBids = bids.filter((b) => b.team_id === t.id);
  const teamTrades = trades.filter((x) => x.team_a_id === t.id);
  const inWindow = (r) => new Date(r.created_at).getTime() >= since;
  return {
    league: league.name,
    team: t.team_name,
    userId: t.user_id, // grouped on, never printed
    caretaker: t.user_id == null,
    lastActiveDaysAgo: t.user_id ? daysAgo(lastActive.get(key)) : null,
    joinedDaysAgo: t.user_id ? daysAgo(joinedAt.get(key)) : null,
    bidsWindow: teamBids.filter(inWindow).length,
    bidsTotal: teamBids.length,
    tradesWindow: teamTrades.filter(inWindow).length,
    tradesTotal: teamTrades.length,
    ...lineupEdits(t.id),
  };
});

// --- Per person (a person in two leagues counts once) -----------------------
const people = new Map();
for (const r of teamRows.filter((r) => !r.caretaker)) {
  const p = people.get(r.userId) ?? { teams: [], leagues: new Set() };
  p.teams.push(r);
  p.leagues.add(r.league);
  people.set(r.userId, p);
}
const peopleRows = [...people.values()]
  .map((p) => ({
    leagues: [...p.leagues],
    lastActiveDaysAgo: Math.min(...p.teams.map((t) => t.lastActiveDaysAgo ?? Infinity)),
    bidsWindow: p.teams.reduce((s, t) => s + t.bidsWindow, 0),
    tradesWindow: p.teams.reduce((s, t) => s + t.tradesWindow, 0),
    recentEdits: p.teams.reduce((s, t) => s + t.recentEdits, 0),
    recentComparable: p.teams.reduce((s, t) => s + t.recentComparable, 0),
    bidsTotal: p.teams.reduce((s, t) => s + t.bidsTotal, 0),
    tradesTotal: p.teams.reduce((s, t) => s + t.tradesTotal, 0),
  }))
  .sort((a, b) => a.lastActiveDaysAgo - b.lastActiveDaysAgo);

const isEngaged = (p) => p.bidsWindow + p.tradesWindow > 0 || p.lastActiveDaysAgo <= 2;
const summary = {
  season,
  windowDays: args.days,
  leagues: leagues.length,
  memberships: teamRows.filter((r) => !r.caretaker).length,
  uniquePeople: peopleRows.length,
  caretakerClubs: teamRows.filter((r) => r.caretaker).length,
  peopleVisitedInWindow: peopleRows.filter((p) => p.lastActiveDaysAgo <= args.days).length,
  peopleBidOrTradedInWindow: peopleRows.filter((p) => p.bidsWindow + p.tradesWindow > 0).length,
  peopleQuietOver14Days: peopleRows.filter((p) => p.lastActiveDaysAgo > 14).length,
  peopleEngaged: peopleRows.filter(isEngaged).length,
};

if (args.json) {
  const scrub = ({ userId, ...rest }) => rest;
  console.log(JSON.stringify({ summary, people: peopleRows, teams: teamRows.map(scrub) }, null, 2));
  process.exit(0);
}

// --- Print ------------------------------------------------------------------
const pad = (v, n) => String(v).padEnd(n);
const num = (v) => String(v).padStart(4);
console.log(`\nLeague activity, ${season}, last ${args.days} days (${new Date().toISOString().slice(0, 10)})\n`);
console.log(
  `${summary.uniquePeople} people in ${summary.leagues} leagues (${summary.memberships} memberships, ${summary.caretakerClubs} Caretaker clubs)`,
);
console.log(`  visited in window:           ${summary.peopleVisitedInWindow} of ${summary.uniquePeople}`);
console.log(`  bid or offered a trade:      ${summary.peopleBidOrTradedInWindow} of ${summary.uniquePeople}`);
console.log(`  not seen for more than 14d:  ${summary.peopleQuietOver14Days} of ${summary.uniquePeople}`);

console.log('\nPeople (most recently seen first)');
console.log(`${pad('Leagues', 40)}${pad('Seen', 9)}${'Bids'.padStart(6)}${'Offers'.padStart(8)}${'Edits/4GW'.padStart(11)}   Totals (bids / offers)`);
for (const p of peopleRows) {
  const seen = p.lastActiveDaysAgo === Infinity ? 'never' : p.lastActiveDaysAgo === 0 ? 'today' : `${p.lastActiveDaysAgo}d ago`;
  console.log(
    `${pad(p.leagues.join(' + '), 40)}${pad(seen, 9)}${num(p.bidsWindow).padStart(6)}${num(p.tradesWindow).padStart(8)}${`${p.recentEdits}/${p.recentComparable}`.padStart(11)}   ${p.bidsTotal} / ${p.tradesTotal}`,
  );
}

console.log('\nTeams');
for (const l of leagues) {
  console.log(`\n${l.name} (${l.is_dynasty ? 'dynasty' : 'redraft'})`);
  console.log(`${pad('Team', 28)}${pad('Seen', 9)}${'Bids'.padStart(6)}${'Offers'.padStart(8)}${'Edits'.padStart(8)}`);
  for (const r of teamRows.filter((x) => x.league === l.name)) {
    const seen = r.caretaker ? 'Caretaker' : r.lastActiveDaysAgo === 0 ? 'today' : r.lastActiveDaysAgo == null ? 'never' : `${r.lastActiveDaysAgo}d ago`;
    console.log(
      `${pad(r.team ?? '(unnamed)', 28)}${pad(seen, 9)}${num(r.bidsWindow).padStart(6)}${num(r.tradesWindow).padStart(8)}${`${r.edits}/${r.comparable}`.padStart(8)}`,
    );
  }
}
console.log(
  '\nEdits = gameweeks where the team\'s player set differed from the previous gameweek (rough proxy; includes injury and departure repairs).\n',
);
