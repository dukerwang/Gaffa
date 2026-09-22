// Two personality options for Your Listings and The Board, each with a heading
// that stands on the cream (no card around it) but carries something visual.
// node personality.mjs -> project/Personality{Faces,Scoreboard}.dc.html (+ preview)
import fs from 'node:fs';
import path from 'node:path';
import { LIGHT, DARK, setMode, img, resetCrests, crest, glyph, chip, badge } from './lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PHOTO = { delap: 'tall', ndiaye: 'none' };

// Round avatar (option B) or a small position-ground portrait tile (option A).
const avatar = (k, p, kind) => {
  const st = `--pos: var(--color-pos-${p.toLowerCase()});`;
  if (PHOTO[k] === 'none') return `<span class="${kind === 'tile' ? 'ptile' : 'face face-40'} faceNone" style="${st}">ND</span>`;
  if (kind === 'tile') return `<span class="ptile" style="${st}"><img class="${PHOTO[k] === 'tall' ? 'ptTall' : ''}" src="${img(k)}" alt=""></span>`;
  return `<span class="face face-40${PHOTO[k] === 'tall' ? ' faceTall' : ''}" style="${st}"><img src="${img(k)}" alt=""></span>`;
};
const stackFace = (k, p) => PHOTO[k] === 'none'
  ? `<span class="sf faceNone" style="--pos: var(--color-pos-${p.toLowerCase()});">ND</span>`
  : `<span class="sf${PHOTO[k] === 'tall' ? ' faceTall' : ''}" style="--pos: var(--color-pos-${p.toLowerCase()});"><img src="${img(k)}" alt=""></span>`;

const MINE = () => [
  { k: 'havertz', name: 'Havertz', pos: 'ST', meta: `${badge('arsenal')}Arsenal · €55m`, by: 'ZFC',
    who: 'ChelsZ FC lead', whoSub: '2 bids', terms: 'For sale', price: '€36m', priceK: 'High bid', ends: '1d 06h', live: true, act: ['View', 'quiet'] },
  { k: 'ndiaye', name: 'Ndiaye', pos: 'LW', meta: `${badge('man-city')}Man City · €55m`, by: 'COYS',
    who: 'Hayden FC want him', terms: 'Offers only', price: '€45m', priceK: 'Asking', ends: '', act: ['Edit', 'quiet'] },
];
const LISTED = () => [
  { k: 'saliba', name: 'Saliba', pos: 'CB', mine: true, meta: `<span class="you">${crest('XABI', 12)}Your target</span>`, by: 'PKNG',
    who: 'Pizzaking’s Club', terms: 'For sale', price: '€59m', priceK: 'Next bid', ends: '2d 04h', live: true, act: ['Bid', 'go'] },
  { k: 'hall', name: 'Hall', pos: 'LWB', mine: true, meta: `<span class="you">${crest('XABI', 12)}Fits your LB target</span>`, by: 'ZFC',
    who: 'ChelsZ FC', terms: 'Offers only', price: '€30m', priceK: 'Asking', ends: '', act: ['Offer', 'quiet'] },
  { k: 'tonali', name: 'Tonali', pos: 'DM', meta: `${badge('spurs')}Spurs · €80m`, by: 'PKNG',
    who: 'Pizzaking’s Club', terms: 'For sale · asking €60m', price: '€48m', priceK: 'Floor', ends: '2d 20h', open: true, act: ['Bid', 'go'] },
  { k: 'vandeven', name: 'Van de Ven', pos: 'CB', meta: `${badge('spurs')}Spurs · €50m`, by: 'COYS',
    who: 'Hayden FC', terms: 'Release clause only', price: '€70m', priceK: 'Clause', ends: '', act: ['Pay Clause', 'go'] },
  { k: 'kudus', name: 'Kudus', pos: 'RW', meta: `${badge('spurs')}Spurs · €50m`, by: 'YANG',
    who: 'tottenyang FC', terms: 'Wants players', price: '', priceK: '', ends: '', act: ['Offer', 'quiet'] },
  { k: 'delap', name: 'Delap', pos: 'ST', meta: `${badge('nottingham-forest')}Nott'm Forest · €28m`, by: 'CHAI',
    who: 'Tea FC', terms: 'Would loan him out', price: '', priceK: '', ends: '', act: ['Offer', 'quiet'] },
];
const SPINE = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const COUNT = { CB: 2, LWB: 1, DM: 1, RW: 1, ST: 1 };

