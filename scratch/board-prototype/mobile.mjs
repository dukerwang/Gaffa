// The Board on a phone, composed for the phone: a segmented control splits the
// page into three short views, rows are list cells, actions live in a sheet.
// node mobile.mjs -> project/Phone*.dc.html (+ preview)
import fs from 'node:fs';
import path from 'node:path';
import { LIGHT, DARK, setMode, img, resetCrests, crest, glyph, chip } from './lib.mjs';
import { MINE, INBOX, liveCard, tile, roleTile, T_MINE, T_LISTED, topbar, subnav, posChips, ptile, sface, screst, sdisc, seg } from './board.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const W = 390;

const chev = `<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>`;
const addBtn = `<button class="btn btnGo addM">${glyph('plus', 15)}Add</button>`;

// Segmented control under the tabs: three peer views of one page.
const views = (on) => `<div class="views"><div class="viewsIn">${[['Yours', null], ['Wanted From You', 3], ['Board', 6]].map(([n, c]) => `<button class="vw${n === on ? ' vwOn' : ''}">${n}${c ? `<span class="vwN">${c}</span>` : ''}</button>`).join('')}</div></div>`;

const head = (title, stack, tools = '') => `<div class="mh">${stack ? `<span class="hstack">${stack.join('')}</span>` : ''}<h2 class="mhT">${title}</h2>${tools ? `<span class="mhTools">${tools}</span>` : ''}</div>`;

// A list cell: portrait, two lines, a trailing figure, a chevron. The whole cell is the tap target.
const SUB = {
  havertz: 'Leading · 2 bids', ndiaye: 'Wants him · offers only',
};
const cell = (r) => {
  const by = (r.who.match(/<svg[\s\S]*?<\/svg>/) || [''])[0];
  const fact = SUB[r.k] ?? r.terms.split(' · ')[0];
  return `
<a class="cell${r.mine ? ' cellMine' : ''}">
  ${ptile(r.k, r.pos)}
  <span class="cTxt"><span class="namerow"><b class="cName">${r.name}</b>${chip(r.pos)}</span><span class="cSub">${by}${fact}</span></span>
  <span class="cTrail">${r.price ? `<b class="cFig">${r.price}</b>` : '<b class="cFig none">–</b>'}${r.ends ? `<span class="cClock${r.live ? ' isLive' : ''}">${r.live ? '<i class="liveDot"></i>' : ''}${r.ends}</span>` : r.priceK ? `<span class="cKind">${r.priceK}</span>` : ''}</span>
  ${chev}
</a>`;
};

// Wanted From You: the asking club's crest, what they want, their terms, and who of yours it means.
const ASK_WHAT = ['Rice', 'Starting Centre-Back', 'Striker Prospect'];
const askCell = (r, i, who) => `
<a class="cell">
  <span class="cCrest">${crest(r.by, 30)}</span>
  <span class="cTxt"><b class="cHead">${ASK_WHAT[i]}</b><span class="cSub">${r.terms[0]}${r.terms[1] ? ` · up to <b class="cash">${r.terms[1]}</b>` : ''}</span></span>
  <span class="cTrail cTrailFace">${who}</span>
  ${chev}
</a>`;

const group = (inner) => `<div class="grp">${inner}</div>`;

function yours() {
  return `
  ${head('Your Targets', [sface('saliba', 'CB'), sface('haaland', 'ST'), sface('wirtz', 'AM'), sdisc('LB')], addBtn)}
  ${liveCard()}
  <div class="phRail">${MINE.map(tile).join('')}${roleTile()}</div>
  <div class="gap"></div>
  ${head('Your Listings', T_MINE().map((r) => sface(r.k, r.pos)), addBtn)}
  ${group(T_MINE().map(cell).join(''))}`;
}
function wanted() {
  const who = [
    `<span class="ptile ptile36" style="--pos: var(--color-pos-dm);"><img src="${img('rice')}" alt=""></span>`,
    sdisc('CB'),
    `<span class="ptile ptile36" style="--pos: var(--color-pos-st);"><img src="${img('kroupi')}" alt=""></span>`,
  ];
  return `
  ${head('Wanted From You', INBOX.map((r) => screst(r.by)))}
  ${group(INBOX.map((r, i) => askCell(r, i, who[i])).join(''))}`;
}
function board() {
  return `
  ${head('The Board', T_LISTED().map((r) => sface(r.k, r.pos)))}
  <div class="segWide">${seg([['Listed', 6], ['Wanted', 6]], 'Listed')}</div>
  <div class="chipsRow">${posChips()}</div>
  ${group(T_LISTED().map(cell).join(''))}`;
}

