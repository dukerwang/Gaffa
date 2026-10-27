#!/usr/bin/env node
/**
 * Gaffa data tripwires: the mechanical half of REVIEW.md.
 *
 * Run standalone (`node scripts/check-data-rules.mjs [files...]`, no args = all
 * of src/) for an audit of the standing debt, or with `--diff <base>` to judge
 * only the lines a branch adds, which is how the PR check runs it.
 *
 * WHY THIS EXISTS. Each rule below is a bug that shipped at least once and was
 * written into CLAUDE.md afterwards. Writing it down did not stop the second
 * one: the `finished_provisional` event check went in twice. A pattern a
 * reviewer keeps flagging belongs in a check that runs on every PR, not in a
 * paragraph an agent reads once at session start.
 *
 * Only patterns a regex can judge without much doubt live here. The rest of
 * REVIEW.md needs a reviewer.
 *
 * To accept a finding on purpose, put `data-rules-ok: <reason>` in a comment on
 * the flagged line or the line above it.
 *
 * Findings exit 2 in --diff and --strict modes. Audit mode only reports.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const errors = [];

const rel = (f) => path.relative(ROOT, f) || f;
const lineOf = (src, index) => src.slice(0, index).split('\n').length;
const inComment = (lines, line) => /^\s*(\/\/|\*|\/\*)/.test(lines[line - 1] ?? '');

/** --diff <base>: line numbers each changed file adds relative to <base>. */
const diffIdx = process.argv.indexOf('--diff');
const DIFF_BASE = diffIdx > -1 ? process.argv[diffIdx + 1] : null;
let addedLines = null;

function readAddedLines(base) {
  const out = execFileSync('git', ['diff', '--unified=0', '--no-color', `${base}...HEAD`, '--', 'src', 'scripts'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const map = new Map();
  let file = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.startsWith('+++ b/') ? path.join(ROOT, line.slice(6)) : null;
      if (file && !map.has(file)) map.set(file, new Set());
    } else if (file && line.startsWith('@@')) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      for (let i = 0; i < count; i++) map.get(file).add(start + i);
      // A pure deletion (`+N,0`) adds nothing, but deleting a `.range()` still
      // changes the chain around it. Mark the lines either side of the cut.
      if (count === 0) map.get(file).add(start).add(start + 1);
    }
  }
  return map;
}

function suppressed(lines, line) {
  return /data-rules-ok/.test(lines[line - 1] ?? '') || /data-rules-ok/.test(lines[line - 2] ?? '');
}

/** A finding counts in diff mode only if any line it spans is new. */
function report(list, f, lines, line, endLine, rule, msg) {
  if (suppressed(lines, line) || inComment(lines, line)) return;
  if (addedLines) {
    const added = addedLines.get(f);
    if (!added) return;
    let touched = false;
    for (let l = line; l <= endLine; l++) if (added.has(l)) { touched = true; break; }
    if (!touched) return;
  }
  list.push({ f: rel(f), line, rule, msg });
}

/**
 * The Supabase call chain that starts at `index`: everything up to the end of
 * the statement, so a `.range()` four lines down still counts.
 */
function chainFrom(src, index) {
  let depth = 0;
  for (let i = index; i < src.length && i < index + 2500; i++) {
    const c = src[i];
    // Punctuation inside a string or a comment is not the end of the statement.
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      i = j;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return src.slice(index, i);
      depth--;
    } else if ((c === ';' || c === ',') && depth === 0) return src.slice(index, i);
  }
  return src.slice(index, index + 2500);
}