const seg = () => `<span class="seg"><button class="segB segOn">Listed <span class="segN">6</span></button><button class="segB">Wanted <span class="segN">6</span></button></span>`;
const posChips = () => `<span class="pos">${SPINE.map((p) => {
  const n = COUNT[p] ?? 0;
  return `<button class="pch${n ? '' : ' pch0'}${p === 'CB' ? ' pchOn' : ''}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on);">${p}${n ? `<span class="pchN">${n}</span>` : ''}</button>`;
}).join('')}</span>`;
const addBtn = `<button class="btn btnGo btnSm">${glyph('plus', 14)}Add</button>`;

const ends = (r, v) => {
  if (!r.ends) return '<span class="cEnds"></span>';
  if (v === 'score') return `<span class="cEnds"><span class="bug${r.live ? ' bugLive' : ''}">${r.live ? '<i class="liveDot"></i>' : ''}${r.ends}</span></span>`;
  return `<span class="cEnds${r.live ? ' endsLive' : ''}">${r.live ? '<i class="liveDot"></i>' : ''}${r.ends}</span>`;
};
const head = (who) => `<div class="rh"><span class="hPlayer">Player</span><span>${who}</span><span>Terms</span><span class="r">Price</span><span class="r">Ends</span><span></span></div>`;
const row = (r, v) => `
<a class="rw${v === 'faces' && r.mine ? ' rwMine' : ''}">
  <span class="cFace">${avatar(r.k, r.pos, v === 'faces' ? 'tile' : 'round')}</span>
  <span class="pTxt"><span class="namerow"><b class="pName">${r.name}</b>${chip(r.pos)}</span><span class="pMeta">${r.meta}</span></span>
  <span class="cWho"><span class="whoLine">${crest(r.by, v === 'score' ? 26 : 20)}${r.who}</span>${r.whoSub ? `<span class="whoSub">${r.whoSub}</span>` : ''}</span>
  <span class="cTerms">${r.terms}</span>
  <span class="cPrice">${r.price ? `<b>${r.price}</b><span class="pk">${r.priceK}</span>` : '<b class="none">–</b>'}</span>
  ${ends(r, v)}
  <span class="cAct"><button class="btn btnSm ${r.act[1] === 'go' ? 'btnGo' : 'btnQuiet'}">${r.act[0]}</button></span>
</a>`;

// ── Headings that stand on the cream ─────────────────────────────────────
const headFaces = (title, people, tools) => `
<div class="sh">
  <span class="hstack">${people.slice(0, 5).map(([k, p]) => stackFace(k, p)).join('')}${people.length > 5 ? `<span class="sf sfMore">+${people.length - 5}</span>` : ''}</span>
  <h2 class="shT">${title}</h2>
  <span class="shTools">${tools}</span>
</div>`;
const headTile = (title, key, value, tools, live) => `
<div class="sh">
  <span class="tileN${live ? ' tileLive' : ''}"><span class="tileK">${key}</span><span class="tileV">${value}</span></span>
  <h2 class="shT">${title}</h2>
  <span class="shTools">${tools}</span>
</div>`;

function page(v) {
  const mine = MINE(), listed = LISTED();
  const listingsHead = v === 'faces'
    ? headFaces('Your Listings', mine.map((r) => [r.k, r.pos]), addBtn)
    : headTile('Your Listings', 'Live', '1', addBtn, true);
  const boardHead = v === 'faces'
    ? headFaces('The Board', listed.map((r) => [r.k, r.pos]), `${seg()}${posChips()}`)
    : headTile('The Board', 'Listed', '6', `${seg()}${posChips()}`);
  return `<div class="screen d v-${v}" style="width: 1440px; height: __H__px;">
    <main class="wrap">
      <section class="sec">${listingsHead}<div class="panel">${head('Interest')}${mine.map((r) => row(r, v)).join('')}</div></section>
      <section class="sec">${boardHead}<div class="panel">${head('Listed By')}${listed.map((r) => row(r, v)).join('')}</div></section>
    </main>
  </div>`;
}

