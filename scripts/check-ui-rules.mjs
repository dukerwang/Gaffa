#!/usr/bin/env node
/**
 * Gaffa UI tripwires — the mechanical half of docs/UI_RULES.md.
 *
 * Run standalone (`node scripts/check-ui-rules.mjs [files...]`, no args = whole
 * repo) or via the PostToolUse hook in .claude/settings.json, which pipes it
 * one edited file at a time.
 *
 * WHY THIS EXISTS. Three UI rules were broken in one session despite all three
 * being written down somewhere: headings went sentence case (CLAUDE.md said to,
 * contradicting the code), white panels went back on the cream ground (the rule
 * lived only inside one CSS file), and headings were written as captions (no
 * rule existed). Prose in a doc an agent reads once at session start does not
 * hold. This runs at the moment of the write.
 *
 * Only rules a machine can judge live here. Rule 2 (name things, don't narrate
 * them) is a warning with a deliberately tiny pattern set, because the general
 * case needs judgement. The rest of docs/UI_RULES.md is not checkable and is
 * not attempted.
 *
 * ERRORS exit 2 (the hook feeds them back). WARNINGS exit 0.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/**
 * --added <file>: only report findings whose matched text appears in <file>.
 * The hook writes the edit's new_string (or a Write's whole content) there, so
 * an edit to a legacy file is judged on what it ADDS, not on debt it inherited.
 * Without the flag every finding is reported — that is the audit mode.
 */
const addedIdx = process.argv.indexOf('--added');
let ADDED_TEXT = addedIdx > -1 && process.argv[addedIdx + 1]
  ? (fs.existsSync(process.argv[addedIdx + 1]) ? fs.readFileSync(process.argv[addedIdx + 1], 'utf8') : '')
  : null;
const isNew = (snippet) => ADDED_TEXT === null || ADDED_TEXT.includes(snippet);
const errors = [];
const warnings = [];

const rel = (f) => path.relative(ROOT, f) || f;
const err = (f, line, rule, msg, snip) => { if (isNew(snip ?? '')) errors.push({ f: rel(f), line, rule, msg }); };
const warn = (f, line, rule, msg, snip) => { if (isNew(snip ?? '')) warnings.push({ f: rel(f), line, rule, msg }); };

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** Words that stay lowercase inside a title. */
const MINOR = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor',
  'of', 'on', 'onto', 'or', 'over', 'per', 'so', 'the', 'to', 'up', 'v', 'via',
  'vs', 'with', 'yet',
]);

/** Rule 2's tiny denylist: headings that narrate rather than name. */
const COY = [/^How\b/, /\bThat\b/, /\bIt\b/];

// ── 1. Docs must not contradict the decisions log ──────────────────────────
// This is the exact failure that produced eleven months of lowercase headings:
// CLAUDE.md instructed sentence case long after f2552ff2 changed the code.
//
// The first version of this check watched CLAUDE.md only, and the drift simply
// moved into the files it was not watching: AGENTS.md, .cursorrules and the
// Cursor rule all still said "sentence case" months after CLAUDE.md was fixed,
// so Codex, Antigravity and Cursor kept writing the headings Duke had already
// rejected. Every file an agent auto-loads is watched now. Add new ones here.
const AGENT_DOCS = [
  'CLAUDE.md',
  '.claude/skills/gaffa-ui-copy/SKILL.md',
  'docs/UI_COMPONENTS.md',
  'AGENTS.md',
  'CODEX.md',
  'DESIGN.md',
  '.cursorrules',
  '.cursor/rules/project-context.mdc',
  'docs/UI_RULES.md',
];

/**
 * Two shapes of the same mistake. The first is the explicit instruction; the
 * second is "sentence case" listed as a bare style bullet, which is how it hid
 * in .cursorrules. A line is exempt if it scopes itself to buttons, prose,
 * empty states or tooltips, which genuinely are sentence case.
 */