// ── 1. Unpaginated reads of tables past 1,000 rows ─────────────────────────
// PostgREST truncates at 1,000 rows and reports success. These tables are past
// that size (CLAUDE.md, "Batching & pagination"), so a read with no bound
// silently returns a prefix. This has bitten sofifa_position_reference and the
// player sync. Narrow filters (one season's gameweek, one player, one row) are
// bounded well under the cap and pass.
const BIG_TABLES = ['player_stats', 'sofifa_position_reference', 'player_season_clubs', 'roster_entries'];
const BOUNDED = [
  /\.range\(/, /\.single\(/, /\.maybeSingle\(/,
  /head:\s*true/,
  /\.(upsert|insert|update|delete)\(/,
  /\.eq\(\s*['"](id|player_id|team_id|league_id|match_id|fpl_fixture_id)['"]/,
  // A limit is a bound only when it is under the cap: PostgREST still stops at
  // 1,000 rows for `.limit(5000)`.
  (chain) => [...chain.matchAll(/\.limit\(\s*(\d+)\s*\)/g)].some((m) => Number(m[1]) <= 1000),
];

/** Filters that bound one table but not the others. */
const BOUNDED_FOR = {
  // One gameweek is ~650 rows per season, so it is a bound only within a season.
  player_stats: [(chain) => /\.eq\(\s*['"]gameweek['"]/.test(chain) && /\.eq\(\s*['"]season['"]/.test(chain)],
  // One league's clubs hold a few hundred entries; only cross-league reads pass 1,000.
  roster_entries: [/\.in\(\s*['"]team_id['"]/],
};

const passes = (b, chain) => (typeof b === 'function' ? b(chain) : b.test(chain));

function checkPagination(f, src, lines) {
  const re = new RegExp(`\\.from\\(\\s*['"](${BIG_TABLES.join('|')})['"]\\s*\\)`, 'g');
  for (const m of src.matchAll(re)) {
    const chain = chainFrom(src, m.index);
    if (!/\.select\(/.test(chain)) continue;
    if ([...BOUNDED, ...(BOUNDED_FOR[m[1]] ?? [])].some((b) => passes(b, chain))) continue;
    // Wrapped in a paginating helper a few lines up.
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    if (/fetchAllPages(OrThrow|In)?\s*(<[^>]*>)?\s*\(/.test(before)) continue;
    const line = lineOf(src, m.index);
    report(errors, f, lines, line, line + chain.split('\n').length - 1, 'unpaginated-read',
      `${m[1]} is past 1,000 rows; read it through fetchAllPages / fetchAllPagesOrThrow / fetchAllPagesIn (src/lib/supabase/pagination.ts) or bound it.`);
  }
}

// ── 2. finished_provisional read off an FPL event ──────────────────────────
// The field exists only on fixtures. `e.finished_provisional === true` is
// always `undefined === true`, and the dead branch has silently disabled the
// gameweek lock fix twice.
function checkFinishedProvisional(f, src, lines) {
  // Receiver names that mean an event in this codebase. Generic ones (`current`,
  // `gw`) also name fixtures, so they stay out.
  const EV = '(?:e|ev|evt|event|events\\[[^\\]]*\\]|currentEvent|nextEvent|lastEvent)';
  const read = new RegExp(`\\b${EV}\\??\\.finished_provisional\\b`, 'g');
  const destructured = new RegExp(`\\{[^{}\\n]*\\bfinished_provisional\\b[^{}\\n]*\\}\\s*=\\s*${EV}\\b`, 'g');
  for (const m of [...src.matchAll(read), ...src.matchAll(destructured)]) {
    const line = lineOf(src, m.index);
    report(errors, f, lines, line, line, 'finished-provisional-on-event',
      '`finished_provisional` exists only on FPL fixtures, never events. Gate on gameweek_sync_state.final_synced_at instead.');
  }
}

// ── 3. Inner join from a club to its manager ───────────────────────────────
// A Caretaker club has teams.user_id = NULL. An inner join drops it from the
// result, so it vanishes from standings, notifications and whatever else.
function checkUsersInnerJoin(f, src, lines) {
  for (const m of src.matchAll(/users!(?:[a-z_]+!)?inner\b/g)) {
    const line = lineOf(src, m.index);
    report(errors, f, lines, line, line, 'caretaker-inner-join',
      'Inner join to users drops Caretaker clubs (teams.user_id IS NULL). Use a left join and cope with a null manager.');
  }
}

// ── 4. Badges keyed on an FPL team id ──────────────────────────────────────
// FPL team ids are reassigned alphabetically every summer. team-logos/19.png
// went from West Ham to Spurs that way. Badges are keyed on the club slug.
function checkTeamLogos(f, src, lines) {
  const re = /team-logos\/(?:\d+\.png|\$\{(?![^}]*slug)[^}]*\})/g;
  for (const m of src.matchAll(re)) {
    const line = lineOf(src, m.index);
    report(errors, f, lines, line, line, 'badge-not-slug',
      'Badges are /team-logos/{slug}.png. Resolve the club with resolveClub() (src/lib/clubs/registry.ts); FPL team ids change every season.');
  }
}

// ── 5. pl_fixtures written outside upsertFixtures.ts ───────────────────────
// pl_fixtures is keyed (season, fpl_fixture_id) with clubs as slugs. One writer
// keeps that invariant; a second one is how the 2025-26 fixture list was lost.
function checkFixtureWrites(f, src, lines) {
  if (rel(f).endsWith('src/lib/fixtures/upsertFixtures.ts')) return;
  for (const m of src.matchAll(/\.from\(\s*['"]pl_fixtures['"]\s*\)/g)) {
    const chain = chainFrom(src, m.index);
    if (!/\.(upsert|insert|update|delete)\(/.test(chain)) continue;
    const line = lineOf(src, m.index);
    report(errors, f, lines, line, line, 'fixture-writer',
      'Write pl_fixtures only through src/lib/fixtures/upsertFixtures.ts.');
  }
}

// ── 6. Hardcoded season as a fallback ──────────────────────────────────────
// `league.current_season ?? '2025-26'` is right for one summer and silently
// wrong after it. The season comes from src/lib/season/currentSeason.ts.
function checkSeasonFallback(f, src, lines) {
  if (rel(f).endsWith('src/lib/season/currentSeason.ts')) return;
  for (const m of src.matchAll(/(\?\?|\|\|)\s*['"`]20\d\d-\d\d['"`]/g)) {
    const line = lineOf(src, m.index);
    report(errors, f, lines, line, line, 'hardcoded-season',
      'Season strings are never hardcoded. Use getCurrentFplSeason() / getLatestReferenceStatsSeason() (src/lib/season/currentSeason.ts).');
  }
}

// ── Drive ──────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--diff');
let files;
if (DIFF_BASE) {
  addedLines = readAddedLines(DIFF_BASE);
  files = [...addedLines.keys()].filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !/__tests__|\.test\.ts$/.test(f));
} else {
  files = args.length ? args.map((a) => path.resolve(a)) : walk(path.join(ROOT, 'src'));
}

for (const f of files) {
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue;
  if (rel(f) === 'scripts/check-data-rules.mjs') continue;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  checkPagination(f, src, lines);
  checkFinishedProvisional(f, src, lines);
  checkUsersInnerJoin(f, src, lines);
  checkTeamLogos(f, src, lines);
  checkFixtureWrites(f, src, lines);
  checkSeasonFallback(f, src, lines);
}

const fmt = (x) => `  ${x.f}:${x.line}  [${x.rule}] ${x.msg}`;
if (errors.length) {
  console.error(`Data rules: ${errors.length} finding(s). See REVIEW.md.`);
  errors.forEach((e) => console.error(fmt(e)));
  if (DIFF_BASE || process.argv.includes('--strict')) process.exit(2);
} else {
  console.log('Data rules: clean.');
}
