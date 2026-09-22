// Board, composer and Market (Your Move) artboards for the Transfer Board spec.
// node board.mjs -> project/Board*.dc.html, Composer*.dc.html, Market*.dc.html (+ preview/*.html)
import fs from 'node:fs';
import path from 'node:path';
import { LIGHT, DARK, setMode, img, resetCrests, crest, club, G, glyph, chip, badge } from './lib.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);

Object.assign(G, {
  search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>',
  close: '<path d="M6 6l12 12M18 6L6 18"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  pitch: '<rect x="3" y="5" width="18" height="14" rx="1.5"></rect><path d="M12 5v14"></path><circle cx="12" cy="12" r="2.6"></circle>',
});

// Portrait in a circle. `tall` = only the 110x140 cut-out exists (different crop);
// `none` = no photo on either source, so the app shows initials.
const face = (k, p, cls = 'face', opt = {}) => {
  const style = `--pos: var(--color-pos-${p.toLowerCase()});`;
  if (opt.none) return `<span class="${cls} faceNone" style="${style}">${opt.none}</span>`;
  return `<span class="${cls}${opt.tall ? ' faceTall' : ''}" style="${style}"><img src="${img(k)}" alt=""></span>`;
};
const PHOTO = { delap: { tall: true }, ndiaye: { none: 'ND' } };
const fc = (k, p, cls) => face(k, p, cls, PHOTO[k] ?? {});

// ── Data: real Matchday Militia squads; every listing, target, bid and offer is illustrative ──
const MY_LISTINGS = () => [
  { k: 'havertz', name: 'Havertz', pos: 'ST', pl: 'arsenal', plName: 'Arsenal', mv: '€55m', terms: 'For sale',
    state: `<span class="mkState mkLiveTxt"><i class="liveDot"></i>At Auction</span><span class="mkFig"><b>€36m</b><span class="mkClock">1d 06h</span></span>`,
    note: `${crest('ZFC', 12)}ChelsZ FC lead · 2 bids`, act: '' },
  { k: 'ndiaye', name: 'Ndiaye', pos: 'LW', pl: 'man-city', plName: 'Man City', mv: '€55m', terms: 'Offers only · asking €45m',
    state: `<span class="mkState mkQuiet">No Bids</span>`,
    note: `${crest('COYS', 12)}Hayden FC want him`, act: '<button class="btn btnQuiet btnSm">Edit</button>' },
];

const LISTED = [
  { k: 'saliba', name: 'Saliba', pos: 'CB', pl: 'arsenal', plName: 'Arsenal', mv: '€100m', by: 'PKNG', terms: 'For sale', price: '€58m', priceKind: 'bid',
    market: { live: true, clock: '2d 04h' }, you: 'Your target', acts: ['Offer', 'Bid €59m'] },
  { k: 'hall', name: 'Hall', pos: 'LWB', pl: 'newcastle', plName: 'Newcastle', mv: '€40m', by: 'ZFC', terms: 'Offers only · asking €30m', price: '€30m', priceKind: 'ask',
    market: null, you: 'Fits your LB target', acts: ['Offer', null] },
  { k: 'tonali', name: 'Tonali', pos: 'DM', pl: 'spurs', plName: 'Spurs', mv: '€80m', by: 'PKNG', terms: 'For sale · €60m', price: '€48m', priceKind: 'floor',
    market: { live: false, clock: '2d 20h' }, acts: ['Offer', 'Bid €48m'] },
  { k: 'vandeven', name: 'Van de Ven', pos: 'CB', pl: 'spurs', plName: 'Spurs', mv: '€50m', by: 'COYS', terms: 'Release clause only · €70m', price: '€70m', priceKind: 'clause',
    market: null, acts: [null, 'Pay €70m'] },
  { k: 'kudus', name: 'Kudus', pos: 'RW', pl: 'spurs', plName: 'Spurs', mv: '€50m', by: 'YANG', terms: 'Wants players', price: null,
    market: null, acts: ['Offer', null] },
  { k: 'delap', name: 'Delap', pos: 'ST', pl: 'nottingham-forest', plName: "Nott'm Forest", mv: '€28m', by: 'CHAI', terms: 'Would loan him out', price: null,
    market: null, acts: ['Offer', null] },
];
const WANTED_POS = ['ST', 'AM', 'DM', 'CB', 'RW', 'CB'];
const SPINE = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const listedN = Object.fromEntries(SPINE.map((p) => [p, LISTED.filter((l) => l.pos === p).length]));
const wantedN = Object.fromEntries(SPINE.map((p) => [p, WANTED_POS.filter((q) => q === p).length]));

const MINE = [
  { k: 'haaland', name: 'Haaland', pos: 'ST', pl: 'man-city', plName: 'Man City', mv: '€220m', aud: ['eyeOff', 'Only you'], state: 'Not Listed', rival: ['CHAI', 'Tea FC want him too'] },
  { k: 'wirtz', name: 'Wirtz', pos: 'AM', pl: 'liverpool', plName: 'Liverpool', mv: '€100m', aud: ['eye', 'The league'], state: 'Not Listed', rival: ['ZFC', 'ChelsZ FC want him too'] },
];
const INBOX = [
  { by: 'YANG', head: 'tottenyang FC want Rice', terms: ['Will pay cash', '€95m'],
    who: () => `${fc('rice', 'DM', 'face face-36')}<span class="whoTxt"><span class="namerow"><b class="whoName">Rice</b>${chip('DM')}</span><span class="whoMeta">${glyph('eyeOff', 13)}Only you can see this</span></span>`,
    acts: ['List', 'Offer'] },
  { by: 'ZFC', head: 'ChelsZ FC want a starting centre-back', terms: ['Will pay cash', '€35m'],
    who: () => `<span class="posDisc" style="--pos: var(--color-pos-cb); --pi: var(--color-pos-cb-on);">CB</span><span class="whoTxt"><b class="whoName">You have 5</b><span class="whoMeta">Gvardiol, Colwill +3</span></span><span class="stack">${['gvardiol', 'colwill', 'jacquet', 'khusanov', 'canvot'].map((k) => fc(k, 'CB', 'face face-28')).join('')}</span>`,
    acts: ['Message', 'Offer'] },
  { by: 'CHAI', head: 'Tea FC want a striker prospect', terms: ['Offering players'],
    who: () => `${fc('kroupi', 'ST', 'face face-36')}<span class="whoTxt"><span class="namerow"><b class="whoName">Kroupi.Jr</b>${chip('ST')}</span><span class="whoMeta">20 · Academy</span></span>`,
    acts: ['Message', 'Offer'] },
];

