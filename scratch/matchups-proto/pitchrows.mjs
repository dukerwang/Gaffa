// The half-pitch as rows that cannot collide: each line of the formation is
// one row, each player owns a column of a five-column grid, and the chip and
// its name are sized to fit that column. Height comes from the rows, never from
// a fixed box, so a six-line formation grows the pitch instead of squeezing it.
import { zoneOf, LIVE_NOW, finishedAt, fmt, sideAt } from './model.mjs';
import { crest, tname, glyph, chip, portrait, ptsBadge, ukTime } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const ROWS = ['ATT', 'AMZ', 'CMZ', 'DMZ', 'WBZ', 'DEF', 'GK'];
const WIDE = new Set(['LB', 'RB', 'LWB', 'RWB', 'LW', 'RW']);
const LAT = { LB: 0, LWB: 0, LW: 0, RB: 2, RWB: 2, RW: 2 };

// Columns of a five-wide grid for a row of n players.
function columns(slots) {
  const n = slots.length, wide = slots.some((s) => WIDE.has(s));
  if (n === 1) return [3];
  if (n === 2) return wide ? [1, 5] : [2, 4];
  if (n === 3) return wide ? [1, 3, 5] : [2, 3, 4];
  if (n === 4) return null; // four equal columns
  return [1, 2, 3, 4, 5];
}

export function status(p, state) {
  if (state === 'upcoming') return 'pend';
  const own = p.subIn ? p.replaced : p;
  if (state === 'live' && own.fixture && !finishedAt(own.fixture, LIVE_NOW)) return 'pend';
  return p.mins > 0 || p.subIn ? 'played' : 'dnp';
}

// A name keeps one line at the base size if it fits. Otherwise it shrinks
// (no smaller than 9.5px) on one line; failing that it takes two lines, but
// only where it already breaks, at a space or after a hyphen. Widths are
// measured in the real serif (name-widths.json), never estimated.
const NW = JSON.parse(fs.readFileSync(path.join(HERE, 'name-widths.json'), 'utf8'));
const widthOf = (t) => NW[t] ?? t.length * 0.55;
function nameHtml(name, chipW, base, pad = 13) {
  const avail = chipW - pad;
  const full = widthOf(name);
  const segs = name.replace(/-/g, '-\u0001').split(/[\s\u0001]+/);
  let size, two = false;
  let hy = null;
  if (full * base <= avail) size = base;
  else if (full * 8 <= avail) size = avail / full;
  else if (segs.length > 1) { two = true; size = Math.min(base, avail / Math.max(...segs.map(widthOf))); }
  else {
    // one long word in a tight row: break it once, at a syllable near its middle
    hy = syllableBreak(name);
    const share = Math.max(hy, name.length - hy) / name.length;
    two = true; size = Math.min(base, avail / (full * share * 1.06 + 0.4));
  }
  const text = hy ? `${name.slice(0, hy)}&shy;${name.slice(hy)}` : two ? name.replace(/-/g, '-<wbr>') : name;
  const lineW = (two ? (hy ? full * Math.max(hy, name.length - hy) / name.length * 1.06 : Math.max(...segs.map(widthOf))) : full) * size;
  return { html: `<span class="pnN${two ? ' pnN2' : ''}" style="font-size: ${size.toFixed(2)}px;">${text}</span>`, two, lineW };
}
const V = /[aeiouyáéíóúàèëïöüćčšžğı]/i;
function syllableBreak(s) {
  let best = Math.ceil(s.length / 2), bestD = 99;
  for (let i = 2; i < s.length - 2; i++) {
    if (V.test(s[i - 1]) && !V.test(s[i]) && V.test(s[i + 1])) { const d = Math.abs(i - s.length / 2); if (d < bestD) { bestD = d; best = i; } }
  }
  return best;
}

