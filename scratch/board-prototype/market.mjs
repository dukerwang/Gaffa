// Market, the home of Transfers, in the Board's language: option A headings,
// panels for lists, centred cells, left-aligned columns, one line per cell.
// node market.mjs -> project/Market.dc.html, MarketDark.dc.html, PhoneMarket.dc.html (+ preview)
import fs from 'node:fs';
import path from 'node:path';
import { LIGHT, DARK, setMode, img, resetCrests, crest, club, glyph, chip, badge } from './lib.mjs';
import { T_LISTED, topbar, subnav, ptile, sface, screst, seg } from './board.mjs';
import { chev, head as phHead, group, PHONE_CSS } from './mobile.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);

// A square tile holding a club crest, the same size as a portrait tile.
const crestTile = (c, cls = 'ptile') => `<span class="${cls} crestTile">${crest(c, 26)}</span>`;

// ── Your Move: open decisions only. One line per cell. ─────────────────────
const MOVES = () => [
  { v: ptile('zubimendi', 'DM'), sv: sface('zubimendi', 'DM'), what: 'You’ve been outbid on Zubimendi', short: 'Outbid on Zubimendi',
    detail: `${crest('COYS', 18)}Hayden FC bid €52m`, fig: '€53m', figK: 'Next bid', ends: '5h 12m', live: true, act: ['Bid', 'go'] },
  { v: ptile('saliba', 'CB'), sv: sface('saliba', 'CB'), what: 'Saliba is at auction', short: 'Saliba is at auction', mine: true,
    detail: `${crest('XABI', 18)}Your target · high bid €58m`, fig: '€59m', figK: 'Next bid', ends: '2d 04h', live: true, act: ['Bid', 'go'] },
  { v: ptile('palmer', 'AM'), sv: sface('palmer', 'AM'), what: 'Hayden FC made an offer for Palmer', short: 'Offer for Palmer',
    detail: `${crest('COYS', 18)}Mbeumo and €20m`, fig: '', figK: '', ends: '1d 22h', act: ['Reply', 'go'] },
  { v: crestTile('YANG'), sv: `<span class="sf sfCrest">${crest('YANG', 24)}</span>`, what: 'tottenyang FC want Rice', short: 'Approach for Rice',
    detail: 'Will pay cash · up to €95m', fig: '€95m', figK: 'Up to', ends: '', act: ['Offer', 'quiet'] },
  { v: ptile('havertz', 'ST'), sv: sface('havertz', 'ST'), what: 'ChelsZ FC bid €36m on Havertz', short: 'First bid on Havertz',
    detail: `${crest('ZFC', 18)}Your listing · 2 bids`, fig: '€36m', figK: 'High bid', ends: '1d 06h', live: true, act: ['View', 'quiet'] },
];

const LOTS = [
  { k: 'zubimendi', name: 'Zubimendi', pos: 'DM', bid: '€52m', by: 'COYS', clock: '5h 12m', soon: true },
  { k: 'havertz', name: 'Havertz', pos: 'ST', bid: '€36m', by: 'ZFC', clock: '1d 06h' },
  { k: 'saliba', name: 'Saliba', pos: 'CB', bid: '€58m', by: 'YANG', clock: '2d 04h' },
  { k: 'tonali', name: 'Tonali', pos: 'DM', bid: '€48m', by: null, clock: '2d 20h' },
];
const WANTED = [
  { k: 'haaland', name: 'Haaland', pos: 'ST', by: 'CHAI', fact: 'Will pay cash', fig: '€200m' },
  { k: 'caicedo', name: 'Caicedo', pos: 'DM', by: 'PKNG', fact: 'Will pay cash', fig: '€90m' },
  { k: 'wirtz', name: 'Wirtz', pos: 'AM', by: 'ZFC', fact: 'Offering players', fig: '' },
];
const WIRE = [
  ['ZFC', 'ChelsZ FC bid €36m on Havertz', '2h'],
  ['COYS', 'Hayden FC bid €52m on Zubimendi', '3h'],
  ['PKNG', 'Pizzaking’s Club listed Saliba', '2d'],
  ['CHAI', 'Tea FC listed Delap for loan', '2d'],
  ['YANG', 'tottenyang FC signed Roefs', '4d'],
  ['XABI', 'Not Too Xabi listed Ndiaye', '4d'],
  ['ZFC', 'ChelsZ FC signed Quenda', '5d'],
  ['COYS', 'Hayden FC loaned out Kostoulas', '6d'],
];