// ── Chrome ────────────────────────────────────────────────────────────────
const topbar = (mobile) => mobile
  ? `<header class="top"><span class="topL">${crest('XABI', 22)}<span class="word">Gaffa</span></span><span class="topR"><span class="bal">€204m</span><button class="iconBtn" aria-label="Notifications">${glyph('bell', 18)}</button><button class="iconBtn" aria-label="Menu">${glyph('menu', 20)}</button></span></header>`
  : `<header class="top"><span class="topL"><span class="word">Gaffa</span><span class="league">Matchday Militia</span></span>
      <nav class="topNav" aria-label="League"><a class="tl">Home</a><a class="tl">Squad${glyph('chev', 12)}</a><a class="tl on">Transfers</a><a class="tl">League${glyph('chev', 12)}</a><a class="tl">Fixtures${glyph('chev', 12)}</a></nav>
      <span class="topR"><span class="bal">€204m</span><button class="iconBtn" aria-label="Notifications">${glyph('bell', 18)}</button>${crest('XABI', 24)}</span></header>`;

// The section tabs double as the page's toolbar: the page action sits at their right.
const subnav = (active, action = '') => `<nav class="sub" aria-label="Transfer market sections"><div class="subIn">
  ${[['Market', null], ['Auctions', 4], ['Board', 12], ['Free Agency', 14], ['Deals', 2]].map(([n, c]) => `<a class="si${n === active ? ' on' : ''}">${n}${c != null ? ` <span class="sc">${c}</span>` : ''}</a>`).join('')}
  ${action ? `<span class="subAct">${action}</span>` : ''}</div></nav>`;

const pips = (n, of) => `<span class="cap"><span class="pips" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span><span class="capN">${n} of ${of}</span></span>`;

// ── Your Targets (from Targets C) ─────────────────────────────────────────
const liveCard = () => `
<article class="live" style="--pos: var(--color-pos-cb);">
  <div class="livePlinth"><img class="crop" src="${img('saliba')}" alt=""></div>
  <div class="liveBody">
    <span class="liveTag"><i class="liveDot"></i>At Auction</span>
    <div class="namerow"><h3 class="liveName">Saliba</h3>${chip('CB', 'md')}</div>
    <div class="liveMeta">${badge('arsenal')}Arsenal · €100m</div>
    <div class="route">${crest('PKNG', 22)}<span class="routeArrow">${glyph('arrow', 14)}</span>${crest('XABI', 22)}<span class="routeTxt">Pizzaking’s Club listed him</span></div>
    <div class="liveAud">${glyph('eye', 13)}Only Pizzaking’s Club</div>
  </div>
  <div class="liveBid">
    <div class="bidRow">
      <div><span class="bl">High Bid</span><span class="bidV">€58m</span><span class="bidWho">${crest('YANG', 14)}tottenyang FC</span></div>
      <div class="bidClock"><span class="bl">Ends In</span><span class="clockV">2d 04h</span><span class="bidWho">3 bids</span></div>
    </div>
    <button class="btn btnGo btnBlock">Bid €59m</button>
    <a class="liveLink">View Auction</a>
  </div>
</article>`;
const tile = (t) => `
<a class="tile" style="--pos: var(--color-pos-${t.pos.toLowerCase()});">
  <span class="tPlinth"><img class="tCrop" src="${img(t.k)}" alt=""><span class="tPlate">${t.state}</span></span>
  <span class="tBody">
    <span class="namerow"><b class="tName">${t.name}</b>${chip(t.pos)}</span>
    <span class="tMeta">${badge(t.pl)}${t.plName} · ${t.mv}</span>
    <span class="tAud">${glyph(t.aud[0], 13)}${t.aud[1]}</span>
    <span class="tFoot">${crest(t.rival[0], 14)}${t.rival[1]}</span>
  </span>
</a>`;
const roleTile = () => `
<a class="tile" style="--pos: var(--color-pos-lb);">
  <span class="tPlinth tRole"><span class="roleMark">LB</span><span class="tPlate tPlateHot">1 Match</span></span>
  <span class="tBody">
    <b class="tName">Starting Left-Back</b>
    <span class="tMeta">Will pay cash · up to <b class="cash">€40m</b></span>
    <span class="tAud">${glyph('eye', 13)}The league</span>
    <span class="tFoot">${fc('hall', 'LWB', 'face face-18')}ChelsZ FC listed Hall<span class="tFootGo">View</span></span>
  </span>
</a>`;

const inbox = () => `
<div class="inbox">
${INBOX.map((r) => `
  <div class="ib">
    <span class="ibCrest">${crest(r.by, 28)}</span>
    <div class="ibBody">
      <p class="ibHead">${r.head}</p>
      <p class="ibTerms">${r.terms[0]}${r.terms[1] ? ` · up to <b class="cash">${r.terms[1]}</b>` : ''}</p>
      <div class="who">${r.who()}</div>
      <div class="acts"><button class="btn btnQuiet">${r.acts[0]}</button><button class="btn btnGo">${r.acts[1]}</button></div>
    </div>
  </div>`).join('')}
</div>`;

