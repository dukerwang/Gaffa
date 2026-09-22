// Emits the Targets artboards (desktop + mobile, light + dark) from one source.
// node build.mjs            -> project/*.dc.html (blob urls) + preview/*.html (local assets)
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/dukewang/Fantasy Futbol';
const HERE = path.dirname(new URL(import.meta.url).pathname);
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

// ── Assets ────────────────────────────────────────────────────────────────
export const BLOB = {
  havertz: '6a51b5cf0c3d0581f3c4da044219ef49', palmer: '21158cbf28ff85ca7500baddc8a43948', mbeumo: '82afd7131524e85db765eda18f5cac38',
  tonali: '8b9275ce2a575db8c1e58af37fdc6605', vandeven: 'f1b3521facfdeffa31e7afdeed0d8d9e', delap: '628a05c98e2c2f0bdd8f92eeb0373638',
  kudus: '1c6e84cdf85ffd453d44409b9ff1fd14', zubimendi: '7defa0c5d31038a1e43d96da3ccac603', manzambi: '6aa1690bcf2d6ff25700db9096cfbd92',
  macallister: '4ad09223a1715bb0a7d89fdddd48c912', mainoo: '5cfdc8ef059b1128fb76a584feb311ec', madueke: '9bc7e86b1f580d3d8b65ea06d3e4aff5',
  lisandro: 'aff9870235cad59a6698a3443ea9f42c', 'club-spurs': '7b87e31aed6e3c573a5eada78ac7046b', 'club-nottingham-forest': '1d13e71a7b918f21f4d27bf2c1444d9e',
  'club-man-utd': '06e4cfdafddfe7d4ed0c226cc864b639', 'club-aston-villa': 'be8205abdfcedfd5e6bb49d283f085ad',
  saliba: 'd7bf6be3ff2112908dd160fe86589efb', haaland: '154a55cf4171f8631ec4da00440ce391',
  wirtz: 'c0b2429e67f562bc0ac6befb311f4bd5', hall: '09c4d53f96d228acb7b130aace947fcc',
  rice: '42383d5cbf7095b37043bd35d6cb2438', gvardiol: 'a3441baecbbbe9c038c398454078d3b5',
  colwill: 'b0c8c9277b3df768ea1f76f657e0ec04', jacquet: '9deeda04f0d8b6cb07ee8f6280e41f04',
  khusanov: '89cc87614c4b0ece94bb9f2a90bdccfd', canvot: 'c1068d6c3a8907525f385660c2605319',
  kroupi: '6bcacdb3f8fb2c72dd88eef12717a6e9', saka: '5b37ef19696ae45c30d20937424c174b',
  caicedo: 'f09a327888ddfe9cf48ad4423c1b9360', gabriel: 'fe4a58d75192bbf5c6e334adc60d5bfe',
  'club-arsenal': '3dbcfc6259485fba0ded10d8cbeb0c6d', 'club-man-city': '982a07a2675049056066bfbc06991167',
  'club-liverpool': '2ea55952c6690c26fce54476946ceabb', 'club-newcastle': '3c2a90e56bbda321a2c042bde1a7e237',
  'club-chelsea': '4975c41c946ca9f3776854bab762e1fe', 'club-crystal-palace': 'de92561cda8cc6be567824efe9420fc4',
  'club-bournemouth': 'ff4ef2354998d8a98ba2ba7a9e251ca5',
};
export let MODE = 'dc';
export const setMode = (m) => { MODE = m; };
export const img = (k) => (MODE === 'dc' ? `/_blob/${BLOB[k]}` : `../assets/${k}.png`);