// The detail line fits the card: the fixture with its day before kickoff,
// otherwise goals and assists first, then the position's own stats, dropping
// from the end whatever will not fit. Rating lives in Team Sheets.
function detailLine(p, st, cardW, compact) {
  const fx = p.fixture;
  if (st === 'pend' && fx) return `<span class="rcFx"><b>${fx.opponentShort}</b> ${ukTime(fx.kickoffTime)}</span>`;
  if (st === 'dnp') return compact ? 'Did not play' : 'Did not play';
  const toks = (p.stats || '').split(' · ').filter((t) => t && !/x[GA]|rating/.test(t));
  const ordered = [...toks.filter((t) => /^\d+[GA]$/.test(t)), ...toks.filter((t) => !/^\d+[GA]$/.test(t))];
  const maxChars = Math.floor((cardW - 10) / (compact ? 4.8 : 5.4));
  while (ordered.length && ordered.join(' · ').length > maxChars) ordered.pop();
  return ordered.length ? ordered.map((t) => (/^\d+[GA]$/.test(t) ? `<b>${t}</b>` : t)).join(' · ') : '&nbsp;';
}
function rowChip(p, state, opt, w) {
  const st = status(p, state);
  const badge = st === 'pend' ? '<span class="pts pts-pend">–</span>' : st === 'dnp' ? '<span class="pts pts-dnp">DNP</span>' : ptsBadge(p.pts);
  const nm = nameHtml(p.name, w, opt.nameBase, opt.compact ? 9 : 13);
  const line = detailLine(p, st, w, opt.compact);
  return { two: nm.two, html: `<button class="rcC${st === 'pend' ? ' chPend' : st === 'dnp' ? ' chDnp' : ''}" style="width: ${w}px;" aria-label="${p.name}, ${p.slot}">
    <span class="rcP">${p.subIn ? `<span class="rcSub" title="Auto-subbed in">${glyph('up', 11)}</span>` : ''}${portrait(p, opt.por)}${badge}</span>
    <span class="rcBox">${chip(p.slot)}${nm.html}<span class="rcS">${line}</span></span></button>` };
}

// side: { starters }, opt: { fieldW, compact, minRows }
export function rowPitch(side, state, { fieldW, compact = false, minRows = 0, look = 'box' }) {
  const byRow = {};
  for (const p of side.starters) (byRow[zoneOf(p.slot)] ??= []).push(p);
  for (const k in byRow) byRow[k].sort((a, b) => (LAT[a.slot] ?? 1) - (LAT[b.slot] ?? 1));
  const rows = ROWS.filter((z) => byRow[z]);
  const inner = fieldW - (compact ? 28 : 28);
  // Every row places chips on a five-wide grid (or four equal columns), so a
  // chip sized to one fifth can never meet its neighbour in any formation.
  const colW = inner / 5;
  const opt = {
    compact,
    maxW: compact ? 80 : 112,
    por: compact ? 'xs' : 'cmp',
    nameBase: compact ? 10.5 : 12.5,
    look,
  };
  // A row is as tall as its tallest card: photo, then the card's own lines.
  const porH = compact ? 46 : 60, badgeH = compact ? 14 : 15, nameH = compact ? 12 : 15, statH = compact ? 11 : 12;
  const unit = inner / 5;
  const cardW = Math.floor(Math.min(opt.maxW, unit - (compact ? 3 : 8)));
  const rowHtml = rows.map((z) => {
    const ps = byRow[z];
    const cols = columns(ps.map((p) => p.slot));
    const xs = cols ? cols.map((c) => (cols.length === 3 && !ps.some((p) => WIDE.has(p.slot)) ? [1.5, 3, 4.5][cols.indexOf(c)] : c) - 0.5) : ps.map((_, i) => (i + 0.5) * 5 / 4);
    // One card size for the whole pitch: the width a back five leaves each player.
    const chips = ps.map((p, i) => ({ cx: xs[i] * unit, ...rowChip(p, state, opt, cardW) }));
    const h = 10 + porH + 4 + 8 + badgeH + nameH * (chips.some((c) => c.two) ? 2 : 1) + statH + 6;
    return { h, html: `<div class="rpRow rp${z}" style="height: ${h}px;">${chips.map((c) => `<span class="rpCell" style="left: ${(c.cx / inner) * 100}%;">${c.html}</span>`).join('')}</div>` };
  });
  const html = rowHtml.map((r) => r.html).join('');
  const rowH = Math.max(...rowHtml.map((r) => r.h));
  const minH = rowHtml.reduce((s, r) => s + r.h, 0) + Math.max(0, minRows - rows.length) * rowH;
  return `<div class="rp${compact ? ' rpM' : ''}"><div class="rpField"><span class="phTop"></span><span class="phCircle"></span><span class="phBox"></span><span class="phGoal"></span><div class="rpRows" style="min-height: ${minH}px;">${html}</div></div></div>`;
}
export const rowCount = (side) => new Set(side.starters.map((p) => zoneOf(p.slot))).size;