// ── Your Listings ─────────────────────────────────────────────────────────
const myListings = () => `
<div class="mine">
${MY_LISTINGS().map((l) => `
  <div class="ml">
    ${fc(l.k, l.pos, 'face face-44')}
    <span class="mlTxt"><span class="namerow"><b class="mlName">${l.name}</b>${chip(l.pos)}</span><span class="mlMeta"><span class="mlClub">${badge(l.pl)}${l.plName} · ${l.mv}<span class="dot">·</span></span>${l.terms}</span></span>
    <span class="mlState"><span class="mk">${l.state}</span><span class="mlNote">${l.note}</span></span>
    <span class="mlAct">${l.act || '<button class="btn btnQuiet btnSm">View</button>'}</span>
  </div>`).join('')}
</div>`;

// ── Supply and demand by position: listed rises, wanted falls ─────────────
const UNIT = 9;
const chart = (mobile) => `
<div class="sd" role="group" aria-label="Listed and wanted players by position, select a position to filter">
  ${mobile ? '' : `<span class="sdKey"><span>Listed</span><span>Wanted</span></span>`}
  <div class="sdCols">
  ${SPINE.map((p) => {
    const a = listedN[p], b = wantedN[p];
    return `<button class="sdCol${a + b ? '' : ' sd0'}${p === 'CB' ? ' sdOn' : ''}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on);" title="${p}: ${a} listed, ${b} wanted">
      <span class="sdUp">${a ? `<i style="height: ${a * UNIT}px;"></i>` : ''}</span>
      <span class="sdTag">${p}</span>
      <span class="sdDown">${b ? `<i style="height: ${b * UNIT}px;"></i>` : ''}</span>
    </button>`;
  }).join('')}
  </div>
</div>`;

const seg = (opts, on) => `<span class="seg" role="tablist">${opts.map(([label, n]) => `<button class="segB${label === on ? ' segOn' : ''}" role="tab">${label}${n != null ? ` <span class="segN">${n}</span>` : ''}</button>`).join('')}</span>`;

const priceCell = (l) => {
  if (!l.price) return '<span class="lPrice none">–</span>';
  const k = { bid: 'High Bid', ask: 'Asking', floor: 'Floor', clause: 'Clause' }[l.priceKind];
  return `<span class="lPrice"><span class="lPriceV${l.priceKind === 'bid' ? ' mono' : ''}">${l.price}</span><span class="lPriceK">${k}</span></span>`;
};
const marketCell = (l) => l.market
  ? `<span class="mk"><span class="mkState ${l.market.live ? 'mkLiveTxt' : 'mkQuiet'}">${l.market.live ? '<i class="liveDot"></i>At Auction' : 'No Bids'}</span><span class="mkFig"><span class="mkClock">${l.market.clock}</span></span></span>`
  : '<span class="mk"></span>';

const listedDesktop = () => `
<div class="board boardL">
  <div class="bhL"><span>Player</span><span>Listed By</span><span>Terms</span><span class="r">Price</span><span class="r">Auction</span><span></span></div>
  ${LISTED.map((l) => `
  <div class="brL">
    <span class="brPlayer">${fc(l.k, l.pos, 'face face-40')}<span class="brTxt"><span class="namerow"><b class="brName">${l.name}</b>${chip(l.pos)}</span><span class="brMeta">${l.you ? `<span class="youLine">${crest('XABI', 12)}${l.you}</span>` : `${badge(l.pl)}${l.plName} · ${l.mv}`}</span></span></span>
    <span class="brClub">${crest(l.by, 24)}<span>${club(l.by)}</span></span>
    <span class="brTerms">${l.terms}</span>
    ${priceCell(l)}
    ${marketCell(l)}
    <span class="rowActs">${l.acts[0] ? `<button class="btn btnQuiet btnSm">${l.acts[0]}</button>` : '<span></span>'}${l.acts[1] ? `<button class="btn btnGo btnSm">${l.acts[1]}</button>` : '<span></span>'}</span>
  </div>`).join('')}
</div>`;

const listedMobile = () => `
<div class="board boardL">
  ${LISTED.map((l) => `
  <div class="brM">
    ${fc(l.k, l.pos, 'face face-44')}
    <span class="brTxt">
      <span class="brBy">${crest(l.by, 14)}<span>${club(l.by)}</span></span>
      <span class="namerow"><b class="brName">${l.name}</b>${chip(l.pos)}</span>
      <span class="brMeta">${l.terms}</span>
      ${l.you ? `<span class="youLine">${crest('XABI', 12)}${l.you}</span>` : ''}
    </span>
    <span class="brSide">${l.price ? `<span class="lPriceV${l.priceKind === 'bid' ? ' mono' : ''}">${l.price}</span>` : '<span class="lPriceV none">–</span>'}${l.market ? `<span class="mkClock">${l.market.clock}</span>` : ''}</span>
    <span class="rowActs rowActsM">${l.acts[0] ? `<button class="btn btnQuiet btnSm">${l.acts[0]}</button>` : '<span></span>'}${l.acts[1] ? `<button class="btn btnGo btnSm">${l.acts[1]}</button>` : '<span></span>'}</span>
  </div>`).join('')}
</div>`;

const postBtn = `<button class="btn btnGo btnPost">${glyph('plus', 14)}Post</button>`;

// ── Option 1: every section is one panel, its heading in the panel's own top bar ──
const panel = (title, tools, body, cls = '') => `
<section class="panel ${cls}">
  <header class="bar"><h2 class="barT">${title}</h2>${tools ? `<span class="barTools">${tools}</span>` : ''}</header>
  ${body}
</section>`;