const SENTENCE_CASE_RULES = [
  /sentence case for (?:headings|section titles|titles)/i,
  /\bsentence case\b/i,
];
// "button" used to be on this list, which let "Buttons are sentence case" through
// in four agent-loaded files for two weeks after Duke reversed it (DECISIONS
// 2026-09-09). A line that mentions buttons and sentence case is now flagged
// unless it also says title case.
const SENTENCE_CASE_OK = /title case|prose|tooltip|empty[- ]state|placeholder|aria|description|stays? sentence|reversed/i;

function checkDocs() {
  for (const f of AGENT_DOCS) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (SENTENCE_CASE_OK.test(line)) return;
      const hit = SENTENCE_CASE_RULES.find((re) => re.test(line));
      if (!hit) return;
      err(p, i + 1, 'doc-contradiction',
        `"${line.trim().slice(0, 90)}" contradicts docs/UI_RULES.md rule 1 (headings, buttons and labels are title case).`);
    });
  }
}

// ── 1b. Nothing inanimate acts (UI_RULES 4a, DECISIONS 2026-09-08) ─────────
// The complaint Duke repeats most. It lived only in prose, so agents read past
// it; it is checked at the moment of the write now, in app code and in the
// prototype HTML that design canvases are built from. Only strings a reader
// sees are checked: comments, CSS and script bodies are stripped first.
const AGENCY = [
  [/\b(?:lets|allows|enables) you\b/i, '"lets you" / "allows you to" is banned. State the action: "View your squad".'],
  [/\ballows? (?:users?|managers?|clubs?) to\b/i, '"allows ... to" is banned. State the action directly.'],
  [/\b(?:this|the|that|each|every|your)\s+(?:button|tab|card|page|dialog|modal|panel|board|section|toggle|link|chip|pill|menu|screen|view|rule|clause|filter|list|badge|icon|banner|sheet|drawer|form|field|key|shortcut)s?\s+(?:opens|closes|shows|displays|lets|allows|takes|brings|sends|saves|submits|reveals|hides|invites|ends|fills|tells|gives|keeps|puts|triggers|starts|launches|returns|lists|moves|removes|adds)\b/i,
    'a UI object is the subject of a verb. Make a person the subject, or use an imperative.'],
  [/\b(?:Enter|Esc|Escape|Return|Space|Ctrl\+\w+|Cmd\+\w+)\s+(?:opens|closes|returns|quits|submits|saves|selects|toggles|cancels|confirms|dismisses|goes)\b/,
    'a key is the subject of a verb. Write "Enter to open", not "Enter opens".'],
  [/\bif it holds\b/i, '"if it holds" is a pseudo-passive tag. Write "projected €34m".'],
];

/** The text a reader sees: string literals and JSX text in TSX, text nodes in HTML. */
function readerText(f, src) {
  if (/\.html?$/.test(f)) {
    return src
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, '\n');
  }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const out = [];
  for (const m of code.matchAll(/'([^'\n]{6,})'|"([^"\n]{6,})"|`([^`]{6,})`|>([^<>{}]{6,})</g)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return out.join('\n');
}

function checkAgency(f, src) {
  const text = readerText(f, src);
  for (const [re, msg] of AGENCY) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      const at = src.indexOf(m[0]);
      err(f, at > -1 ? lineOf(src, at) : 1, 'inanimate-agency', `"${m[0]}": ${msg}`, m[0]);
    }
  }
}