const sheet = () => `
<div class="scrim"></div>
<section class="sheet" role="dialog" aria-label="Saliba">
  <span class="grab" aria-hidden="true"></span>
  <div class="shHead">
    ${ptile('saliba', 'CB', 'ptile ptile56')}
    <span class="cTxt"><span class="namerow"><b class="shName">Saliba</b>${chip('CB', 'md')}</span><span class="cSub">${crest('PKNG', 14)}Pizzaking’s Club · For sale</span></span>
    <button class="iconBtn iconInk" aria-label="Close">${glyph('close', 18)}</button>
  </div>
  <div class="shYou">${crest('XABI', 14)}Your target · you told only Pizzaking’s Club</div>
  <div class="shStats">
    <div><span class="shK">Next Bid</span><b class="shV">€59m</b></div>
    <div><span class="shK">High Bid</span><b class="shV mono">€58m</b><span class="shSub">${crest('YANG', 12)}tottenyang FC</span></div>
    <div><span class="shK">Ends In</span><b class="shV mono isLive">2d 04h</b><span class="shSub">3 bids</span></div>
  </div>
  <div class="shActs"><button class="btn btnGo big">Bid €59m</button><button class="btn btnQuiet big">Make Offer</button></div>
</section>`;

function screen(view, { dark = false, withSheet = false } = {}) {
  const body = { yours, wanted, board }[view]();
  return `<div class="screen m phone${withSheet ? ' hasSheet' : ''}"${dark ? ' data-theme="dark"' : ''} style="width: ${W}px; height: __H__px;">
    ${topbar(true)}${subnav('Board')}
    ${views({ yours: 'Yours', wanted: 'Wanted From You', board: 'Board' }[view])}
    <main class="wrapM">${body}</main>
    ${withSheet ? sheet() : ''}
  </div>`;
}