// One row grammar for your listings and the board. Line 1 carries the facts,
// line 2 the qualifiers: the player's club under his name, the price's kind under the price.
const T_MINE = () => [
  { k: 'havertz', name: 'Havertz', pos: 'ST', meta: `${badge('arsenal')}Arsenal · €55m`,
    who: `${crest('ZFC', 20)}ChelsZ FC lead`, whoSub: '2 bids', terms: 'For sale',
    price: '€36m', priceK: 'High bid', ends: '1d 06h', live: true, act: ['View', 'quiet'] },
  { k: 'ndiaye', name: 'Ndiaye', pos: 'LW', meta: `${badge('man-city')}Man City · €55m`,
    who: `${crest('COYS', 20)}Hayden FC want him`, terms: 'Offers only',
    price: '€45m', priceK: 'Asking', ends: '', act: ['Edit', 'quiet'] },
];
const T_LISTED = () => [
  { k: 'saliba', name: 'Saliba', pos: 'CB', mine: true, meta: `<span class="you">${crest('XABI', 12)}Your target</span>`,
    who: `${crest('PKNG', 20)}Pizzaking’s Club`, terms: 'For sale', price: '€59m', priceK: 'Next bid', ends: '2d 04h', live: true, act: ['Bid', 'go'] },
  { k: 'hall', name: 'Hall', pos: 'LWB', mine: true, meta: `<span class="you">${crest('XABI', 12)}Fits your LB target</span>`,
    who: `${crest('ZFC', 20)}ChelsZ FC`, terms: 'Offers only', price: '€30m', priceK: 'Asking', ends: '', act: ['Offer', 'quiet'] },
  { k: 'tonali', name: 'Tonali', pos: 'DM', meta: `${badge('spurs')}Spurs · €80m`,
    who: `${crest('PKNG', 20)}Pizzaking’s Club`, terms: 'For sale · asking €60m', price: '€48m', priceK: 'Floor', ends: '2d 20h', act: ['Bid', 'go'] },
  { k: 'vandeven', name: 'Van de Ven', pos: 'CB', meta: `${badge('spurs')}Spurs · €50m`,
    who: `${crest('COYS', 20)}Hayden FC`, terms: 'Release clause only', price: '€70m', priceK: 'Clause', ends: '', act: ['Pay Clause', 'go'] },
  { k: 'kudus', name: 'Kudus', pos: 'RW', meta: `${badge('spurs')}Spurs · €50m`,
    who: `${crest('YANG', 20)}tottenyang FC`, terms: 'Wants players', price: '', priceK: '', ends: '', act: ['Offer', 'quiet'] },
  { k: 'delap', name: 'Delap', pos: 'ST', meta: `${badge('nottingham-forest')}Nott'm Forest · €28m`,
    who: `${crest('CHAI', 20)}Tea FC`, terms: 'Would loan him out', price: '', priceK: '', ends: '', act: ['Offer', 'quiet'] },
];

// Square portrait on the player's position colour (option A), as on the target tiles.
const ptile = (k, p, cls = 'ptile') => {
  const st = `--pos: var(--color-pos-${p.toLowerCase()});`;
  if (PHOTO[k]?.none) return `<span class="${cls} faceNone" style="${st}">${PHOTO[k].none}</span>`;
  return `<span class="${cls}" style="${st}"><img class="${PHOTO[k]?.tall ? 'ptTall' : ''}" src="${img(k)}" alt=""></span>`;
};
const tHead = (who) => `<div class="rh"><span class="hPlayer">Player</span><span>${who}</span><span>Terms</span><span>Price</span><span>Ends</span><span></span></div>`;
const tRow = (r) => `
<a class="rw${r.mine ? ' rwMine' : ''}">
  <span class="cFace">${ptile(r.k, r.pos)}</span>
  <span class="pTxt"><span class="namerow"><b class="pName">${r.name}</b>${chip(r.pos)}</span><span class="pMeta">${r.meta}</span></span>
  <span class="cWho"><span class="whoLine">${r.who}</span>${r.whoSub ? `<span class="whoSub">${r.whoSub}</span>` : ''}</span>
  <span class="cTerms">${r.terms}</span>
  <span class="cPrice">${r.price ? `<b>${r.price}</b><span class="pk">${r.priceK}</span>` : '<b class="none">–</b>'}</span>
  <span class="cEnds${r.live ? ' endsLive' : ''}">${r.ends ? `${r.live ? '<i class="liveDot"></i>' : ''}${r.ends}` : ''}</span>
  <span class="cAct"><button class="btn btnSm ${r.act[1] === 'go' ? 'btnGo' : 'btnQuiet'}">${r.act[0]}</button></span>
</a>`;
// Mobile: the same facts in a stacked row.
const tRowM = (r) => `
<a class="rwM${r.mine ? ' rwMine' : ''}">
  ${ptile(r.k, r.pos)}
  <span class="pTxt"><span class="namerow"><b class="pName">${r.name}</b>${chip(r.pos)}</span><span class="pMeta">${r.meta}</span></span>
  <span class="mSide">${r.price ? `<b class="mPrice">${r.price}</b><span class="pk">${r.priceK}</span>` : '<b class="mPrice none">–</b>'}${r.ends ? `<span class="cEnds${r.live ? ' endsLive' : ''}">${r.live ? '<i class="liveDot"></i>' : ''}${r.ends}</span>` : ''}</span>
  <span class="mWho">${r.who}<span class="dot">·</span>${r.terms.split(' · ')[0]}</span>
  <span class="mAct"><button class="btn btnSm ${r.act[1] === 'go' ? 'btnGo' : 'btnQuiet'}">${r.act[0]}</button></span>
</a>`;

