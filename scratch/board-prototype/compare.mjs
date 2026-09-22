// Three heading-and-surface treatments for the same two Board sections.
// node compare.mjs -> project/Heads{Module,Ink,Tab}.dc.html (+ preview)
import fs from 'node:fs';
import path from 'node:path';
import { LIGHT, DARK, setMode, img, resetCrests, crest, club, glyph, chip, badge } from './lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);

const face = (k, p, cls = 'face') => k === 'ndiaye'
  ? `<span class="${cls} faceNone" style="--pos: var(--color-pos-${p.toLowerCase()});">ND</span>`
  : `<span class="${cls}${k === 'delap' ? ' faceTall' : ''}" style="--pos: var(--color-pos-${p.toLowerCase()});"><img src="${img(k)}" alt=""></span>`;

// Every row in both sections uses one grammar:
// player · who · terms · price (the number you'd act on) · ends · one action.
const MINE = () => [
  { k: 'havertz', name: 'Havertz', pos: 'ST', meta: `${badge('arsenal')}Arsenal · €55m`,
    who: `${crest('ZFC', 20)}ChelsZ FC lead <span class="muted">· 2 bids</span>`, terms: 'For sale',
    price: '€36m', priceK: 'high bid', ends: '1d 06h', live: true, act: ['View', 'quiet'] },
  { k: 'ndiaye', name: 'Ndiaye', pos: 'LW', meta: `${badge('man-city')}Man City · €55m`,
    who: `${crest('COYS', 20)}Hayden FC want him`, terms: 'Offers only · asking €45m',
    price: '€45m', priceK: 'asking', ends: '', act: ['Edit', 'quiet'] },
];
const LISTED = () => [
  { k: 'saliba', name: 'Saliba', pos: 'CB', meta: `<span class="you">${crest('XABI', 12)}Your target</span>`,
    who: `${crest('PKNG', 20)}Pizzaking’s Club`, terms: 'For sale',
    price: '€59m', priceK: 'next bid', ends: '2d 04h', live: true, act: ['Bid', 'go'] },
  { k: 'hall', name: 'Hall', pos: 'LWB', meta: `<span class="you">${crest('XABI', 12)}Fits your LB target</span>`,
    who: `${crest('ZFC', 20)}ChelsZ FC`, terms: 'Offers only · asking €30m',
    price: '€30m', priceK: 'asking', ends: '', act: ['Offer', 'quiet'] },
  { k: 'tonali', name: 'Tonali', pos: 'DM', meta: `${badge('spurs')}Spurs · €80m`,
    who: `${crest('PKNG', 20)}Pizzaking’s Club`, terms: 'For sale · €60m',
    price: '€48m', priceK: 'floor', ends: '2d 20h', act: ['Bid', 'go'] },
  { k: 'vandeven', name: 'Van de Ven', pos: 'CB', meta: `${badge('spurs')}Spurs · €50m`,
    who: `${crest('COYS', 20)}Hayden FC`, terms: 'Release clause only',
    price: '€70m', priceK: 'clause', ends: '', act: ['Pay Clause', 'go'] },
  { k: 'kudus', name: 'Kudus', pos: 'RW', meta: `${badge('spurs')}Spurs · €50m`,
    who: `${crest('YANG', 20)}tottenyang FC`, terms: 'Wants players',
    price: '', priceK: '', ends: '', act: ['Offer', 'quiet'] },
];
const SPINE = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const COUNT = { CB: 2, LWB: 1, DM: 1, RW: 1, ST: 1 };