// ── Shared pieces ─────────────────────────────────────────────────────────
const sh = (title, items, tools = '') => `
<div class="sh">
  ${items.length ? `<span class="hstack">${items.slice(0, 5).join('')}${items.length > 5 ? `<span class="sf sfMore">+${items.length - 5}</span>` : ''}</span>` : ''}
  <h2 class="shT">${title}</h2>
  ${tools ? `<span class="shTools">${tools}</span>` : ''}
</div>`;
const mwTile = `<span class="mwTile"><span class="mwK">MW</span><span class="mwV">6</span></span>`;
const endsCell = (e, live) => `<span class="mEnds${live ? ' isLive' : ''}">${e ? `${live ? '<i class="liveDot"></i>' : ''}${e}` : ''}</span>`;

// Desktop Your Move: a table of decisions, no header row needed; columns still align.
const moveRow = (m) => `
<a class="mvRow${m.mine ? ' rwMine' : ''}">
  <span class="cFace">${m.v}</span>
  <span class="mvTxt"><b class="mvWhat">${m.what}</b><span class="mvDetail">${m.detail.replace(/width="18" height="22"/g, 'width="14" height="17"')}</span></span>
  <span class="mvFig">${m.fig ? `<b>${m.fig}</b><span class="pk">${m.figK}</span>` : ''}</span>
  ${endsCell(m.ends, m.live)}
  <span class="cAct"><button class="btn btnSm ${m.act[1] === 'go' ? 'btnGo' : 'btnQuiet'}">${m.act[0]}</button></span>
</a>`;

const lot = (l) => `
<a class="tile lotCard" style="--pos: var(--color-pos-${l.pos.toLowerCase()});">
  <span class="tPlinth"><img class="tCrop" src="${img(l.k)}" alt=""><span class="tPlate${l.soon ? ' plateSoon' : ''}">${l.clock}</span></span>
  <span class="tBody">
    <span class="namerow"><b class="tName">${l.name}</b>${chip(l.pos)}</span>
    <span class="tMeta">${l.by ? `${crest(l.by, 14)}<b class="lcBid">${l.bid}</b>${club(l.by)}` : `<b class="lcBid">${l.bid}</b>Floor, no bids`}</span>
  </span>
</a>`;

// Preview rows: portrait, name, crest + one fact, the figure.
const pvRow = (r) => `
<a class="pvR">
  ${ptile(r.k, r.pos, 'ptile ptile36')}
  <span class="cTxt"><span class="namerow"><b class="pvN">${r.name}</b>${chip(r.pos)}</span><span class="cSub">${r.byCrest}${r.fact}</span></span>
  <b class="pvF${r.fig ? '' : ' none'}">${r.fig || '–'}</b>
</a>`;
const listedPv = () => T_LISTED().slice(0, 3).map((r) => ({ k: r.k, name: r.name, pos: r.pos, byCrest: (r.who.match(/<svg[\s\S]*?<\/svg>/) || [''])[0], fact: r.terms.split(' · ')[0], fig: r.price }));
const wantedPv = () => WANTED.map((r) => ({ ...r, byCrest: crest(r.by, 14) }));

const wireRows = (n = WIRE.length) => WIRE.slice(0, n).map(([c, t, a]) => `<div class="wiR">${crest(c, 18)}<span class="wrT">${t}</span><span class="wrA">${a}</span></div>`).join('');

// ── Desktop ───────────────────────────────────────────────────────────────
function desktop(dark) {
  const moves = MOVES();
  return `<div class="screen d mkPage"${dark ? ' data-theme="dark"' : ''} style="width: 1440px; height: __H__px;">
  ${topbar(false)}${subnav('Market')}
  <main class="wrap mkGrid">
    <div class="mkMain">
      <section>${sh('Your Move', moves.map((m) => m.sv))}<div class="panel">${moves.map(moveRow).join('')}</div></section>
      <section class="blkGap">${sh('Closing Now', LOTS.map((l) => sface(l.k, l.pos)), '<a class="btn btnQuiet btnSm">Auction Room</a>')}<div class="lotRow">${LOTS.map(lot).join('')}</div></section>
      <section class="blkGap">${sh('On the Board', T_LISTED().map((r) => sface(r.k, r.pos)), '<a class="btn btnQuiet btnSm">Open Board</a>')}
        <div class="pvGrid2">
          <div class="panel"><div class="pvHead">Listed <b>6</b></div>${listedPv().map(pvRow).join('')}</div>
          <div class="panel"><div class="pvHead">Wanted <b>6</b></div>${wantedPv().map(pvRow).join('')}</div>
        </div>
      </section>
    </div>
    <aside class="mkRail">
      <section>${sh('Deadlines', [mwTile])}<div class="panel dlP"><span class="dlT"><b>Lineups lock</b><span>Sat 26 Sep · 12:30</span></span></div></section>
      <section class="railGap">${sh('The Wire', ['ZFC', 'COYS', 'PKNG'].map((c) => screst(c)))}<div class="panel">${wireRows()}</div></section>
    </aside>
  </main>
  </div>`;
}