const COUNT = { CB: 2, LWB: 1, DM: 1, RW: 1, ST: 1 };
const posChips = () => `<span class="pos">${SPINE.map((p) => {
  const n = COUNT[p] ?? 0;
  return `<button class="pch${n ? '' : ' pch0'}${p === 'CB' ? ' pchOn' : ''}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on);">${p}${n ? `<span class="pchN">${n}</span>` : ''}</button>`;
}).join('')}</span>`;

const ibRows = () => INBOX.map((r) => `
  <div class="ib">
    <span class="ibCrest">${crest(r.by, 28)}</span>
    <div class="ibBody">
      <p class="ibHead">${r.head}</p>
      <p class="ibTerms">${r.terms[0]}${r.terms[1] ? ` · up to <b class="cash">${r.terms[1]}</b>` : ''}</p>
      <div class="who">${r.who()}</div>
      <div class="acts"><button class="btn btnQuiet">${r.acts[0]}</button><button class="btn btnGo">${r.acts[1]}</button></div>
    </div>
  </div>`).join('');

const targetsBody = () => `
  <div class="tgtLive">${liveCard()}</div>
  <div class="tgtRow">${MINE.map(tile).join('')}${roleTile()}</div>`;

// Option A heading: stands on the cream, leads with a stack of what the section is about.
const sface = (k, p) => PHOTO[k]?.none
  ? `<span class="sf faceNone" style="--pos: var(--color-pos-${p.toLowerCase()});">${PHOTO[k].none}</span>`
  : `<span class="sf${PHOTO[k]?.tall ? ' faceTall' : ''}" style="--pos: var(--color-pos-${p.toLowerCase()});"><img src="${img(k)}" alt=""></span>`;
const sdisc = (p) => `<span class="sf sfPos" style="--pos: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on);">${p}</span>`;
const screst = (c) => `<span class="sf sfCrest">${crest(c, 24)}</span>`;
const sh = (title, items, tools = '') => `
<div class="sh">
  <span class="hstack">${items.slice(0, 5).join('')}${items.length > 5 ? `<span class="sf sfMore">+${items.length - 5}</span>` : ''}</span>
  <h2 class="shT">${title}</h2>
  ${tools ? `<span class="shTools">${tools}</span>` : ''}
</div>`;
const tgtStack = () => [sface('saliba', 'CB'), sface('haaland', 'ST'), sface('wirtz', 'AM'), sdisc('LB')];
const listStack = () => T_MINE().map((r) => sface(r.k, r.pos));
const boardStack = () => T_LISTED().map((r) => sface(r.k, r.pos));
const askStack = () => INBOX.map((r) => screst(r.by));

const addBtn = `<button class="btn btnGo btnSm btnAddS">${glyph('plus', 14)}Add</button>`;

const targetsCards = (mobile) => `
<section class="tgtSec">
  ${sh('Your Targets', tgtStack(), `${mobile ? '' : pips(4, 10)}${addBtn}`)}
  ${mobile ? `<div class="sInst">${pips(4, 10)}</div>` : ''}
  ${liveCard()}
  <div class="tiles">${MINE.map(tile).join('')}${roleTile()}</div>
</section>`;

const block = (head, body, cls = '') => `<section class="blk ${cls}">${head}<div class="panel">${body}</div></section>`;

function boardPage({ mobile, dark, w }) {
  const body = mobile ? `
  ${topbar(true)}${subnav('Board')}
  <main class="wrap">
    ${targetsCards(true)}
    ${block(sh('Your Listings', listStack(), addBtn), T_MINE().map(tRowM).join(''), 'blkGap')}
    ${block(sh('Wanted From You', askStack()), ibRows(), 'blkGap')}
    <section class="blk blkGap">${sh('The Board', boardStack())}<div class="segRow">${seg([['Listed', 6], ['Wanted', 6]], 'Listed')}</div><div class="panel"><div class="posRow">${posChips()}</div>${T_LISTED().map(tRowM).join('')}</div></section>
  </main>` : `
  ${topbar(false)}${subnav('Board')}
  <main class="wrap">
    <div class="topGrid">
      ${targetsCards(false)}
      ${block(sh('Wanted From You', askStack()), ibRows())}
    </div>
    ${block(sh('Your Listings', listStack(), addBtn), tHead('Interest') + T_MINE().map(tRow).join(''), 'blkGap')}
    ${block(sh('The Board', boardStack(), `${seg([['Listed', 6], ['Wanted', 6]], 'Listed')}${posChips()}`), tHead('Listed By') + T_LISTED().map(tRow).join(''), 'blkGap')}
  </main>`;
  return screen(mobile, dark, w, body);
}

// ── Composer ──────────────────────────────────────────────────────────────
const field = (label, inner, cls = '') => `<div class="fld ${cls}"><span class="fldL">${label}</span>${inner}</div>`;
const chips = (on) => `<span class="chips">${['Cash', 'Players', 'Loan'].map((c) => `<button class="chipB${on.includes(c) ? ' chipOn' : ''}">${on.includes(c) ? glyph('check', 12) : ''}${c}</button>`).join('')}</span>`;
const money = (v, ph) => v
  ? `<span class="inp"><span class="inpPre">€</span><span class="inpV">${v}</span><span class="inpSuf">m</span></span>`
  : `<span class="inp inpEmpty"><span class="inpV">${ph}</span></span>`;
const plate = (k, name, pos, pl, plName, mv, owner) => `
<div class="plate" style="--pos: var(--color-pos-${pos.toLowerCase()});">
  <span class="plateFace"><img class="crop" src="${img(k)}" alt=""></span>
  <span class="plateTxt"><span class="namerow"><b class="plateName">${name}</b>${chip(pos, 'md')}</span><span class="plateMeta">${badge(pl)}${plName} · ${mv}${owner ? `<span class="dot">·</span>${crest(owner, 13)}${club(owner)}` : ''}</span></span>
</div>`;

