/**
 * Read-only growth funnel: signup, join, full league, finished draft, still
 * visiting. Computed from rows the app already writes, so it needs no tracking
 * code and costs no Vercel invocations. See docs/GROWTH_PLAN.md.
 *
 * What it can't see: anything before an account exists (landing-page visits,
 * invite-link clicks, where a signup came from). Those need a tracking change.
 *
 * Usage (--no-warnings hides Node's note that the TypeScript import has no "type" field):
 *   node --no-warnings scripts/funnel.mjs                    # accounts and leagues created since 2026-07-01
 *   node --no-warnings scripts/funnel.mjs --since 2026-09-01
 *   node --no-warnings scripts/funnel.mjs --json
 *
 * Prints counts only. Never prints emails, user ids or league names.
 * (Stage definitions live in src/lib/growth/funnel.ts, with tests.)
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { computeFunnel, emailLooksLikeTest } from '../src/lib/growth/funnel.ts';

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

const args = { since: '2026-07-01', json: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--since') args.since = argv[++i];
  else if (argv[i] === '--json') args.json = true;
  else {
    console.error(`Unknown argument: ${argv[i]}`);
    process.exit(1);
  }
}
const since = new Date(args.since);
if (Number.isNaN(since.getTime())) {
  console.error('--since needs a date like 2026-09-01');
  process.exit(1);
}

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

const [users, leagues, members, picks] = await Promise.all([
  fetchAll(() => admin.from('users').select('id, email, created_at'), 'id'),
  fetchAll(() => admin.from('leagues').select('id, name, max_teams, status, created_at'), 'id'),
  fetchAll(() => admin.from('league_members').select('league_id, user_id, joined_at, last_active_at'), 'joined_at'),
  fetchAll(() => admin.from('draft_picks').select('id, league_id, picked_at'), 'id'),
]);

const result = computeFunnel(
  {
    users: users.map((u) => ({ id: u.id, createdAt: u.created_at, looksLikeTest: emailLooksLikeTest(u.email) })),
    leagues: leagues.map((l) => ({
      id: l.id,
      name: l.name,
      maxTeams: l.max_teams,
      status: l.status,
      createdAt: l.created_at,
    })),
    members: members.map((m) => ({
      leagueId: m.league_id,
      userId: m.user_id,
      joinedAt: m.joined_at,
      lastActiveAt: m.last_active_at,
    })),
    picks: picks.map((p) => ({ leagueId: p.league_id, pickedAt: p.picked_at })),
  },
  { now: new Date(), since },
);

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const pct = (n) => `${Math.round(n * 100)}%`;
const print = (title, stages) => {
  console.log(`\n${title}`);
  for (const s of stages) {
    console.log(`  ${s.label.padEnd(38)}${String(s.count).padStart(4)}   ${pct(s.ofStart).padStart(4)} of start   ${pct(s.ofPrevious).padStart(4)} of previous`);
  }
};
const days = (d) => (d == null ? 'n/a' : `${d.toFixed(1)} days`);

console.log(`\nGrowth funnel, since ${result.window.since} (as of ${result.window.now})`);
console.log(`Left out as test data: ${result.excluded.testLeagues} leagues, ${result.excluded.testUsers} accounts`);
print('Accounts', result.accounts);
console.log(`  Signed up and never joined or created a league: ${result.neverJoined}`);
console.log('\n  Signups by week (never joined a league / signed up)');
for (const w of result.weekly) {
  console.log(`    week of ${w.week}   ${String(w.neverJoined).padStart(2)} / ${w.signups}`);
}
print('Leagues', result.leagues);
console.log(`\nTiming (${result.timing.leaguesTimed} full leagues)`);
console.log(`  Created to full, median:         ${days(result.timing.daysToFullMedian)}`);
console.log(`  Full to last draft pick, median: ${days(result.timing.daysFullToDraftMedian)}`);
console.log(
  '\nNot measured here: landing-page visits, invite-link clicks, and where a signup came from. Those need tracking added.\n',
);
