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
const LIGHT = block(':root,\n.g-theme-light {');
const DARK = block('[data-theme="dark"] {');

// ── Assets ────────────────────────────────────────────────────────────────
const BLOB = {
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
let MODE = 'dc';
const img = (k) => (MODE === 'dc' ? `/_blob/${BLOB[k]}` : `../assets/${k}.png`);

// ── Manager crests, rendered from the app's own crest modules ─────────────
const CLUBS = {
  XABI: { name: 'Not Too Xabi', c: { icon: 'griffin', shape: 'circle', division: 'quartered', showText: false, iconColor: '#FBBF24', textColor: '#000000', borderColor: '#D4A017', primaryColor: '#4338CA', tertiaryColor: '#1C1C1C', secondaryColor: '#4338CA' } },
  YANG: { name: 'tottenyang FC', c: { icon: 'flame', shape: 'classic', division: 'solid', showText: false, iconColor: '#2A5A92', textColor: '#FFFFFF', borderColor: '#1C1C1C', primaryColor: '#E8E2D5', tertiaryColor: '#2A5A92', secondaryColor: '#8B5CF6' } },
  ZFC: { name: 'ChelsZ FC', c: { icon: 'crown', shape: 'circle', division: 'solid', showText: false, iconColor: '#D9D4CD', textColor: '#FFFFFF', borderColor: '#2A5A92', primaryColor: '#60A5FA', tertiaryColor: '#A7F3D0', secondaryColor: '#4A4A4A' } },
  COYS: { name: 'Hayden FC', c: { icon: 'castle', shape: 'heraldic', division: 'solid', showText: false, iconColor: '#D4A017', textColor: '#F87171', borderColor: '#D4A017', primaryColor: '#A62626', tertiaryColor: '#D4A017', secondaryColor: '#0F1E36' } },
  PKNG: { name: "Pizzaking’s Club", c: { icon: 'paw', shape: 'arch', division: 'solid', showText: true, iconColor: '#60A5FA', textColor: '#2E7D82', borderColor: '#C084FC', primaryColor: '#1C1C1C', tertiaryColor: '#2E7D82', secondaryColor: '#B54E7F' } },
  CHAI: { name: 'Tea FC', c: { icon: 'anchor', shape: 'circle', division: 'horizontal-half', showText: true, iconColor: '#F7F3ED', textColor: '#F7F3ED', borderColor: '#FBBF24', primaryColor: '#146B40', tertiaryColor: '#1C1C1C', secondaryColor: '#1B4A5A' } },
};
let crestN = 0;
function crest(k, size) {
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
const club = (k) => CLUBS[k].name;

// ── Glyphs (stroke, currentColor) ─────────────────────────────────────────
const G = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  eyeOff: '<path d="M3 3l18 18"></path><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4"></path><path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  arrow: '<path d="M4 12h15"></path><path d="M13 6l6 6-6 6"></path>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"></path>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
  chev: '<path d="M6 9l6 6 6-6"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
};
const glyph = (k, s = 14, cls = 'gl') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[k]}</svg>`;

const chip = (p, size = 'sm') => `<span class="pc pc-${size}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on); --pl: var(--color-pos-${p.toLowerCase()}-line);">${p}</span>`;
const face = (k, p, cls = 'face') => `<span class="${cls}" style="--pos: var(--color-pos-${p.toLowerCase()});"><img src="${img(k)}" alt=""></span>`;
const badge = (k) => `<img class="badge" src="${img('club-' + k)}" alt="">`;

// ── Data (real squads; the targets themselves are illustrative) ───────────
const MINE = [
  { k: 'haaland', name: 'Haaland', pos: 'ST', pl: 'man-city', plName: 'Man City', mv: '€220m', aud: ['eyeOff', 'Only you'], state: 'Not Listed', rival: ['CHAI', 'Tea FC want him too'] },
  { k: 'wirtz', name: 'Wirtz', pos: 'AM', pl: 'liverpool', plName: 'Liverpool', mv: '€100m', aud: ['eye', 'The league'], state: 'Not Listed', rival: ['ZFC', 'ChelsZ FC want him too'] },
];
const INBOX = [
  { by: 'YANG', head: 'tottenyang FC want Rice', terms: ['Will pay cash', '€95m'],
    who: () => `${face('rice', 'DM', 'face face-36')}<span class="whoTxt"><span class="namerow"><b class="whoName">Rice</b>${chip('DM')}</span><span class="whoMeta">${glyph('eyeOff', 13)}Only you can see this</span></span>`,
    acts: ['List', 'Offer'] },
  { by: 'ZFC', head: 'ChelsZ FC want a starting centre-back', terms: ['Will pay cash', '€35m'],
    who: () => `<span class="posDisc" style="--pos: var(--color-pos-cb); --pi: var(--color-pos-cb-on);">CB</span><span class="whoTxt"><b class="whoName">You have 5</b><span class="whoMeta">Gvardiol, Colwill +3</span></span><span class="stack">${['gvardiol', 'colwill', 'jacquet', 'khusanov', 'canvot'].map((k) => face(k, 'CB', 'face face-28')).join('')}</span>`,
    acts: ['Message', 'Offer'] },
  { by: 'CHAI', head: 'Tea FC want a striker prospect', terms: ['Offering players'],
    who: () => `${face('kroupi', 'ST', 'face face-36')}<span class="whoTxt"><span class="namerow"><b class="whoName">Kroupi.Jr</b>${chip('ST')}</span><span class="whoMeta">20 · Academy</span></span>`,
    acts: ['Message', 'Offer'] },
];
// market: null = not listed; otherwise the live listing the target is joined to
const BOARD = [
  { by: 'YANG', you: true, k: 'saliba', name: 'Saliba', pos: 'CB', pl: 'arsenal', plName: 'Arsenal', owner: 'PKNG', terms: 'Will pay cash', budget: '€75m', market: { bid: '€58m', clock: '2d 04h' } },
  { by: 'CHAI', you: true, k: 'haaland', name: 'Haaland', pos: 'ST', pl: 'man-city', plName: 'Man City', owner: 'YANG', terms: 'Will pay cash', budget: '€200m', market: null },
  { by: 'ZFC', you: true, k: 'wirtz', name: 'Wirtz', pos: 'AM', pl: 'liverpool', plName: 'Liverpool', owner: 'COYS', terms: 'Offering players', budget: null, market: null },
  { by: 'PKNG', k: 'caicedo', name: 'Caicedo', pos: 'DM', pl: 'chelsea', plName: 'Chelsea', owner: 'COYS', terms: 'Will pay cash', budget: '€90m', market: null },
  { by: 'COYS', k: 'gabriel', name: 'Gabriel', pos: 'CB', pl: 'arsenal', plName: 'Arsenal', owner: 'YANG', terms: 'Open to approaches', budget: '€60m', market: null },
  { by: 'COYS', k: 'saka', name: 'Saka', pos: 'RW', pl: 'arsenal', plName: 'Arsenal', owner: 'PKNG', terms: 'Offering players', budget: null, market: null },
];
const SPINE = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const demand = Object.fromEntries(SPINE.map((p) => [p, BOARD.filter((b) => b.pos === p).length]));

// ── Pieces ────────────────────────────────────────────────────────────────
const topbar = (mobile) => mobile
  ? `<header class="top"><span class="topL">${crest('XABI', 22)}<span class="word">Gaffa</span></span><span class="topR"><span class="bal">€204m</span><button class="iconBtn" aria-label="Notifications">${glyph('bell', 18)}</button><button class="iconBtn" aria-label="Menu">${glyph('menu', 20)}</button></span></header>`
  : `<header class="top"><span class="topL"><span class="word">Gaffa</span><span class="league">Matchday Militia</span></span>
      <nav class="topNav" aria-label="League"><a class="tl">Home</a><a class="tl">Squad${glyph('chev', 12)}</a><a class="tl on">Transfers</a><a class="tl">League${glyph('chev', 12)}</a><a class="tl">Fixtures${glyph('chev', 12)}</a></nav>
      <span class="topR"><span class="bal">€204m</span><button class="iconBtn" aria-label="Notifications">${glyph('bell', 18)}</button>${crest('XABI', 24)}</span></header>`;

const subnav = () => `<nav class="sub" aria-label="Transfer market sections"><div class="subIn">
  <a class="si">Market</a><a class="si">Auctions <span class="sc">1</span></a><a class="si">Listings <span class="sc">3</span></a><a class="si on">Targets <span class="sc">9</span></a><a class="si">Free Agency <span class="sc">14</span></a><a class="si">Deals <span class="sc">2</span></a></div></nav>`;

const pips = (n, of) => `<span class="cap"><span class="pips" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span><span class="capN">${n} of ${of}</span></span>`;

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
    <span class="tFoot">${face('hall', 'LWB', 'face face-18')}ChelsZ FC listed Hall<span class="tFootGo">View</span></span>
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

const spine = () => `<div class="spine" role="group" aria-label="Filter by position"><button class="sp spAll on">All <span class="spN">${BOARD.length}</span></button>${SPINE.map((p) => `<button class="sp${demand[p] ? '' : ' sp0'}" style="--pf: var(--color-pos-${p.toLowerCase()}); --pi: var(--color-pos-${p.toLowerCase()}-on);"><span class="spTag">${p}</span><span class="spN">${demand[p]}</span></button>`).join('')}</div>`;

// Who wants him: their crest, and yours tucked behind it when you do too.
const wanters = (b, size) => `<span class="pair">${crest(b.by, size)}${b.you ? `<span class="pairYou">${crest('XABI', Math.round(size * 0.78))}</span>` : ''}</span>`;
const wantersName = (b) => `${club(b.by)}${b.you ? '<span class="andYou"> and you</span>' : ''}`;

// The joined listing, or its absence, read as market state rather than a badge.
const market = (b) => b.market
  ? `<span class="mk mkLive"><span class="mkState"><i class="liveDot"></i>At Auction</span><span class="mkFig"><b>${b.market.bid}</b><span class="mkClock">${b.market.clock}</span></span></span>`
  : `<span class="mk"><span class="mkState mkQuiet">Not Listed</span></span>`;

const boardDesktop = () => `
<div class="board">
  <div class="bh"><span>Wanted By</span><span>Target</span><span>Terms</span><span class="r">Budget</span><span class="r">Market</span></div>
  ${BOARD.map((b) => `
  <div class="br${b.you ? ' brYou' : ''}">
    <span class="brClub">${wanters(b, 26)}<span class="brClubName">${wantersName(b)}</span></span>
    <span class="brPlayer">${face(b.k, b.pos, 'face face-40')}<span class="brTxt"><span class="namerow"><b class="brName">${b.name}</b>${chip(b.pos)}</span><span class="brMeta">${badge(b.pl)}${b.plName}<span class="dot">·</span>${crest(b.owner, 12)}${club(b.owner)}</span></span></span>
    <span class="brTerms">${b.terms}</span>
    <span class="brBudget${b.budget ? '' : ' none'}">${b.budget ?? '–'}</span>
    ${market(b)}
  </div>`).join('')}