function dialog(title, body, foot, { sheet = false } = {}) {
  return `<section class="dlg${sheet ? ' dlgSheet' : ''}" role="dialog" aria-label="${title}">
    ${sheet ? '<span class="grab" aria-hidden="true"></span>' : ''}
    <header class="dlgHead"><h2 class="dlgT">${title}</h2><button class="iconBtn iconInk" aria-label="Close">${glyph('close', 18)}</button></header>
    <div class="dlgBody">${body}</div>
    <footer class="dlgFoot">${foot}</footer>
  </section>`;
}

const resultRow = (k, name, pos, pl, plName, mv, right, extra = '') => `
<button class="res${extra}">${fc(k, pos, 'face face-36')}<span class="resTxt"><span class="namerow"><b class="resName">${name}</b>${chip(pos)}</span><span class="resMeta">${badge(pl)}${plName} · ${mv}</span></span><span class="resRight">${right}</span></button>`;

const composerWho = () => dialog('Add', `
  <div class="searchBox">${glyph('search', 18)}<span class="searchV">Ma</span><span class="caret"></span></div>
  <div class="resGroup"><span class="resG">Your Squad</span>
    ${resultRow('manzambi', 'Manzambi', 'CM', 'aston-villa', 'Aston Villa', '€65m', '<span class="resTag">List</span>', ' resOn')}
  </div>
  <div class="resGroup"><span class="resG">Other Clubs</span>
    ${resultRow('macallister', 'Mac Allister', 'CM', 'liverpool', 'Liverpool', '€70m', `${crest('COYS', 14)}Hayden FC`)}
    ${resultRow('mainoo', 'Mainoo', 'DM', 'man-utd', 'Man Utd', '€70m', `${crest('CHAI', 14)}Tea FC`)}
  </div>
  <div class="resGroup"><span class="resG">Free Agents</span>
    ${resultRow('madueke', 'Madueke', 'RW', 'arsenal', 'Arsenal', '€50m', '<span class="resTag resFA">Free Agent</span>')}
    ${resultRow('lisandro', 'Martinez', 'CB', 'man-utd', 'Man Utd', '€45m', '<span class="resTag resFA">Free Agent</span>')}
  </div>
  <button class="posLink">${glyph('pitch', 16)}A Position Instead</button>`,
  `<span class="keys">↑↓ to move · Enter to choose · Esc to close</span>`);

const previewListed = () => `
<div class="pv"><span class="pvL">Preview</span>
  <div class="pvRow">
    ${fc('rice', 'DM', 'face face-36')}
    <span class="brTxt"><span class="namerow"><b class="brName">Rice</b>${chip('DM')}</span><span class="brMeta">${crest('XABI', 12)}Not Too Xabi · For sale · €110m</span></span>
    <span class="lPrice"><span class="lPriceV">€72m</span><span class="lPriceK">Floor</span></span>
  </div>
</div>`;

const composerListing = (sheet) => dialog('List Rice', `
  ${plate('rice', 'Rice', 'DM', 'arsenal', 'Arsenal', '€120m')}
  <div class="demand">${crest('YANG', 16)}<span><b>tottenyang FC</b> want him · up to <b class="cash">€95m</b></span></div>
  ${field('What You Want', chips(['Cash']))}
  <div class="fldRow">
    ${field('Auction Floor', `${money('72')}<span class="fldHint">Minimum €72m, 60% of value</span>`)}
    ${field('Asking Price', money('110'))}
  </div>
  <div class="fldRow">
    ${field('Release Clause', money(null, 'Optional'))}
    ${field('', `<label class="tog"><span class="togBox"></span>No Auction, Offers Only</label>`, 'fldTog')}
  </div>
  ${previewListed()}`,
  `<button class="btn btnQuiet">Cancel</button><button class="btn btnGo">List Rice</button>`, { sheet });

const vis = (opts, on, note) => `<span class="vis">${opts.map((o) => `<button class="visB${o === on ? ' visOn' : ''}">${o}</button>`).join('')}</span><span class="visNote">${note}</span>`;

const composerNamed = () => dialog('Add Target', `
  ${plate('haaland', 'Haaland', 'ST', 'man-city', 'Man City', '€220m', 'YANG')}
  <div class="demand">${crest('CHAI', 16)}<span><b>Tea FC</b> want him too · up to <b class="cash">€200m</b></span></div>
  ${field('Who’s Told', vis(['Only You', 'Only tottenyang FC', 'The League'], 'Only You', 'Nobody is told. You hear the moment he’s listed.'))}
  ${field('What You’d Give', chips(['Cash', 'Players']))}
  <div class="fldRow">
    ${field('Budget', money('180'))}
    ${field('Note', '<span class="inp inpEmpty inpText"><span class="inpV">Optional, 140 characters</span></span>')}
  </div>
  <div class="pv"><span class="pvL">Preview</span>
    <div class="pvRow">${fc('haaland', 'ST', 'face face-36')}<span class="brTxt"><span class="namerow"><b class="brName">Haaland</b>${chip('ST')}</span><span class="brMeta">${glyph('eyeOff', 12)}Only you · Open to approaches · up to €180m</span></span><span class="mk"><span class="mkState mkQuiet">Not Listed</span></span></div>
  </div>`,
  `<button class="btn btnQuiet">Cancel</button><button class="btn btnGo">Add Target</button>`);

