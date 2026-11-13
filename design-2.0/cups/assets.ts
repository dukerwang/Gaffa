// Renders Matchday Militia's crests and the three cup trophies to SVG strings
// for the brainstorm mockups. Run: node node_modules/tsx/dist/cli.mjs <this file>
import { writeFileSync } from 'node:fs';
import { SHIELDS } from '../../src/components/crest/shields';
import { DIVISIONS } from '../../src/components/crest/divisions';
import { CURATED_ICONS } from '../../src/components/crest/icons';
// Untyped .mjs; resolved through allowJs.
import { trophySvg } from '../trophies/trophies.mjs';

type C = { icon: string | null; shape: string; division: string; showText: boolean; iconColor: string; textColor: string; borderColor: string; primaryColor: string; tertiaryColor?: string; secondaryColor: string };

const teams: Record<string, C> = {
  'ChelsZ FC': { icon: 'crown', shape: 'circle', division: 'solid', showText: false, iconColor: '#D9D4CD', textColor: '#FFFFFF', borderColor: '#2A5A92', primaryColor: '#60A5FA', tertiaryColor: '#A7F3D0', secondaryColor: '#4A4A4A' },
  "Pizzaking's Club": { icon: 'paw', shape: 'arch', division: 'solid', showText: true, iconColor: '#60A5FA', textColor: '#2E7D82', borderColor: '#C084FC', primaryColor: '#1C1C1C', tertiaryColor: '#2E7D82', secondaryColor: '#B54E7F' },
  'tottenyang FC': { icon: 'flame', shape: 'classic', division: 'solid', showText: false, iconColor: '#2A5A92', textColor: '#FFFFFF', borderColor: '#1C1C1C', primaryColor: '#E8E2D5', tertiaryColor: '#2A5A92', secondaryColor: '#8B5CF6' },
  'Not Too Xabi': { icon: 'griffin', shape: 'circle', division: 'quartered', showText: false, iconColor: '#FBBF24', textColor: '#000000', borderColor: '#D4A017', primaryColor: '#4338CA', tertiaryColor: '#1C1C1C', secondaryColor: '#4338CA' },
  'Hayden FC': { icon: 'castle', shape: 'heraldic', division: 'solid', showText: false, iconColor: '#D4A017', textColor: '#F87171', borderColor: '#D4A017', primaryColor: '#A62626', tertiaryColor: '#D4A017', secondaryColor: '#0F1E36' },
  'Tea FC': { icon: 'anchor', shape: 'circle', division: 'horizontal-half', showText: true, iconColor: '#F7F3ED', textColor: '#F7F3ED', borderColor: '#FBBF24', primaryColor: '#146B40', tertiaryColor: '#1C1C1C', secondaryColor: '#1B4A5A' },
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

let n = 0;
function crest(name: string, c: C) {
  const id = `cc${n++}`;
  const shield = SHIELDS.find((s) => s.id === c.shape) || SHIELDS[0];
  const division = DIVISIONS.find((d) => d.id === c.division) || DIVISIONS[0];
  const icon = c.icon ? CURATED_ICONS.find((i) => i.id === c.icon) : null;
  const layers = division.renderLayers(c.secondaryColor, c.borderColor, c.tertiaryColor ?? c.borderColor) || '';
  let iconSvg = '';
  if (icon) {
    const s = c.showText ? 36 : 48;
    const vb = parseFloat(icon.viewBox.split(' ')[2]) || 24;
    iconSvg = `<g transform="translate(${50 - s / 2}, ${c.showText ? 34 : 62 - s / 2}) scale(${s / vb})"><path d="${icon.path}" fill="${c.iconColor}"/></g>`;
  }
  const text = c.showText
    ? `<text x="50" y="${icon ? 80 : 61}" fill="${c.textColor}" text-anchor="middle" dominant-baseline="middle" font-family="Newsreader, serif" font-weight="700" font-size="${icon ? 16 : 26}">${initials(name)}</text>`
    : '';
  return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}"><path d="${shield.path}"/></clipPath></defs><g clip-path="url(#${id})"><rect width="100" height="120" fill="${c.primaryColor}"/><g>${layers}</g></g><path d="${shield.path}" fill="none" stroke="${c.borderColor}" stroke-width="3.5"/>${iconSvg}${text}</svg>`;
}

const crests = Object.fromEntries(Object.entries(teams).map(([k, v]) => [k, crest(k, v)]));
const club = { primary: '#4338CA', secondary: '#FBBF24' };
const trophies: Record<string, string> = {};
for (const kind of ['champions_cup', 'league_cup', 'consolation_cup']) {
  for (const [size, h] of [['hero', 200], ['card', 96], ['pip', 22]] as const) {
    trophies[`${kind}_${size}`] = trophySvg(kind, size === 'hero' || size === 'card' ? 'hero' : 'pip', `${kind}${size}`, '2026-27', club, h);
  }
}
writeFileSync(new URL('./assets.json', import.meta.url), JSON.stringify({ crests, trophies }));
console.log('ok', Object.keys(crests).length, Object.keys(trophies).length);