const heads = (whoLabel) => `<div class="rh"><span class="hPlayer">Player</span><span>${whoLabel}</span><span>Terms</span><span class="r">Price</span><span class="r">Ends</span><span></span></div>`;
const row = (r) => `
<a class="rw">
  <span class="cFace">${face(r.k, r.pos, 'face face-40')}</span>
  <span class="pTxt"><span class="namerow"><b class="pName">${r.name}</b>${chip(r.pos)}</span><span class="pMeta">${r.meta}</span></span>
  <span class="cWho">${r.who}</span>
  <span class="cTerms">${r.terms}</span>
  <span class="cPrice">${r.price ? `<span class="pk">${r.priceK}</span><b>${r.price}</b>` : '<span class="pk"></span><b class="none">–</b>'}</span>
  <span class="cEnds${r.live ? ' endsLive' : ''}">${r.ends ? `${r.live ? '<i class="liveDot"></i>' : ''}${r.ends}` : ''}</span>
  <span class="cAct"><button class="btn btnSm ${r.act[1] === 'go' ? 'btnGo' : 'btnQuiet'}">${r.act[0]}</button></span>
</a>`;

const seg = () => `<span class="seg"><button class="segB segOn">Listed <span class="segN">6</span></button><button class="segB">Wanted <span class="segN">6</span></button></span>`;
const posChips = () => `<span class="pos">${SPINE.map((p) => {
  const n = COUNT[p] ?? 0;
  return `<button class="pch${n ? '' : ' pch0'}${p === 'CB' ? ' pchOn' : ''}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on);">${p}${n ? `<span class="pchN">${n}</span>` : ''}</button>`;
}).join('')}</span>`;

// ── Three treatments of "a section": the heading lives with its panel ─────
function section(kind, title, tools, body) {
  if (kind === 'tab') {
    return `<section class="sec secTab">
      <div class="tabRow"><h2 class="tabT">${title}</h2><span class="tabTools">${tools}</span></div>
      <div class="panel panelTab">${body}</div>
    </section>`;
  }
  return `<section class="sec panel ${kind === 'ink' ? 'panelInk' : ''}">
    <header class="bar"><h2 class="barT">${title}</h2><span class="barTools">${tools}</span></header>
    ${body}
  </section>`;
}

const VARIANTS = {
  module: { name: 'Heading Inside the Panel', note: 'The title sits in the panel’s own top bar, at the size of the controls beside it.' },
  ink: { name: 'Dark Heading Bar', note: 'The same, with the bar in the page’s dark ink so each section starts with a solid band.' },
  tab: { name: 'Heading as a Tab', note: 'The title is a tab rising from the panel’s top edge; the controls sit on the same line.' },
};

function page(kind) {
  const v = VARIANTS[kind];
  const listings = section(kind, 'Your Listings', `<button class="btn btnSm btnGo">${glyph('plus', 14)}Add</button>`, heads('Interest') + MINE().map(row).join(''));
  const board = section(kind, 'The Board', `${seg()}${posChips()}`, heads('Listed By') + LISTED().map(row).join(''));
  return `<div class="screen d" style="width: 1440px; height: __H__px;">
    <main class="wrap">
      ${listings}
      ${board}
    </main>
  </div>`;
}