// ── Phone ─────────────────────────────────────────────────────────────────
const moveCell = (m) => `
<a class="cell${m.mine ? ' cellMine' : ''}">
  ${m.v.replace('class="ptile crestTile"', 'class="ptile crestTile"')}
  <span class="cTxt"><b class="cHead">${m.short}</b><span class="cSub">${m.detail.replace(/width="18" height="22"/g, 'width="14" height="17"')}</span></span>
  <span class="cTrail">${m.fig ? `<b class="cFig">${m.fig}</b>` : ''}${m.ends ? `<span class="cClock${m.live ? ' isLive' : ''}">${m.live ? '<i class="liveDot"></i>' : ''}${m.ends}</span>` : m.figK ? `<span class="cKind">${m.figK}</span>` : ''}</span>
  ${chev}
</a>`;
const pvCell = (r) => `
<a class="cell">
  ${ptile(r.k, r.pos)}
  <span class="cTxt"><span class="namerow"><b class="cName">${r.name}</b>${chip(r.pos)}</span><span class="cSub">${r.byCrest}${r.fact}</span></span>
  <span class="cTrail"><b class="cFig${r.fig ? '' : ' none'}">${r.fig || '–'}</b></span>
  ${chev}
</a>`;

function phone() {
  const moves = MOVES();
  return `<div class="screen m phone mkPage" style="width: 390px; height: __H__px;">
  ${topbar(true)}${subnav('Market')}
  <main class="wrapM">
    ${phHead('Your Move', moves.map((m) => m.sv))}
    ${group(moves.map(moveCell).join(''))}
    <div class="gap"></div>
    ${phHead('Closing Now', LOTS.map((l) => sface(l.k, l.pos)))}
    <div class="phRail">${LOTS.map(lot).join('')}</div>
    <div class="gap"></div>
    ${phHead('On the Board', T_LISTED().map((r) => sface(r.k, r.pos)))}
    <div class="segWide">${seg([['Listed', 6], ['Wanted', 6]], 'Listed')}</div>
    ${group(listedPv().map(pvCell).join('') + `<a class="cell cellMore"><span class="moreT">Open Board</span>${chev}</a>`)}
    <div class="gap"></div>
    ${phHead('Deadlines', [mwTile])}
    <div class="grp dlP"><span class="dlT"><b>Lineups lock</b><span>Sat 26 Sep · 12:30</span></span></div>
    <div class="gap"></div>
    ${phHead('The Wire', ['ZFC', 'COYS', 'PKNG'].map((c) => screst(c)))}
    ${group(wireRows(5))}
  </main>
  </div>`;
}