const STYLE = ['targets.css', 'board.css'].map((f) => fs.readFileSync(path.join(HERE, f), 'utf8')).join('\n') + `
/* ══ Phone composition ══ */
.phone { position: relative; }
.phone .subIn { overflow: hidden; }
.views { position: sticky; top: 0; z-index: 2; padding: 10px 16px; background: color-mix(in oklab, var(--color-bg-primary) 88%, transparent); backdrop-filter: blur(14px); border-bottom: 1px solid var(--color-border-subtle); }
.viewsIn { display: flex; padding: 3px; border-radius: 11px; background: var(--color-bg-secondary); }
.vw { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; color: var(--color-text-secondary); font-family: var(--font-label); font-weight: 600; font-size: 15px; white-space: nowrap; }
.vwOn { background: var(--color-bg-card); color: var(--color-text-primary); box-shadow: var(--shadow-sm); }
.vwN { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-accent); color: var(--color-on-accent); font-family: var(--font-label); font-weight: 700; font-size: 11px; }
.vwOn .vwN { background: var(--color-text-primary); color: var(--color-bg-card); }

.wrapM { padding: 18px 16px 40px; }
.gap { height: 28px; }
.mh { display: flex; align-items: center; gap: 10px; min-height: 44px; margin-bottom: 12px; }
.mhT { font-family: var(--font-serif); font-weight: 700; font-size: 24px; line-height: 1; letter-spacing: -0.025em; white-space: nowrap; }
.mhTools { margin-left: auto; display: flex; align-items: center; }
.phone .hstack .sf { width: 30px; height: 30px; box-shadow: 0 0 0 2.5px var(--color-bg-primary); }
.phone .hstack .sf + .sf { margin-left: -9px; }
.phone .hstack .sf:nth-child(n+4) { display: none; }
.phone .sfCrest .crest { width: 20px; height: 24px; }
.addM { height: 36px; padding: 0 13px 0 10px; font-size: 15px; }

/* Your Targets: the auction card as the hero, the rest in a swipeable rail */
.phone .live { grid-template-columns: 108px minmax(0, 1fr); min-height: 0; }
.phone .livePlinth { grid-row: 1; min-height: 156px; }
.phone .liveBody { padding: 14px 14px 12px; gap: 5px; }
.phone .liveName { font-size: 30px; }
.phone .routeTxt, .phone .liveAud { display: none; }
.phone .liveBid { grid-column: 1 / -1; padding: 12px 14px 14px; gap: 10px; }
.phone .bidV { font-size: 24px; }
.phone .liveBid .btnGo { height: 44px; }
.phRail { display: flex; gap: 10px; margin: 12px -16px 0; padding: 0 16px; overflow: hidden; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; }
.phRail .tile { flex: 0 0 164px; scroll-snap-align: start; }
.phRail .tPlinth { height: 104px; }
.phRail .tCrop { width: 160px; }
.phRail .tName { font-size: 16px; }
.phRail .tAud { display: none; }
.phRail .tFoot { font-size: 11px; }
.phRail .tFootGo { display: none; }
.phRail .roleMark { font-size: 40px; }

/* Grouped list, cells as the tap targets */
.grp { border-radius: 14px; background: var(--color-bg-card); box-shadow: inset 0 0 0 1px var(--color-border); overflow: hidden; }
.cell { display: grid; grid-template-columns: 44px minmax(0, 1fr) 64px 14px; align-items: center; column-gap: 12px; min-height: 68px; padding: 10px 12px 10px 14px; color: inherit; }
.cell + .cell { box-shadow: inset 0 1px 0 var(--color-border-subtle); }
.cellMine { background: var(--color-green-50); }
[data-theme="dark"] .cellMine { background: rgba(31,163,95,.08); }
.cell .ptile { width: 44px; height: 44px; }
.ptile36 { width: 36px !important; height: 36px !important; border-radius: 9px; }
.ptile36 img { width: 56px; top: 3px; }
.ptile56 { width: 56px; height: 56px; border-radius: 12px; }
.ptile56 img { width: 86px; }
.cTxt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cName { font-family: var(--font-serif); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
.cHead { font-family: var(--font-serif); font-weight: 700; font-size: 17px; letter-spacing: -0.01em; white-space: nowrap; }
.cSub { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
.cSub .crest { width: 14px; height: 17px; }
.cTrail { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.cTrailFace { align-items: flex-end; }
.cFig { font-family: var(--font-serif); font-weight: 700; font-size: 17px; font-variant-numeric: tabular-nums; }
.cFig.none { font-weight: 400; color: var(--color-text-muted); }
.cKind { font-size: 11px; color: var(--color-text-muted); }
.cClock { font-family: var(--font-mono); font-weight: 700; font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; }
.cClock.isLive { color: var(--color-live); }
.cClock .liveDot { display: inline-block; width: 5px; height: 5px; margin-right: 4px; vertical-align: 1px; }
.chev { color: var(--color-text-muted); }
.cCrest { display: grid; place-items: center; width: 44px; }

.segWide { margin: -2px 0 10px; }
.segWide .seg { display: flex; margin: 0; }
.segWide .segB { flex: 1; height: 36px; }
.chipsRow { margin: 0 -16px 12px; padding: 0 16px; overflow: hidden; }
.chipsRow .pos { gap: 4px; }
.chipsRow .pch { flex-shrink: 0; height: 36px; padding: 0 10px; }

/* The action sheet */
.scrim { position: absolute; inset: 0; background: rgba(9, 12, 16, .42); z-index: 5; }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; display: flex; flex-direction: column; gap: 14px; padding: 8px 16px 34px; border-radius: 20px 20px 0 0; background: var(--color-bg-card); box-shadow: 0 -8px 30px rgba(0,0,0,.18); }
.grab { align-self: center; width: 40px; height: 5px; border-radius: 3px; background: var(--color-border); }
.shHead { display: grid; grid-template-columns: 56px minmax(0, 1fr) 36px; align-items: center; column-gap: 12px; }
.shName { font-family: var(--font-serif); font-weight: 700; font-size: 24px; letter-spacing: -0.02em; }
.shYou { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--color-accent-ink, var(--color-accent)); }
.shStats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-radius: 12px; box-shadow: inset 0 0 0 1px var(--color-border-subtle); }
.shStats > div { display: flex; flex-direction: column; gap: 3px; padding: 12px 10px; min-width: 0; }
.shStats > div + div { box-shadow: inset 1px 0 0 var(--color-border-subtle); }
.shK { font-family: var(--font-label); font-weight: 600; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-muted); }
.shV { font-family: var(--font-serif); font-weight: 700; font-size: 20px; }
.shV.mono { font-family: var(--font-mono); font-size: 16px; white-space: nowrap; }
.shV.isLive { color: var(--color-live); }
.shSub { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-muted); white-space: nowrap; }
.shActs { display: grid; gap: 8px; }
.btn.big { height: 50px; font-size: 17px; width: 100%; }
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
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

export const BOARDS = [
  { file: 'PhoneYours.dc.html', title: 'Phone · Yours', w: W, make: () => screen('yours') },
  { file: 'PhoneWanted.dc.html', title: 'Phone · Wanted From You', w: W, make: () => screen('wanted') },
  { file: 'PhoneBoard.dc.html', title: 'Phone · Board', w: W, make: () => screen('board') },
  { file: 'PhoneSheet.dc.html', title: 'Phone · Tap a Row', w: W, fixedH: 844, make: () => screen('board', { withSheet: true }) },
  { file: 'PhoneBoardDark.dc.html', title: 'Phone · Board · Dark', w: W, make: () => screen('board', { dark: true }) },
];

if (process.argv[1] && process.argv[1].endsWith('mobile.mjs')) {
  const hp = path.join(HERE, 'board-heights.json');
  const heights = fs.existsSync(hp) ? JSON.parse(fs.readFileSync(hp, 'utf8')) : {};
  for (const b of BOARDS) {
    const h = b.fixedH ?? heights[b.file] ?? 844;
    for (const mode of ['dc', 'preview']) {
      setMode(mode); resetCrests();
      const out = mode === 'dc' ? path.join(HERE, 'project', b.file) : path.join(HERE, 'preview', b.file.replace('.dc.html', '.html'));
      fs.writeFileSync(out, doc(b.make(), h, b.title, mode));
    }
  }
  console.log('built', BOARDS.length);
}