</div>`;

const boardMobile = () => `
<div class="board">
  ${BOARD.map((b) => `
  <div class="br${b.you ? ' brYou' : ''}">
    ${face(b.k, b.pos, 'face face-44')}
    <span class="brTxt">
      <span class="brBy">${wanters(b, 14)}<span>${wantersName(b)} want</span></span>
      <span class="namerow"><b class="brName">${b.name}</b>${chip(b.pos)}</span>
      <span class="brMeta">${b.terms}<span class="dot">·</span>${club(b.owner)}</span>
      ${b.market ? `<span class="brMk"><span class="mkState"><i class="liveDot"></i>At Auction</span><span class="mkFig"><b>${b.market.bid}</b><span class="mkClock">${b.market.clock}</span></span></span>` : ''}
    </span>
    <span class="brBudget${b.budget ? '' : ' none'}">${b.budget ?? '–'}</span>
  </div>`).join('')}
</div>`;

const lockTargets = (withPips) => `<div class="lock"><h2 class="lockT">Your Targets</h2>${withPips ? `<span class="lockInst">${pips(4, 10)}</span>` : ''}<button class="btn btnGo btnAdd lockEnd">${glyph('plus', 14)}Add Target</button></div>`;
const lockWanted = () => `<div class="lock"><h2 class="lockT">Wanted From You</h2></div>`;
const lockBoard = (withSpine) => `<div class="lock"><h2 class="lockT">The Board</h2>${withSpine ? `<span class="lockEnd">${spine()}</span>` : ''}</div>`;

// ── Page ──────────────────────────────────────────────────────────────────
function page({ mobile, dark, w }) {
  const body = mobile
    ? `
  ${topbar(true)}${subnav()}
  <main class="wrap">
    <section class="sect">
      ${lockTargets(false)}
      <div class="sInst">${pips(4, 10)}</div>
      ${liveCard()}
      <div class="tiles">${MINE.map(tile).join('')}${roleTile()}</div>
    </section>
    <section class="sect">
      ${lockWanted()}
      ${inbox()}
    </section>
    <section class="sect">
      ${lockBoard(false)}
      ${spine()}
      ${boardMobile()}
    </section>
  </main>`
    : `
  ${topbar(false)}${subnav()}
  <main class="wrap">
    <div class="topGrid">
      <section class="sect">
        ${lockTargets(true)}
        ${liveCard()}
        <div class="tiles">${MINE.map(tile).join('')}${roleTile()}</div>
      </section>
      <section class="sect">
        ${lockWanted()}
        ${inbox()}
      </section>
    </div>
    <section class="sect sectBoard">
      ${lockBoard(true)}
      ${boardDesktop()}
    </section>
  </main>`;
  return `<div class="screen ${mobile ? 'm' : 'd'}"${dark ? ' data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;">${body}</div>`;
}

