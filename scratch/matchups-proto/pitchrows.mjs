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
function nameHtml(name, chipW, base) {
  const avail = chipW - 9;
  const full = widthOf(name);
  const segs = name.replace(/-/g, '-\u0001').split(/[\s\u0001]+/);
  let size, two = false;
  let hy = null;
  if (full * base <= avail) size = base;
  else if (full * 8.5 <= avail) size = avail / full;
  else if (segs.length > 1) { two = true; size = Math.min(base, avail / Math.max(...segs.map(widthOf))); }
  else {
    // one long word in a tight row: break it once, at a syllable near its middle
    hy = syllableBreak(name);
    const share = Math.max(hy, name.length - hy) / name.length;
    two = true; size = Math.min(base, avail / (full * share * 1.06 + 0.4));
  }
  const text = hy ? `${name.slice(0, hy)}&shy;${name.slice(hy)}` : two ? name.replace(/-/g, '-<wbr>') : name;
  return `<span class="rcN${two ? ' rcN2' : ''}" style="font-size: ${size.toFixed(2)}px;">${text}</span>`;
}
const V = /[aeiouyáéíóúàèëïöüćčšžğı]/i;
function syllableBreak(s) {
  let best = Math.ceil(s.length / 2), bestD = 99;
  for (let i = 2; i < s.length - 2; i++) {
    if (V.test(s[i - 1]) && !V.test(s[i]) && V.test(s[i + 1])) { const d = Math.abs(i - s.length / 2); if (d < bestD) { bestD = d; best = i; } }
  }
  return best;
}

function rowChip(p, state, opt, w) {
  const st = status(p, state);
  const badge = st === 'pend' ? '<span class="pts pts-pend">–</span>' : st === 'dnp' ? '<span class="pts pts-dnp">DNP</span>' : ptsBadge(p.pts);
  const fx = p.fixture;
  const ev = (p.stats || '').split(' · ').filter((t) => t && !/x[GA]|rating/.test(t)).join(' · ');
  const line = st === 'pend' && fx ? `<b>${fx.opponentShort}</b> ${ukTime(fx.kickoffTime)}` : st === 'dnp' ? 'Did not play' : ev || '&nbsp;';
  // On a phone the card keeps only goals and assists; the score rides the corner.
  const scoring = ev.split(' · ').filter((t) => /^\d+[GA]$/.test(t)).join(' · ');
  const lineM = st === 'pend' && fx ? `<b>${fx.opponentShort}</b> ${ukTime(fx.kickoffTime).slice(4)}` : st === 'played' && scoring ? `<b>${scoring}</b>` : '&nbsp;';
  return `<button class="rcC${st === 'pend' ? ' chPend' : st === 'dnp' ? ' chDnp' : ''}" style="width: ${w}px;" aria-label="${p.name}, ${p.slot}">
    <span class="rcP">${p.subIn ? `<span class="rcSub" title="Auto-subbed in">${glyph('up', 11)}</span>` : ''}${portrait(p, opt.por)}${badge}</span>
    <span class="rcBox">${chip(p.slot)}${nameHtml(p.name, w, opt.nameBase)}${opt.compact ? `<span class="rcS">${lineM}</span>` : `<span class="rcS">${line}</span>`}</span></button>`;
}

// side: { starters }, opt: { fieldW, compact, minRows }
export function rowPitch(side, state, { fieldW, compact = false, minRows = 0 }) {
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
  };
  const rowH = compact ? 122 : 142;
  const html = rows.map((z) => {
    const ps = byRow[z];
    const cols = columns(ps.map((p) => p.slot));
    // centres in fifths of the field; four-wide rows use quarters
    const xs = cols ? cols.map((c) => (cols.length === 3 && !ps.some((p) => WIDE.has(p.slot)) ? [1.5, 3, 4.5][cols.indexOf(c)] : c) - 0.5) : ps.map((_, i) => (i + 0.5) * 5 / 4);
    const unit = inner / 5;
    return `<div class="rpRow rp${z}" style="min-height: ${rowH}px;">${ps.map((p, i) => {
      const cx = xs[i] * unit;
      const near = Math.min(...xs.filter((_, j) => j !== i).map((x) => Math.abs(x - xs[i]) * unit), Infinity);
      const w = Math.floor(Math.min(opt.maxW, 2 * Math.min(cx, inner - cx) - 2, near - (compact ? 3 : 8)));
      return `<span class="rpCell" style="left: ${(cx / inner) * 100}%;">${rowChip(p, state, opt, w)}</span>`;
    }).join('')}</div>`;
  }).join('');
  const minH = Math.max(rows.length, minRows) * rowH;
  return `<div class="rp${compact ? ' rpM' : ''}"><div class="rpField"><span class="phTop"></span><span class="phCircle"></span><span class="phBox"></span><span class="phGoal"></span><div class="rpRows" style="min-height: ${minH}px;">${html}</div></div></div>`;
}
export const rowCount = (side) => new Set(side.starters.map((p) => zoneOf(p.slot))).size;