const composerRole = () => dialog('Add Target', `
  <div class="posPick">${SPINE.map((p) => `<button class="pp${p === 'LB' ? ' ppOn' : ''}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on);">${p}</button>`).join('')}</div>
  ${field('Role', `<span class="vis">${['Star', 'Starter', 'Bench', 'Prospect'].map((r) => `<button class="visB${r === 'Starter' ? ' visOn' : ''}">${r}</button>`).join('')}</span>`)}
  ${field('Who’s Told', vis(['The League', 'Only You'], 'The League', 'Every club sees it on the Wanted board.'))}
  ${field('What You’d Give', chips(['Cash']))}
  <div class="fldRow">
    ${field('Budget', money('40'))}
    ${field('Note', '<span class="inp inpEmpty inpText"><span class="inpV">Optional, 140 characters</span></span>')}
  </div>
  <div class="demand demandFit">${fc('hall', 'LWB', 'face face-18')}<span><b>Hall</b> plays LB · ChelsZ FC listed him</span><a class="quietLink">View</a></div>
  <div class="pv"><span class="pvL">Preview</span>
    <div class="pvRow">${crest('XABI', 26)}<span class="brTxt"><span class="namerow"><b class="brName">Starting Left-Back</b>${chip('LB')}</span><span class="brMeta">Not Too Xabi · Will pay cash · up to €40m</span></span></div>
  </div>`,
  `<button class="btn btnQuiet">Cancel</button><button class="btn btnGo">Add Target</button>`);

function composerBoard(which, w) {
  const d = { who: composerWho(), listing: composerListing(false), named: composerNamed(), role: composerRole() }[which];
  return `<div class="screen dlgScreen" style="width: ${w}px; height: __H__px;">${d}</div>`;
}
function composerSheet(w) {
  return `<div class="screen m sheetScreen" style="width: ${w}px; height: __H__px;">
    <div class="behind">${topbar(true)}${subnav('Board')}<main class="wrap"><div class="lock"><h2 class="lockT">Your Targets</h2></div>${liveCard()}</main></div>
    <div class="scrim"></div>
    ${composerListing(true)}
  </div>`;
}

// ── Market with Your Move ─────────────────────────────────────────────────
const MOVES = () => [
  { v: fc('zubimendi', 'DM', 'face face-44'), head: 'You’ve been outbid on Zubimendi', meta: `${crest('COYS', 12)}Hayden FC bid €52m<span class="dot">·</span>Free agent`, clock: '5h 12m', act: ['Bid €53m', 'go'] },
  { v: fc('saliba', 'CB', 'face face-44'), head: 'Saliba is at auction', meta: `${crest('XABI', 12)}Your target<span class="dot">·</span>High bid €58m`, clock: '2d 04h', act: ['Bid €59m', 'go'] },
  { v: fc('palmer', 'AM', 'face face-44'), head: 'Hayden FC made an offer for Palmer', meta: `Mbeumo and €20m<span class="dot">·</span>Expires in 2d`, clock: '', act: ['Reply', 'go'] },
  { v: `<span class="mvCrest">${crest('YANG', 30)}</span>`, head: 'tottenyang FC want Rice', meta: 'Will pay cash · up to <b class="cash">€95m</b>', clock: '', act: ['Offer', 'quiet'] },
  { v: fc('havertz', 'ST', 'face face-44'), head: 'ChelsZ FC bid €36m on Havertz', meta: 'Your listing<span class="dot">·</span>2 bids', clock: '1d 06h', act: ['View', 'quiet'] },
];
const yourMove = (mobile) => `
<div class="moves">
${MOVES().map((m) => `
  <div class="mv">
    ${m.v}
    <span class="mvTxt"><b class="mvHead">${m.head}</b><span class="mvMeta">${m.meta}</span></span>
    ${mobile ? '' : `<span class="mvClock">${m.clock}</span>`}
    <button class="btn ${m.act[1] === 'go' ? 'btnGo' : 'btnQuiet'} btnSm mvAct">${m.act[0]}</button>
  </div>`).join('')}
</div>`;

const LOTS = [
  { k: 'zubimendi', name: 'Zubimendi', pos: 'DM', bid: '€52m', by: 'COYS', clock: '5h 12m', soon: true },
  { k: 'havertz', name: 'Havertz', pos: 'ST', bid: '€36m', by: 'ZFC', clock: '1d 06h' },
  { k: 'saliba', name: 'Saliba', pos: 'CB', bid: '€58m', by: 'YANG', clock: '2d 04h' },
  { k: 'tonali', name: 'Tonali', pos: 'DM', bid: '€48m', by: null, clock: '2d 20h' },
];
const lots = () => `<div class="lots">${LOTS.map((l) => `
  <a class="lot" style="--pos: var(--color-pos-${l.pos.toLowerCase()});">
    <span class="lotPlinth"><img class="tCrop" src="${img(l.k)}" alt=""><span class="tPlate${l.soon ? ' tPlateLive' : ''}">${l.clock}</span></span>
    <span class="lotBody"><span class="namerow"><b class="tName">${l.name}</b>${chip(l.pos)}</span>
      <span class="lotBid"><b class="mono">${l.bid}</b>${l.by ? `${crest(l.by, 12)}${club(l.by)}` : '<span class="muted">Floor, no bids</span>'}</span></span>
  </a>`).join('')}</div>`;

const preview = () => `
<div class="pvGrid">
  <div class="pvCol"><span class="pvColH">Listed</span>
    ${LISTED.slice(0, 3).map((l) => `<div class="pvItem">${fc(l.k, l.pos, 'face face-30')}<span class="brTxt"><span class="namerow"><b class="pvName">${l.name}</b>${chip(l.pos)}</span><span class="brMeta">${crest(l.by, 11)}${club(l.by)}</span></span><span class="pvFig">${l.price ?? '–'}</span></div>`).join('')}
  </div>
  <div class="pvCol"><span class="pvColH">Wanted</span>
    ${[['CHAI', 'haaland', 'Haaland', 'ST', '€200m'], ['PKNG', 'caicedo', 'Caicedo', 'DM', '€90m'], ['ZFC', 'wirtz', 'Wirtz', 'AM', '–']].map(([by, k, n, p, b]) => `<div class="pvItem">${fc(k, p, 'face face-30')}<span class="brTxt"><span class="namerow"><b class="pvName">${n}</b>${chip(p)}</span><span class="brMeta">${crest(by, 11)}${club(by)} want him</span></span><span class="pvFig">${b}</span></div>`).join('')}
  </div>
</div>`;