// ── Manager crests, rendered from the app's own crest modules ─────────────
export const CLUBS = {
  XABI: { name: 'Not Too Xabi', c: { icon: 'griffin', shape: 'circle', division: 'quartered', showText: false, iconColor: '#FBBF24', textColor: '#000000', borderColor: '#D4A017', primaryColor: '#4338CA', tertiaryColor: '#1C1C1C', secondaryColor: '#4338CA' } },
  YANG: { name: 'tottenyang FC', c: { icon: 'flame', shape: 'classic', division: 'solid', showText: false, iconColor: '#2A5A92', textColor: '#FFFFFF', borderColor: '#1C1C1C', primaryColor: '#E8E2D5', tertiaryColor: '#2A5A92', secondaryColor: '#8B5CF6' } },
  ZFC: { name: 'ChelsZ FC', c: { icon: 'crown', shape: 'circle', division: 'solid', showText: false, iconColor: '#D9D4CD', textColor: '#FFFFFF', borderColor: '#2A5A92', primaryColor: '#60A5FA', tertiaryColor: '#A7F3D0', secondaryColor: '#4A4A4A' } },
  COYS: { name: 'Hayden FC', c: { icon: 'castle', shape: 'heraldic', division: 'solid', showText: false, iconColor: '#D4A017', textColor: '#F87171', borderColor: '#D4A017', primaryColor: '#A62626', tertiaryColor: '#D4A017', secondaryColor: '#0F1E36' } },
  PKNG: { name: "Pizzaking’s Club", c: { icon: 'paw', shape: 'arch', division: 'solid', showText: true, iconColor: '#60A5FA', textColor: '#2E7D82', borderColor: '#C084FC', primaryColor: '#1C1C1C', tertiaryColor: '#2E7D82', secondaryColor: '#B54E7F' } },
  CHAI: { name: 'Tea FC', c: { icon: 'anchor', shape: 'circle', division: 'horizontal-half', showText: true, iconColor: '#F7F3ED', textColor: '#F7F3ED', borderColor: '#FBBF24', primaryColor: '#146B40', tertiaryColor: '#1C1C1C', secondaryColor: '#1B4A5A' } },
};
let crestN = 0;
export const resetCrests = () => { crestN = 0; };
export function crest(k, size) {
  const { name, c } = CLUBS[k];
  const shield = SHIELDS.find((s) => s.id === c.shape) || SHIELDS[0];
  const div = DIVISIONS.find((d) => d.id === c.division) || DIVISIONS[0];
  const icon = CURATED_ICONS.find((i) => i.id === c.icon);
  const id = `cc${++crestN}`;
  const parts = name.trim().split(/\s+/);
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
  return `<svg class="crest" width="${size}" height="${Math.round(size * 1.2)}" viewBox="0 0 100 120" role="img" aria-label="${name} crest"><defs><clipPath id="${id}"><path d="${shield.path}"></path></clipPath></defs><g clip-path="url(#${id})"><rect x="0" y="0" width="100" height="120" fill="${c.primaryColor}"></rect>${div.renderLayers(c.secondaryColor, c.borderColor, c.tertiaryColor ?? c.borderColor)}</g><path d="${shield.path}" fill="none" stroke="${c.borderColor}" stroke-width="3.5"></path>${iconSvg}${text}</svg>`;
}
export const club = (k) => CLUBS[k].name;
// ── Glyphs (stroke, currentColor) ─────────────────────────────────────────
export const G = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  eyeOff: '<path d="M3 3l18 18"></path><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4"></path><path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  arrow: '<path d="M4 12h15"></path><path d="M13 6l6 6-6 6"></path>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"></path>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
  chev: '<path d="M6 9l6 6 6-6"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
};
export const glyph = (k, s = 14, cls = 'gl') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[k]}</svg>`;

export const chip = (p, size = 'sm') => `<span class="pc pc-${size}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on); --pl: var(--color-pos-${p.toLowerCase()}-line);">${p}</span>`;
export const face = (k, p, cls = 'face') => `<span class="${cls}" style="--pos: var(--color-pos-${p.toLowerCase()});"><img src="${img(k)}" alt=""></span>`;
export const badge = (k) => `<img class="badge" src="${img('club-' + k)}" alt="">`;
