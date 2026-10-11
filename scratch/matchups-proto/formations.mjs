// Every formation Gaffa allows, filled with the league's longest real names,
// with a DNP, an auto-sub and a player still to play in each: the worst case.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clubOf } from './model.mjs';
import { rowPitch, rowCount } from './pitchrows.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LONG = JSON.parse(fs.readFileSync(path.join(HERE, 'long.json'), 'utf8'));
const PHOTOS = JSON.parse(fs.readFileSync(path.join(HERE, 'photos.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(HERE, '../../src/types/index.ts'), 'utf8');
export const FORMATIONS = Object.fromEntries([...SRC.matchAll(/'(\d-[\d-]+)': \[([^\]]+)\]/g)].map(([, f, s]) => [f, s.match(/'(\w+)'/g).map((x) => x.slice(1, -1))]));

const PTS = [43.72, 0, 29.41, 5.11, 15.8, 1.27, 24.25, 0.08, 9.69, 36.69, 12.98];
const DONE = { opponent: 'ARS (H)', opponentShort: 'ARS', kickoffTime: '2026-09-19T14:00:00+00:00' };
const LATER = { opponent: 'MCI (A)', opponentShort: 'MCI', kickoffTime: '2026-09-20T15:30:00+00:00' };

function player(i, slot, used) {
  // longest names first, preferring one listed at this position
  let pick = LONG.find((p, j) => !used.has(j) && p[1] === slot) ?? LONG.find((p, j) => !used.has(j));
  used.add(LONG.indexOf(pick));
  const [name, pos, club, code, headTop, headW] = pick;
  const kind = PHOTOS[code]?.kind ?? 'none';
  return { id: code, name, pos, slot, club: clubOf(club), code, photo: kind === 'none' ? null : kind, headTop, headW, pts: PTS[i % PTS.length], mins: 90, stats: i % 3 === 0 ? 'CS · 3 Tk' : i % 3 === 1 ? '1G' : '', fixture: DONE };
}

export function sideFor(formation) {
  const used = new Set();
  const starters = FORMATIONS[formation].map((slot, i) => player(i, slot, used));
  starters[3] = { ...starters[3], mins: 0, pts: 0 };                       // did not play
  const sub = { ...starters[6], name: 'Fernandez-Pardo', code: '613221', photo: null, subIn: true };
  starters[6] = { ...sub, replaced: { ...starters[6], fixture: DONE } };     // auto-sub on
  starters[9] = { ...starters[9], fixture: LATER };                          // still to play
  return { starters, formation };
}

export function formationsBoard({ compact, dark, w }) {
  const fieldW = compact ? 358 : 596;
  const cards = Object.keys(FORMATIONS).map((f) => {
    const side = sideFor(f);
    return `<div class="fmCard" style="width: ${fieldW}px;"><div class="lsHead"><b>${f}</b><span class="lbl">${rowCount(side)} lines</span></div>${rowPitch(side, 'live', { fieldW, compact })}</div>`;
  }).join('');
  return `<div class="screen ${compact ? 'm' : 'd'}" ${dark ? 'data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;"><main class="fmWrap" style="grid-template-columns: repeat(${compact ? 3 : 2}, ${fieldW}px);">${cards}</main></div>`;
}