const WIRE = [
  ['ZFC', 'ChelsZ FC bid €36m on Havertz', '2h'],
  ['COYS', 'Hayden FC bid €52m on Zubimendi', '3h'],
  ['PKNG', 'Pizzaking’s Club listed Saliba', '2d'],
  ['CHAI', 'Tea FC listed Delap for loan', '2d'],
  ['YANG', 'tottenyang FC signed Roefs', '4d'],
  ['XABI', 'Not Too Xabi listed Ndiaye', '4d'],
  ['ZFC', 'ChelsZ FC signed Quenda', '5d'],
  ['COYS', 'Hayden FC loaned out Kostoulas', '6d'],
  ['PKNG', 'Pizzaking’s Club dropped Egan', '6d'],
  ['CHAI', 'Tea FC signed Kelleher', '1w'],
];
const rail = () => `
<aside class="rail">
  <section class="railSect">
    <div class="lock lockSm"><h2 class="lockT lockTSm">Deadlines</h2></div>
    <div class="dl"><span class="mwTile"><span class="mwK">MW</span><span class="mwV">6</span></span><span class="dlTxt"><b>Lineups lock</b><span>Sat 26 Sep · 12:30</span></span></div>
  </section>
  <section class="railSect">
    <div class="lock lockSm"><h2 class="lockT lockTSm">The Wire</h2></div>
    <div class="wire">${WIRE.map(([c, t, a]) => `<div class="wi">${crest(c, 16)}<span class="wiT">${t}</span><span class="wiA">${a}</span></div>`).join('')}</div>
  </section>
</aside>`;

function marketPage({ mobile, dark, w }) {
  const body = mobile ? `
  ${topbar(true)}${subnav('Market')}
  <main class="wrap">
    <section class="sect"><div class="lock"><h2 class="lockT">Your Move</h2></div>${yourMove(true)}</section>
    <section class="sect"><div class="lock"><h2 class="lockT">Closing Now</h2><a class="quietLink lockEnd">Auction Room</a></div>${lots()}</section>
    <section class="sect"><div class="lock"><h2 class="lockT">On the Board</h2><a class="quietLink lockEnd">Open Board</a></div>${preview()}</section>
    ${rail()}
  </main>` : `
  ${topbar(false)}${subnav('Market')}
  <main class="wrap mkWrap">
    <div class="mkMain">
      <section class="sect"><div class="lock"><h2 class="lockT">Your Move</h2></div>${yourMove(false)}</section>
      <section class="sect sectGap"><div class="lock"><h2 class="lockT">Closing Now</h2><a class="quietLink lockEnd">Auction Room</a></div>${lots()}</section>
      <section class="sect sectGap"><div class="lock"><h2 class="lockT">On the Board</h2><a class="quietLink lockEnd">Open Board</a></div>${preview()}</section>
    </div>
    ${rail()}
  </main>`;
  return screen(mobile, dark, w, body);
}

// ── Document ──────────────────────────────────────────────────────────────
function screen(mobile, dark, w, body) {
  return `<div class="screen ${mobile ? 'm' : 'd'}"${dark ? ' data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;">${body}</div>`;
}
const STYLE = fs.readFileSync(path.join(HERE, 'targets.css'), 'utf8') + '\n' + fs.readFileSync(path.join(HERE, 'board.css'), 'utf8');
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
  { file: 'Board.dc.html', title: 'Board', w: 1440, make: () => boardPage({ mobile: false, dark: false, w: 1440 }) },
  { file: 'BoardDark.dc.html', title: 'Board · Dark', w: 1440, make: () => boardPage({ mobile: false, dark: true, w: 1440 }) },
  { file: 'BoardMobile.dc.html', title: 'Board · 390', w: 390, make: () => boardPage({ mobile: true, dark: false, w: 390 }) },
  { file: 'ComposerWho.dc.html', title: 'Add · Who', w: 600, make: () => composerBoard('who', 600) },
  { file: 'ComposerListing.dc.html', title: 'Add · Your Player', w: 600, make: () => composerBoard('listing', 600) },
  { file: 'ComposerNamed.dc.html', title: 'Add · Another Club’s Player', w: 600, make: () => composerBoard('named', 600) },
  { file: 'ComposerRole.dc.html', title: 'Add · A Position', w: 600, make: () => composerBoard('role', 600) },
  { file: 'ComposerSheet.dc.html', title: 'Add · 390 Sheet', w: 390, fixedH: 844, make: () => composerSheet(390) },
  { file: 'Market.dc.html', title: 'Market', w: 1440, make: () => marketPage({ mobile: false, dark: false, w: 1440 }) },
  { file: 'MarketDark.dc.html', title: 'Market · Dark', w: 1440, make: () => marketPage({ mobile: false, dark: true, w: 1440 }) },
  { file: 'MarketMobile.dc.html', title: 'Market · 390', w: 390, make: () => marketPage({ mobile: true, dark: false, w: 390 }) },
];

const hp = path.join(HERE, 'board-heights.json');
const heights = fs.existsSync(hp) ? JSON.parse(fs.readFileSync(hp, 'utf8')) : {};
for (const b of BOARDS) {
  const h = b.fixedH ?? heights[b.file] ?? 1600;
  for (const mode of ['dc', 'preview']) {
    setMode(mode); resetCrests();
    const out = mode === 'dc' ? path.join(HERE, 'project', b.file) : path.join(HERE, 'preview', b.file.replace('.dc.html', '.html'));
    fs.writeFileSync(out, doc(b.make(), b.w, h, b.title, mode));
  }
}
console.log('built', BOARDS.length, 'boards');