const STYLE = fs.readFileSync(path.join(HERE, 'targets.css'), 'utf8');

function doc(inner, w, h, title) {
  const head = MODE === 'dc' ? '<script src="./support.js"></script>' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
${head}
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&amp;family=Hanken+Grotesk:wght@400;500;600;700&amp;family=Archivo+Narrow:wght@500;600;700&amp;family=JetBrains+Mono:wght@500;700&amp;display=swap">
<style>
${LIGHT}
${DARK}
:root { --font-newsreader: 'Newsreader'; --font-hanken-grotesk: 'Hanken Grotesk'; --font-archivo-narrow: 'Archivo Narrow'; --font-jetbrains-mono: 'JetBrains Mono'; }
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
  { file: 'TargetsC.dc.html', title: 'Targets C', mobile: false, dark: false, w: 1440 },
  { file: 'TargetsCDark.dc.html', title: 'Targets C · Dark', mobile: false, dark: true, w: 1440 },
  { file: 'TargetsCMobile.dc.html', title: 'Targets C · 390', mobile: true, dark: false, w: 390 },
  { file: 'TargetsCMobileDark.dc.html', title: 'Targets C · 390 Dark', mobile: true, dark: true, w: 390 },
];
const heights = fs.existsSync(path.join(HERE, 'heights.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'heights.json'), 'utf8')) : {};
fs.mkdirSync(path.join(HERE, 'project'), { recursive: true });
fs.mkdirSync(path.join(HERE, 'preview'), { recursive: true });
for (const b of BOARDS) {
  const h = heights[b.file] ?? (b.mobile ? 2400 : 1400);
  for (const mode of ['dc', 'preview']) {
    MODE = mode; crestN = 0;
    const html = doc(page(b), b.w, h, b.title);
    const out = mode === 'dc' ? path.join(HERE, 'project', b.file) : path.join(HERE, 'preview', b.file.replace('.dc.html', '.html'));
    fs.writeFileSync(out, html);
  }
}
console.log('built', BOARDS.map((b) => `${b.file}@${heights[b.file] ?? '?'}`).join(', '));