const STYLE = ['targets.css', 'board.css'].map((f) => fs.readFileSync(path.join(HERE, f), 'utf8')).join('\n') + PHONE_CSS + `
/* ══ Market ══ */
.mkGrid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; column-gap: 40px; align-items: start; }
.mkRail .railGap { margin-top: 40px; }
.crestTile { display: grid; place-items: center; background: var(--color-bg-secondary) !important; }

/* Your Move rows: portrait · what happened · detail · figure · clock · one action.
   Every cell centred on the row, every column left-aligned, one line per cell. */
.mvRow { display: grid; grid-template-columns: 48px minmax(0, 1fr) 96px 84px 108px; column-gap: 18px; align-items: center; min-height: 72px; padding: 12px 20px; color: inherit; }
.mvRow + .mvRow { border-top: 1px solid var(--color-border-subtle); }
.mvWhat { font-family: var(--font-serif); font-weight: 600; font-size: 17px; letter-spacing: -0.01em; white-space: nowrap; }
.mvTxt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.mvDetail { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
.mvFig { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.mvFig b { font-family: var(--font-serif); font-weight: 700; font-size: 18px; font-variant-numeric: tabular-nums; }
.mEnds { font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--color-text-secondary); white-space: nowrap; }
.mEnds.isLive { color: var(--color-live); }
.mEnds .liveDot { display: inline-block; width: 6px; height: 6px; margin-right: 6px; vertical-align: 2px; }
.mvRow .cAct { margin-left: 0; }

/* Closing Now: individual lot cards */
.lotRow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.lotCard .tPlinth { height: 116px; }
.lotCard .tPlate { font-family: var(--font-mono); letter-spacing: 0; text-transform: none; font-size: 12px; }
.plateSoon { background: var(--color-live) !important; }
.lcBid { font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--color-text-primary); margin-right: 2px; }
.lotCard .tBody { gap: 5px; padding-bottom: 12px; }

/* On the Board preview */
.pvGrid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.pvHead { height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 16px; font-family: var(--font-label); font-weight: 600; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border-subtle); }
.pvHead b { font-family: var(--font-serif); font-size: 14px; letter-spacing: 0; color: var(--color-text-primary); }
.pvR { display: grid; grid-template-columns: 36px minmax(0, 1fr) 64px; column-gap: 12px; align-items: center; min-height: 60px; padding: 8px 16px; color: inherit; }
.pvR + .pvR { border-top: 1px solid var(--color-border-subtle); }
.pvN { font-family: var(--font-serif); font-weight: 700; font-size: 16px; }
.pvF { font-family: var(--font-serif); font-weight: 700; font-size: 17px; }
.pvF.none { font-weight: 400; color: var(--color-text-muted); }

/* Rail */
.dlP { display: flex; flex-direction: row; align-items: center; min-height: 52px; padding: 0 16px; }
.dlT { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); white-space: nowrap; }
.dlT b { font-size: 14px; color: var(--color-text-primary); }
.sh .mwTile { width: 38px; height: 38px; border-radius: 10px; }
.sh .mwV { font-size: 20px; }
.sh .mwK { font-size: 9px; }
.mwTile { display: grid; place-items: center; align-content: center; width: 46px; height: 46px; border-radius: 11px; background: var(--color-text-primary); flex-shrink: 0; }
.mwK { font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: .12em; color: color-mix(in oklab, var(--color-bg-card) 60%, var(--color-text-primary)); line-height: 1; }
.mwV { font-family: var(--font-serif); font-weight: 700; font-size: 24px; color: var(--color-bg-card); line-height: 1; margin-top: 1px; }
.wiR { display: grid; grid-template-columns: 18px minmax(0, 1fr) 24px; column-gap: 10px; align-items: center; min-height: 44px; padding: 0 14px; font-size: 13px; }
.wiR + .wiR { border-top: 1px solid var(--color-border-subtle); }
.wrT { white-space: nowrap; }
.wrA { font-size: 12px; color: var(--color-text-muted); }
.mkRail .sh { min-height: 44px; }
.mkRail .shT { font-size: 26px; }
.mkRail .hstack .sf { width: 32px; height: 32px; }

/* Phone */
.phone .crestTile { width: 44px; height: 44px; border-radius: 10px; }
.phone .dlP { padding: 12px 14px; }
.cellMore { grid-template-columns: minmax(0, 1fr) 14px; min-height: 52px; }
.moreT { font-family: var(--font-label); font-weight: 600; font-size: 15px; color: var(--color-accent-ink, var(--color-accent)); }
.phone .wiR { min-height: 48px; padding: 0 14px; }
.phone .lotCard { flex: 0 0 164px; }
.phone .lotCard .tPlinth { height: 104px; }
`;

const FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Hanken+Grotesk:wght@400;500;600;700&family=Sofia+Sans+Semi+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap';
function doc(inner, w, h, title, mode) {
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
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

export const BOARDS = [
  { file: 'Market.dc.html', title: 'Market', w: 1440, make: () => desktop(false) },
  { file: 'MarketDark.dc.html', title: 'Market · Dark', w: 1440, make: () => desktop(true) },
  { file: 'PhoneMarket.dc.html', title: 'Phone · Market', w: 390, make: () => phone() },
];

if (process.argv[1] && process.argv[1].endsWith('market.mjs')) {
  const hp = path.join(HERE, 'board-heights.json');
  const heights = fs.existsSync(hp) ? JSON.parse(fs.readFileSync(hp, 'utf8')) : {};
  for (const b of BOARDS) {
    const h = heights[b.file] ?? 1400;
    for (const mode of ['dc', 'preview']) {
      setMode(mode); resetCrests();
      const out = mode === 'dc' ? path.join(HERE, 'project', b.file) : path.join(HERE, 'preview', b.file.replace('.dc.html', '.html'));
      fs.writeFileSync(out, doc(b.make(), b.w, h, b.title, mode));
    }
  }
  console.log('built', BOARDS.length);
}