const STYLE = fs.readFileSync(path.join(HERE, 'targets.css'), 'utf8') + '\n' + `
.btn { font-family: var(--font-label); font-weight: 600; font-size: 15px; letter-spacing: 0; }
.btnSm { height: 34px; padding: 0 14px; }
.faceTall img { top: 0; left: -14%; width: 128%; }
.faceNone { display: grid; place-items: center; color: #fff; font-family: var(--font-serif); font-weight: 700; font-size: 15px; }
.sec + .sec { margin-top: 44px; }
.panel { border-radius: 14px; background: var(--color-bg-card); box-shadow: inset 0 0 0 1px var(--color-border); overflow: hidden; }

/* Heading on the cream: an object, then the name, then the section's controls */
.sh { display: flex; align-items: center; gap: 14px; min-height: 52px; margin-bottom: 14px; }
.shT { font-family: var(--font-serif); font-weight: 700; font-size: 30px; line-height: 1; letter-spacing: -0.03em; white-space: nowrap; }
.shTools { margin-left: auto; display: flex; align-items: center; gap: 14px; }

/* Option A: a stack of the section's portraits */
.hstack { display: flex; flex-shrink: 0; }
.sf { position: relative; width: 38px; height: 38px; border-radius: 50%; overflow: hidden; background: color-mix(in oklab, var(--pos) 70%, black); box-shadow: 0 0 0 3px var(--color-bg-primary); flex-shrink: 0; }
.sf + .sf { margin-left: -11px; }
.sf img { position: absolute; top: 2%; left: -42%; width: 184%; max-width: none; }
.sf.faceTall img { top: 0; left: -14%; width: 128%; }
.sfMore { display: grid; place-items: center; background: var(--color-text-primary); color: var(--color-bg-primary); font-family: var(--font-label); font-weight: 700; font-size: 13px; }

/* Option B: the dashboard's number tile */
.tileN { display: grid; place-items: center; align-content: center; width: 50px; height: 50px; border-radius: 12px; background: var(--color-text-primary); flex-shrink: 0; }
.tileK { font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: color-mix(in oklab, var(--color-bg-card) 60%, var(--color-text-primary)); line-height: 1; }
.tileV { font-family: var(--font-serif); font-weight: 700; font-size: 26px; color: var(--color-bg-card); line-height: 1; margin-top: 2px; }
.tileLive .tileK { color: #FF9C93; }

/* Controls */
.seg { display: inline-flex; padding: 3px; border-radius: 9px; background: var(--color-bg-secondary); }
.segB { height: 30px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); font-family: var(--font-label); font-weight: 600; font-size: 14px; }
.segOn { background: var(--color-bg-card); color: var(--color-text-primary); box-shadow: var(--shadow-sm); }
.segN { font-family: var(--font-serif); font-weight: 700; margin-left: 2px; }
.pos { display: flex; gap: 3px; }
.pch { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 8px; border: 0; border-radius: 7px; background: transparent; box-shadow: inset 0 0 0 1px var(--color-border); color: var(--color-text-primary); font-family: var(--font-label); font-weight: 700; font-size: 12px; letter-spacing: .02em; }
.pchN { font-family: var(--font-serif); font-size: 14px; }
.pch0 { box-shadow: none; color: var(--color-text-muted); font-weight: 600; }
.pchOn { background: var(--pf); color: var(--pi); box-shadow: none; }

/* The approved row grammar */
.rh, .rw { display: grid; grid-template-columns: 48px minmax(0, 1fr) 220px 190px 104px 96px 124px; column-gap: 20px; padding: 0 20px; }
.rh { align-items: center; height: 36px; font-family: var(--font-label); font-weight: 600; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border-subtle); }
.hPlayer { grid-column: 1 / 3; }
.r { text-align: right; }
.rw { align-items: baseline; padding-top: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--color-border-subtle); color: inherit; }
.rw:last-child { border-bottom: 0; }
.cFace { align-self: center; }
.pTxt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pName { font-family: var(--font-serif); font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
.pMeta { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }
.you { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; color: var(--color-accent-ink, var(--color-accent)); }
.cWho { display: flex; flex-direction: column; gap: 3px; font-size: 14px; font-weight: 600; white-space: nowrap; }
.cWho .crest { display: inline-block; vertical-align: -6px; margin-right: 8px; }
.whoSub { padding-left: 28px; font-size: 12px; font-weight: 500; color: var(--color-text-muted); }
.cTerms { font-size: 13px; color: var(--color-text-secondary); white-space: nowrap; }
.cPrice { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; white-space: nowrap; }
.cPrice b { font-family: var(--font-serif); font-weight: 700; font-size: 19px; font-variant-numeric: tabular-nums; }
.cPrice b.none { font-weight: 400; color: var(--color-text-muted); }
.pk { font-size: 12px; color: var(--color-text-muted); }
.cEnds { font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--color-text-secondary); white-space: nowrap; text-align: right; }
.cEnds.endsLive { color: var(--color-live); }
.cEnds .liveDot { display: inline-block; width: 6px; height: 6px; margin-right: 6px; vertical-align: 2px; }
.cAct { align-self: baseline; margin-left: 12px; }
.cAct .btn { width: 100%; }

/* Option A rows: portrait tiles, and a tint on rows about your own targets */
.ptile { position: relative; display: block; width: 48px; height: 48px; border-radius: 10px; overflow: hidden; background: color-mix(in oklab, var(--pos) 68%, black); }
.ptile img { position: absolute; top: 4px; left: 50%; width: 74px; max-width: none; transform: translateX(-50%); }
.ptile img.ptTall { top: 0; width: 60px; }
.ptile.faceNone { display: grid; place-items: center; }
.rwMine { background: var(--color-green-50); }
[data-theme="dark"] .rwMine { background: rgba(31,163,95,.08); }

/* Option B rows: a score bug for auction clocks, larger club crests */
.v-score .cWho .crest { vertical-align: -10px; }
.v-score .whoSub { padding-left: 34px; }
.bug { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border-radius: 6px; background: var(--color-text-primary); color: var(--color-bg-card); font-family: var(--font-mono); font-weight: 700; font-size: 13px; }
.bug .liveDot { margin: 0; width: 6px; height: 6px; color: #FF7A70; vertical-align: 0; }
.bug:not(.bugLive) { background: transparent; color: var(--color-text-secondary); box-shadow: inset 0 0 0 1px var(--color-border); }
.v-score .cEnds { align-self: baseline; }
`;

const FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Hanken+Grotesk:wght@400;500;600;700&family=Sofia+Sans+Semi+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap';
function doc(inner, h, title, mode) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
${mode === 'dc' ? '<script src="./support.js"></script>' : ''}
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="${FONTS.replace(/&/g, '&amp;')}">
<style>
${LIGHT}
${DARK}
:root { --font-newsreader: 'Newsreader'; --font-hanken-grotesk: 'Hanken Grotesk'; --font-jetbrains-mono: 'JetBrains Mono'; --font-label: 'Sofia Sans Semi Condensed', 'Hanken Grotesk', sans-serif; }
body { margin: 0; background: #d9d6cf; }
${STYLE}
</style>
</helmet>
${inner.replace('__H__', h)}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

export const BOARDS = [
  { file: 'PersonalityFaces.dc.html', title: 'A · Faces', w: 1440, make: () => page('faces') },
  { file: 'PersonalityScore.dc.html', title: 'B · Scoreboard', w: 1440, make: () => page('score') },
];
const hp = path.join(HERE, 'board-heights.json');
const heights = fs.existsSync(hp) ? JSON.parse(fs.readFileSync(hp, 'utf8')) : {};
for (const b of BOARDS) {
  const h = heights[b.file] ?? 1000;
  for (const mode of ['dc', 'preview']) {
    setMode(mode); resetCrests();
    const out = mode === 'dc' ? path.join(HERE, 'project', b.file) : path.join(HERE, 'preview', b.file.replace('.dc.html', '.html'));
    fs.writeFileSync(out, doc(b.make(), h, b.title, mode));
  }
}
console.log('built', BOARDS.length);