const STYLE = fs.readFileSync(path.join(HERE, 'targets.css'), 'utf8') + '\n' + `
.btn { font-family: var(--font-label); font-weight: 600; font-size: 15px; letter-spacing: 0; }
.btnSm { height: 34px; padding: 0 14px; }
.muted { color: var(--color-text-muted); }
.faceTall img { top: 0; left: -14%; width: 128%; }
.faceNone { display: grid; place-items: center; color: #fff; font-family: var(--font-serif); font-weight: 700; font-size: 15px; }

.vHead { display: flex; align-items: baseline; gap: 14px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px dashed var(--color-border); }
.vName { font-family: var(--font-label); font-weight: 700; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--color-accent-ink); }
.vNote { font-size: 13px; color: var(--color-text-secondary); }

.sec + .sec { margin-top: 28px; }
.panel { border-radius: 14px; background: var(--color-bg-card); box-shadow: inset 0 0 0 1px var(--color-border); overflow: hidden; }

/* Heading inside the panel */
.bar { display: flex; align-items: center; gap: 16px; height: 60px; padding: 0 20px; border-bottom: 1px solid var(--color-border); }
.barT { font-family: var(--font-serif); font-weight: 700; font-size: 21px; letter-spacing: -0.02em; white-space: nowrap; }
.barTools { margin-left: auto; display: flex; align-items: center; gap: 14px; }

/* Dark heading bar */
.panelInk .bar { background: var(--color-text-primary); border-bottom: 0; }
.panelInk .barT { color: var(--color-bg-card); }
.panelInk .seg { background: rgba(255,255,255,.1); }
.panelInk .segB { color: rgba(255,255,255,.72); }
.panelInk .segOn { background: rgba(255,255,255,.16); color: #fff; box-shadow: none; }
.panelInk .pch { background: rgba(255,255,255,.06); box-shadow: none; color: rgba(255,255,255,.8); }
.panelInk .pch0 { color: rgba(255,255,255,.3); background: transparent; }
.panelInk .pchOn { background: var(--pf); color: var(--pi); }
[data-theme="dark"] .panelInk .bar { background: var(--color-bg-elevated); }

/* Heading as a tab */
.tabRow { display: flex; align-items: flex-end; gap: 16px; }
.tabT { position: relative; top: 1px; padding: 12px 22px 11px; border-radius: 14px 14px 0 0; background: var(--color-bg-card); box-shadow: inset 1px 1px 0 var(--color-border), inset -1px 0 0 var(--color-border); font-family: var(--font-serif); font-weight: 700; font-size: 21px; letter-spacing: -0.02em; white-space: nowrap; }
.tabTools { margin-left: auto; display: flex; align-items: center; gap: 14px; padding-bottom: 10px; }
.panelTab { border-top-left-radius: 0; }


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

/* One row grammar.
   Columns by type, the same rule on header and cell: labels left, figures right, action right.
   The portrait centres on the row; all text, button labels included, shares the name's baseline. */
.rh, .rw { display: grid; grid-template-columns: 40px minmax(0, 1fr) 220px 230px 108px 84px 124px; column-gap: 20px; padding: 0 20px; }
.rh { align-items: center; height: 36px; font-family: var(--font-label); font-weight: 600; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border-subtle); }
.hPlayer { grid-column: 1 / 3; }
.r { text-align: right; }
.rw { align-items: baseline; padding-top: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--color-border-subtle); color: inherit; }
.rw:last-child { border-bottom: 0; }
.cFace { align-self: center; }
.pTxt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pName { font-family: var(--font-serif); font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
.pMeta { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }
.you { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; color: var(--color-accent-ink); }
.cWho { font-size: 14px; font-weight: 600; white-space: nowrap; }
.cWho .crest { display: inline-block; vertical-align: -6px; margin-right: 8px; }
.cWho .muted { font-weight: 500; }
.cTerms { font-size: 13px; color: var(--color-text-secondary); white-space: nowrap; }
/* Price: the label starts at one edge, the figure ends at the other, on every row. */
.cPrice { display: grid; grid-template-columns: 1fr auto; align-items: baseline; column-gap: 8px; white-space: nowrap; }
.cPrice b { font-family: var(--font-serif); font-weight: 700; font-size: 19px; font-variant-numeric: tabular-nums; text-align: right; }
.cPrice b.none { font-weight: 400; color: var(--color-text-muted); }
.pk { font-size: 12px; color: var(--color-text-muted); }
.cEnds { font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--color-text-secondary); white-space: nowrap; text-align: right; }
.cEnds.endsLive { color: var(--color-live); }
.cEnds .liveDot { display: inline-block; width: 6px; height: 6px; margin-right: 6px; vertical-align: 2px; }
/* The action column keeps clear air from the figures beside it. */
.cAct { align-self: baseline; margin-left: 12px; }
.cAct .btn { width: 100%; }
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
  { file: 'HeadsModule.dc.html', title: 'Heading Inside the Panel', w: 1440, make: () => page('module') },
  { file: 'HeadsInk.dc.html', title: 'Dark Heading Bar', w: 1440, make: () => page('ink') },
  { file: 'HeadsTab.dc.html', title: 'Heading as a Tab', w: 1440, make: () => page('tab') },
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
