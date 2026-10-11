// Tokens, assets and small shared pieces for the matchups prototype.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAMS, ptsBand, fmt } from './model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const { SHIELDS } = await import(`${REPO}/src/components/crest/shields.ts`);
const { DIVISIONS } = await import(`${REPO}/src/components/crest/divisions.ts`);
const { CURATED_ICONS } = await import(`${REPO}/src/components/crest/icons.ts`);

// ── Real tokens, brace-matched out of globals.css ─────────────────────────
const css = fs.readFileSync(`${REPO}/src/app/globals.css`, 'utf8');
function block(sel) {
  const i = css.indexOf(sel);
  const open = css.indexOf('{', i);
  let d = 0, j = open;
  for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}') { d--; if (!d) break; } }
  return css.slice(i, j + 1);
}
export const LIGHT = block(':root,\n.g-theme-light {');
export const DARK = block('[data-theme="dark"] {');

// ── Assets: local files in preview, uploaded blobs in the canvas ──────────
const BLOBS_PATH = path.join(HERE, 'blobs.json');
export const BLOBS = fs.existsSync(BLOBS_PATH) ? JSON.parse(fs.readFileSync(BLOBS_PATH, 'utf8')) : {};
export const USED = new Set();
let MODE = 'preview';
export const setMode = (m) => { MODE = m; };
export function asset(file) {
  USED.add(file);
  if (MODE === 'dc') {
    if (!BLOBS[file]) throw new Error(`no blob for ${file}`);
    return BLOBS[file];
  }
  return `../assets/${file}`;
}
export const photoSrc = (code) => asset(`p${code}.png`);
export const badgeSrc = (club) => (club ? asset(`club-${club.slug}.png`) : '');

// ── Manager crests, drawn by the app's own crest modules ─────────────────
let crestN = 0;
export const resetCrests = () => { crestN = 0; };
export function crest(k, size, cls = 'crest') {
  const { name, crest: c } = TEAMS[k];
  const shield = SHIELDS.find((s) => s.id === c.shape) || SHIELDS[0];
  const div = DIVISIONS.find((d) => d.id === c.division) || DIVISIONS[0];
  const icon = CURATED_ICONS.find((i) => i.id === c.icon);
  const id = `cc${++crestN}`;
  const parts = name.replace(/’/g, '').trim().split(/\s+/);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  let iconSvg = '';
  if (icon) {
    const s = c.showText ? 36 : 48;
    const vb = parseFloat(icon.viewBox.split(' ')[2]) || 24;
    iconSvg = `<g transform="translate(${50 - s / 2}, ${c.showText ? 34 : 62 - s / 2}) scale(${s / vb})"><path d="${icon.path}" fill="${c.iconColor}"></path></g>`;
  }
  const text = c.showText
    ? `<text x="50" y="${icon ? 80 : 61}" fill="${c.textColor}" font-family="Newsreader, Georgia, serif" font-weight="700" font-size="${icon ? 16 : 26}" text-anchor="middle" dominant-baseline="middle" letter-spacing="0.8">${initials}</text>`
    : '';
  return `<svg class="${cls}" width="${size}" height="${Math.round(size * 1.2)}" viewBox="0 0 100 120" role="img" aria-label="${name} crest"><defs><clipPath id="${id}"><path d="${shield.path}"></path></clipPath></defs><g clip-path="url(#${id})"><rect x="0" y="0" width="100" height="120" fill="${c.primaryColor}"></rect>${div.renderLayers(c.secondaryColor, c.borderColor, c.tertiaryColor ?? c.borderColor)}</g><path d="${shield.path}" fill="none" stroke="${c.borderColor}" stroke-width="3.5"></path>${iconSvg}${text}</svg>`;
}
export const tname = (k) => TEAMS[k].name;

// ── Glyphs (stroke, currentColor) ─────────────────────────────────────────
const G = {
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"></path>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
  chev: '<path d="M6 9l6 6 6-6"></path>',
  left: '<path d="M15 6l-6 6 6 6"></path>',
  right: '<path d="M9 6l6 6-6 6"></path>',
  up: '<path d="M12 19V5"></path><path d="M6 11l6-6 6 6"></path>',
  down: '<path d="M12 5v14"></path><path d="M6 13l6 6 6-6"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  sub: '<path d="M7 17V7"></path><path d="M3 11l4-4 4 4"></path><path d="M17 7v10"></path><path d="M13 13l4 4 4-4"></path>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z"></path>',
};
export const glyph = (k, s = 14, cls = 'gl') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[k]}</svg>`;

// ── The position badge, as PositionBadge draws it (side clip included) ────
const SIDE = { LB: 'l', LWB: 'l', LW: 'l', RB: 'r', RWB: 'r', RW: 'r' };
export const chip = (p, size = 'sm') => `<span class="pc pc-${size}${SIDE[p] ? ` pc-${SIDE[p]}` : ''}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on); --pl: var(--color-pos-${p.toLowerCase()}-line);">${p}</span>`;

// ── The 2.0 portrait: lit frame, cut-out, club crest chipped on the corner ─
const initials = (n) => n.replace(/^[A-Z]\./, '').slice(0, 2).toUpperCase();
// Per-player crop, the app's own solve (src/lib/players/portraitCrop.ts).
const CROP = { md: [156.25, -2, 66], cmp: [150, 0, 54], xs: [150, 3, 44], sm: [150, -2, 36] };
function solveCrop(size, top, w) {
  if (top == null || !w) return null;
  const [z0, in0, box] = CROP[size];
  const zoom = z0 * (0.2365 / w);
  const target = in0 + 0.1310 * (z0 / 100) * box;
  return { zoom, inset: target - top * (zoom / 100) * box };
}
export function portrait(p, size = 'md', withCrest = true) {
  const c = p.photo === 'sq' ? solveCrop(size, p.headTop, p.headW) : null;
  const st = c ? ` style="--z: ${c.zoom.toFixed(2)}%; --in: ${c.inset.toFixed(2)}px;"` : '';
  const img = p.photo
    ? `<img class="gp-img${p.photo === 'tall' ? ' gp-img-alt' : ''}" src="${photoSrc(p.code)}" alt="">`
    : `<span class="gp-none">${initials(p.name)}</span>`;
  const cr = withCrest && p.club ? `<span class="gp-crest"><img src="${badgeSrc(p.club)}" alt="${p.club.name}"></span>` : '';
  return `<span class="gp gp-${size}"${st}><span class="gp-frame">${img}</span>${cr}</span>`;
}
// Round face on a ground mixed from the position colour (the dashboard's plinth, at face size).
export function face(p, size = 40) {
  const st = `--pos: var(--color-pos-${(p.slot ?? p.pos).toLowerCase()}); width: ${size}px; height: ${size}px;`;
  if (!p.photo) return `<span class="fc fcNone" style="${st}">${initials(p.name)}</span>`;
  return `<span class="fc" style="${st}"><img src="${photoSrc(p.code)}" alt=""></span>`;
}

export const ptsBadge = (v, extra = '') => `<span class="pts pts-${ptsBand(v)}${extra}">${fmt(v)}</span>`;

// UK clock for the prototype. The app shows each viewer's own zone.
const UK = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
export const ukTime = (iso) => UK.format(new Date(iso)).replace(',', '');
const UKD = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' });
export const ukDate = (iso) => UKD.format(new Date(iso)).replace(',', '');