// ── 2. Heading case + coy headings, in TSX ─────────────────────────────────
function checkTsx(f, src) {
  const re = /<h([1-3])(\s[^>]*)?>([^<>{}]+)<\/h\1>/g;
  let m;
  while ((m = re.exec(src))) {
    const text = m[3].trim();
    if (!text || text.length < 3) continue;
    if (/[{}]/.test(text)) continue;                  // interpolated
    if (/[.!?]$/.test(text)) continue;                // a sentence, not a title
    if (/^\d/.test(text)) continue;                   // numbered legal/doc heading
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2) continue;

    const bad = words.slice(1).filter((w, i) => {
      if (/^&[a-z]+;/i.test(w)) return false;         // HTML entity
      const bare = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      if (!bare || bare.length < 2) return false;
      if (MINOR.has(bare.toLowerCase())) return false;
      if (words[i] && /[:—–-]$/.test(words[i])) return false;  // after a dash, new clause
      return /^\p{Ll}/u.test(bare);
    });
    if (bad.length) {
      err(f, lineOf(src, m.index), 'heading-case',
        `"${text}" — headings are title case. Lowercase: ${bad.join(', ')}`, text);
    }
    if (COY.some((p) => p.test(text))) {
      warn(f, lineOf(src, m.index), 'heading-narrates',
        `"${text}" reads as a caption. Name the thing instead (UI_RULES rule 2).`, text);
    }
  }
}

// ── 3. Elevation is border XOR shadow ──────────────────────────────────────
function checkCss(f, src) {
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(src))) {
    const [, selector, body] = m;
    if (selector.trim().startsWith('@')) continue;
    const hasBorder = /(^|\s|;)border\s*:\s*(?!\s*(?:none|0)\b)/.test(body);
    const hasShadow = /(^|\s|;)box-shadow\s*:\s*(?!\s*none\b)/.test(body);
    if (hasBorder && hasShadow) {
      err(f, lineOf(src, m.index), 'ghost-card',
        `${selector.trim().split('\n').pop().trim()} declares both border and box-shadow. Elevation is border XOR shadow (UI_RULES rule 7).`, body.trim());
    }
    if (/border-(left|top)\s*:\s*\d+px solid var\(--color-(accent|pos|gold|danger|warning)/.test(body)) {
      err(f, lineOf(src, m.index), 'accent-edge',
        `${selector.trim().split('\n').pop().trim()} puts a coloured bar on a container edge (UI_RULES rule 8).`, body.trim());
    }
  }
}

// ── Drive ──────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * --hook: read Claude Code's PostToolUse payload on stdin and derive both the
 * file and the added text from it. Keeps the hook a single command with no jq
 * dependency (jq is not installed on this machine).
 */
async function hookPayload() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

let args = process.argv.slice(2).filter((a) => a !== '--hook');
let files;

if (process.argv.includes('--hook')) {
  const j = await hookPayload();
  const ti = j.tool_input ?? {};
  const f = ti.file_path ?? j.tool_response?.filePath;
  if (!f || !/\.(tsx|css|html?)$/.test(f)) process.exit(0);
  const added = [ti.new_string, ti.content, ...(ti.edits ?? []).map((e) => e.new_string)]
    .filter(Boolean).join('\n');
  ADDED_TEXT = added;
  files = [f];
} else {
  files = args.filter((a) => !a.startsWith('--') && a !== (process.argv[addedIdx + 1] ?? ''));
  if (!files.length) files = walk(path.join(ROOT, 'src'));
}

checkDocs();
for (const f of files) {
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue;
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (f.endsWith('.tsx') || /\.html?$/.test(f)) { checkTsx(f, src); checkAgency(f, src); }
  if (f.endsWith('.css')) checkCss(f, src);
}

const fmt = (x) => `  ${x.f}:${x.line}  [${x.rule}] ${x.msg}`;
if (warnings.length) {
  console.error(`UI rules — ${warnings.length} warning(s):`);
  warnings.forEach((w) => console.error(fmt(w)));
}
if (errors.length) {
  console.error(`UI rules — ${errors.length} error(s). See docs/UI_RULES.md.`);
  errors.forEach((e) => console.error(fmt(e)));
  // Audit mode reports the standing debt without failing; only the hook (which
  // scopes findings to what an edit ADDS) and --strict are gates.
  if (ADDED_TEXT !== null || process.argv.includes("--strict")) process.exit(2);
}
if (!warnings.length && !errors.length && args.length === 0 && !process.argv.includes('--hook')) console.log('UI rules: clean.');
