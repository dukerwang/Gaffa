// Both pages, every state, from one source.
import {
  TEAMS, ME, DRAW, RESULTS, SCHEDULE, form, tableWithMove, recordOf, ordinal, zoneOf, GW5, GW6, LIVE_NOW,
  finishedAt, sideAt, runningScore, stillToPlay, roundTop, SEASON_TOP, ptsBand, fmt, res,
} from './model.mjs';
import { crest, tname, glyph, chip, portrait, face, ptsBadge, ukTime, badgeSrc, photoSrc } from './lib.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export const bold = (s) => esc(s).replace(/\*\*(?:p:[^:]+:)?([^*]+)\*\*/g, '<b>$1</b>').replace(/'/g, '’');

// ── Chrome ────────────────────────────────────────────────────────────────
export const topbar = (mobile) => mobile
  ? `<header class="top"><span class="topL">${crest('NTX', 20)}<span class="word">Gaffa</span></span><span class="topR"><span class="bal">€204m</span><button class="iconBtn" aria-label="Notifications">${glyph('bell', 18)}</button><button class="iconBtn" aria-label="Menu">${glyph('menu', 20)}</button></span></header>`
  : `<header class="top"><span class="topL"><span class="word">Gaffa</span><span class="league">Matchday Militia</span></span>
      <nav class="topNav" aria-label="League"><a class="tl">Home</a><a class="tl">Squad${glyph('chev', 12)}</a><a class="tl">Transfers</a><a class="tl">League${glyph('chev', 12)}</a><a class="tl on">Fixtures${glyph('chev', 12)}</a></nav>
      <span class="topR"><span class="bal">€204m</span><button class="iconBtn" aria-label="Notifications">${glyph('bell', 18)}</button>${crest('NTX', 24)}</span></header>`;

// ── The season ribbon: your result every gameweek, and the way between them ─
export function ribbon(sel, mobile, liveGw) {
  const f = Object.fromEntries(form(ME, 5).map((x) => [x.gw, x]));
  const cells = [];
  for (let gw = 1; gw <= 38; gw++) {
    const r = f[gw];
    let bar = '', label;
    if (gw === liveGw && gw === sel) { bar = ''; label = `Gameweek ${gw}, live`; }
    else if (r && !(liveGw && gw === liveGw)) {
      const m = Math.abs(r.my - r.opp);
      const h = Math.max(5, Math.round(Math.min(m, 50) / 50 * 17));
      bar = r.r === 'D' ? '<i class="rcBar rcD"></i>' : `<i class="rcBar rc${r.r}" style="height: ${h}px;"></i>`;
      label = `Gameweek ${gw}, ${r.r === 'W' ? 'won' : r.r === 'L' ? 'lost' : 'drew'} by ${m.toFixed(2)}`;
    } else { bar = '<i class="rcBar rcF"></i>'; label = `Gameweek ${gw}`; }
    const n = gw === sel || gw === 1 || gw % 5 === 0 || gw === 38 ? gw : '';
    cells.push(`<button class="rc${gw === sel ? ' rcOn' : ''}${gw === liveGw ? ' rcLive' : ''}" aria-label="${label}"${gw === sel ? ' aria-current="true"' : ''}><span class="rcAx">${bar}</span><span class="rcN">${n}</span></button>`);
  }
  const rec = recordOf(ME, 5);
  return `<div class="rib">${mobile ? '' : `<span class="ribK"><b>${ordinal(rec.rank)} · ${rec.pts} pts</b><span>W${rec.W} D${rec.D} L${rec.L}</span></span>`}<div class="ribCells">${cells.join('')}</div></div>`;
}
export function gwBar(gw, mobile, liveGw) {
  const sub = gw === 6 ? 'Deadline Sat 10 Oct, 11:00' : liveGw ? 'Live · Fri 18 – Sun 20 Sep' : 'Final · Fri 18 – Sun 20 Sep';
  if (mobile) {
    return `<nav class="gwb gwbM" aria-label="Gameweeks">
    <span class="gwbStepM"><button class="arwM" aria-label="Previous gameweek">${glyph('left', 20)}</button><button class="gwSelM" aria-label="Choose a gameweek"><span class="gwSelT">Gameweek ${gw}${glyph('chev', 14)}</span><span class="gwSelS${liveGw ? ' gwSelLive' : ''}">${sub}</span></button><button class="arwM" aria-label="Next gameweek">${glyph('right', 20)}</button></span>
    ${ribbon(gw, mobile, liveGw)}
  </nav>`;
  }
  return `<nav class="gwb" aria-label="Gameweeks">
    <span class="gwbName">Gameweeks</span>
    <span class="gwbStep"><button class="arw" aria-label="Previous gameweek">${glyph('left', 18)}</button><button class="gwSel" aria-label="Choose a gameweek">Gameweek ${gw}${glyph('chev', 14)}</button><button class="arw" aria-label="Next gameweek">${glyph('right', 18)}</button></span>
    ${ribbon(gw, mobile, liveGw)}
  </nav>`;
}

// ── The margin axis ───────────────────────────────────────────────────────
function inkStyle(a, b) {
  const reach = Math.min(Math.abs(a - b), 50) / 50 * 50;
  if (!reach) return 'display: none;';
  return a > b ? `right: 50%; width: ${reach}%;` : `left: 50%; width: ${reach}%;`;
}
export const axisDark = (a, b) => `<div class="hxAxis" aria-hidden="true"><span class="hxBand"></span><span class="hxInk" style="${inkStyle(a, b)}"></span><span class="hxTick"></span></div>`;
export const axisLight = (a, b) => `<div class="ax" aria-hidden="true"><span class="axBand"></span><span class="axInk" style="${inkStyle(a, b)}"></span><span class="axTick"></span></div>`;
export function verdict(a, b, mineSide, done) {
  const m = Math.abs(a - b);
  if (m <= DRAW) return `${done ? 'Drawn' : 'Level'}, <b>${fmt(m)}</b> apart`;
  const aLeads = a > b;
  if (mineSide) {
    const mine = (mineSide === 'A') === aLeads;
    return done ? `${mine ? 'Won' : 'Lost'} by <b>${fmt(m)}</b>` : `${mine ? 'Ahead' : 'Behind'} by <b>${fmt(m)}</b>`;
  }
  return `${done ? '' : 'Ahead by '}<b>${fmt(m)}</b>`;
}

export const ticks = (played) => `<span class="ticks" aria-label="${played} of 11 played">${Array.from({ length: 11 }, (_, i) => `<i${i < played ? '' : ' class="to"'}></i>`).join('')}</span>`;
export const formDots = (k, upto, cls = 'frm') => `<span class="${cls}">${form(k, upto).slice(-5).map((x) => `<i class="${cls === 'frm' ? x.r : `res ${x.r}`}">${x.r}</i>`).join('')}</span>`;

// ── The scoreboard (round hero and matchup head) ─────────────────────────
export function scoreboard(o) {
  const { m, state, big, mobile, gw } = o;
  const kA = m.A.k, kB = m.B.k;
  const mine = kA === ME ? 'A' : kB === ME ? 'B' : null;
  const now = state === 'live' ? LIVE_NOW : null;
  const sA = state === 'upcoming' ? null : sideAt(m.A, now), sB = state === 'upcoming' ? null : sideAt(m.B, now);
  const done = state === 'final';
  const a = sA?.score ?? 0, b = sB?.score ?? 0;
  const aLose = done && Math.abs(a - b) > DRAW && a < b, bLose = done && Math.abs(a - b) > DRAW && b < a;
  const upto = state === 'live' ? 4 : 5;
  const meta = (k, s) => {
    const r = recordOf(k, upto);
    if (state === 'live') return `<span class="hxMeta">${ticks(s.played)} &nbsp;${s.toPlay} to play</span>`;
    if (state === 'upcoming') return `<span class="hxMeta">${TEAMS[k].mgr} · ${ordinal(r.rank)} · ${formDots(k, 5)}</span>`;
    return `<span class="hxMeta">${TEAMS[k].mgr} · ${ordinal(r.rank)} · ${r.line}</span>`;
  };
  const eq = (s) => (big && s ? `<span class="hxEq">XI <b>${fmt(s.xi)}</b> &nbsp;+&nbsp; Bench <b>${fmt(s.bench)}</b></span>` : '');
  const side = (k, s, away) => `<div class="hxSide${away ? ' hxAway' : ''}">${crest(k, big ? 68 : 56)}<div class="hxTx"><span class="hxName">${tname(k)}</span>${meta(k, s)}${eq(s)}</div></div>`;

  let mid;
  if (state === 'upcoming') {
    mid = `<div class="hxMid"><div class="hxDl"><span class="hxDlK">Deadline Sat 10 Oct, 11:00</span><span class="hxDlV">14d 18h 22m</span></div></div>`;
  } else {
    const fig = (v, lose, isMine) => `<span class="hxV${lose ? ' hxLose' : ''}${isMine ? ' hxMine' : ''}">${fmt(v)}</span>`;
    mid = `<div class="hxMid"><div class="hxFigs">${fig(a, aLose, mine === 'A')}<span class="hxSep"></span>${fig(b, bLose, mine === 'B')}</div>${axisDark(a, b)}<span class="hxVerdict">${verdict(a, b, mine, done)}</span></div>`;
  }

  // standouts: the three best returns each side so far
  const standouts = (s) => {
    const pool = s.starters.filter((p) => state !== 'live' || finishedAt((p.subIn ? p.replaced : p).fixture, LIVE_NOW));
    return pool.slice().sort((x, y) => y.pts - x.pts).slice(0, 3)
      .map((p) => `<span class="so">${face(p, 34).replace('class="fc', 'class="fc onDark')}<span class="soTx"><span class="soName">${p.name}</span><span class="soPts">${fmt(p.pts)}</span></span></span>`).join('');
  };
  const nextUp = (s) => {
    const first = s.starters.map((p) => p.fixture).sort((x, y) => Date.parse(x.kickoffTime) - Date.parse(y.kickoffTime))[0];
    const at = s.starters.filter((p) => p.fixture.kickoffTime === first.kickoffTime);
    return `<span class="soK">First up ${ukTime(first.kickoffTime)}</span>${at.slice(0, 3).map((p) => `<span class="so">${face(p, 30).replace('class="fc', 'class="fc onDark')}<span class="soTx"><span class="soName">${p.name}</span></span></span>`).join('')}`;
  };

  let foot;
  if (state === 'upcoming') {
    const mineK = mine === 'A' ? kA : kB;
    foot = `<div class="hxFoot"><div class="hxFootS">${mine === 'A' ? `<a class="btn hxBtnGo">Set Lineup</a>` : nextUp(m.A)}</div><div class="hxFootS">${mine === 'B' ? `${nextUp(m.B)}<a class="btn hxBtnGo">Set Lineup</a>` : nextUp(m.B)}</div></div>`;
  } else {
    foot = `<div class="hxFoot"><div class="hxFootS">${standouts(m.A)}</div><div class="hxFootS">${standouts(m.B)}</div></div>`;
  }

  const stateNode = state === 'live'
    ? `<span class="hxState hxLive"><i class="ldot"></i>Live</span>`
    : state === 'final' ? `<span class="hxState">Final</span>` : `<span class="hxState">Gameweek ${gw}</span>`;
  const when = state === 'upcoming' ? 'Sat 10 – Mon 12 Oct' : 'Fri 18 – Sun 20 Sep';
  const topL = big ? `<span>${when}</span>` : `<span>Your Fixture · ${when}</span>`;
  const openLink = big ? '' : `<span class="hxOpen">Matchup${glyph('right', 14)}</span>`;

  if (mobile) {
    const row = (k, s, v, lose, isMine) => `<div class="hxSide">${crest(k, 40)}<div class="hxTx"><span class="hxName">${tname(k)}</span>${meta(k, s)}</div>${state === 'upcoming' ? '' : `<span class="hxRowV${lose ? ' hxLose' : ''}${isMine ? ' hxMine' : ''}">${fmt(v)}</span>`}</div>`;
    const midM = state === 'upcoming'
      ? `<div class="hxMid"><div class="hxVerdictRow"><span class="hxDlK">Deadline Sat 10 Oct, 11:00</span><span class="hxDlV" style="font-size: 20px;">14d 18h</span></div></div>`
      : `<div class="hxMid">${axisDark(a, b)}<div class="hxVerdictRow"><span class="hxVerdict">${verdict(a, b, mine, done)}</span>${big && sA ? `<span class="hxEq">Bench <b>+${fmt(sA.bench)}</b> · <b>+${fmt(sB.bench)}</b></span>` : ''}</div></div>`;
    const footM = state === 'upcoming'
      ? `<div class="hxFoot"><div class="hxFootS"><a class="btn hxBtnGo" style="flex: 1;">Set Lineup</a><a class="btn hxBtnQ" style="flex: 1;">Squad</a></div></div>`
      : `<div class="hxFoot"><div class="hxFootS">${standouts(mine === 'B' ? m.B : m.A)}</div></div>`;
    return `<article class="hx${big ? ' sbBig' : ''}" style="--ca: ${TEAMS[kA].color}; --cb: ${TEAMS[kB].color};">${big ? '' : '<a class="hxStretch" aria-label="Open matchup"></a>'}
      <div class="hxTop">${big ? `<span>${when}</span>` : `<span>Your Fixture</span>`}<span class="hxTopR">${stateNode}${openLink}</span></div>
      <div class="hxMain">${row(kA, sA, a, aLose, mine === 'A')}${row(kB, sB, b, bLose, mine === 'B')}${midM}</div>${footM}</article>`;
  }
  return `<article class="hx${big ? ' sbBig' : ''}" style="--ca: ${TEAMS[kA].color}; --cb: ${TEAMS[kB].color};">${big ? '' : '<a class="hxStretch" aria-label="Open matchup"></a>'}
    <div class="hxTop">${topL}<span class="hxTopR">${stateNode}${openLink}</span></div>
    <div class="hxMain">${side(kA, sA, false)}${mid}${side(kB, sB, true)}</div>${foot}</article>`;
}

// ── Fixture rows ─────────────────────────────────────────────────────────
function fixtureRow(m, state, mobile) {
  const kA = m.A.k, kB = m.B.k;
  const now = state === 'live' ? LIVE_NOW : null;
  const up = state === 'upcoming';
  const sA = up ? null : sideAt(m.A, now), sB = up ? null : sideAt(m.B, now);
  const a = sA?.score ?? 0, b = sB?.score ?? 0;
  const done = state === 'final';
  const aLose = done && Math.abs(a - b) > DRAW && a < b, bLose = done && Math.abs(a - b) > DRAW && b < a;
  const meta = (k, s) => {
    if (state === 'live') return `<span class="fxMeta">${ticks(s.played)} ${s.toPlay} to play</span>`;
    const r = recordOf(k, 5);
    return `<span class="fxMeta">${TEAMS[k].mgr} · ${ordinal(r.rank)} · ${r.line}</span>`;
  };
  const side = (k, s, away) => `<div class="fxSide${away ? ' fxAway' : ''}">${crest(k, 34)}<div class="fxTx"><span class="fxName">${tname(k)}</span>${meta(k, s)}</div></div>`;
  const st = state === 'live' ? `<span class="fxState fxStateLive">Live</span>` : `<span class="fxState">${done ? (Math.abs(a - b) <= DRAW ? 'Draw' : 'Final') : ''}</span>`;
  const mid = up
    ? `<div class="fxMid"><span class="fxKo">Sat 10 Oct</span></div>`
    : `<div class="fxMid">${axisLight(a, b)}${st}</div>`;
  const vA = up ? '<span></span>' : `<span class="fxV fxVA${aLose ? ' fxLose' : ''}">${fmt(a)}</span>`;
  const vB = up ? '<span></span>' : `<span class="fxV fxVB${bLose ? ' fxLose' : ''}">${fmt(b)}</span>`;
  if (mobile) return `<a class="fxRow">${side(kA, sA)}${vA}${side(kB, sB, true)}${vB}${mid}</a>`;
  return `<a class="fxRow">${side(kA, sA)}${vA}${mid}${vB}${side(kB, sB, true)}</a>`;
}

export const cstack = (ks, size = 22) => `<span class="cstack">${ks.map((k) => `<span>${crest(k, size)}</span>`).join('')}</span>`;

// ── Top performers ───────────────────────────────────────────────────────
function performers(list, season) {
  return `<div class="tpGrid">${list.map((p, i) => `
    <a class="tpT" aria-label="${p.name}, ${fmt(p.pts)} points">
      <span class="tpPl" style="--pos: var(--color-pos-${(p.slot ?? p.pos).toLowerCase()});"><span class="tpRank">${i + 1}</span><img src="${photoSrc(p.code)}" alt="">${chip(p.slot ?? p.pos)}${season ? `<span class="pts pts-elite">${fmt(p.pts)}</span>` : ptsBadge(p.pts)}</span>
      <span class="tpBody"><span class="tpName">${p.name}</span><span class="tpOwn">${crest(p.owner, 13)}<span>${tname(p.owner)}</span></span></span>
    </a>`).join('')}</div>`;
}

// ── Standings ─────────────────────────────────────────────────────────────
function standings(upto) {
  const rows = tableWithMove(upto);
  const mv = (n) => n > 0 ? `<span class="stMv stUp">${glyph('up', 11)}${n}</span>` : n < 0 ? `<span class="stMv stDn">${glyph('down', 11)}${-n}</span>` : `<span class="stMv stEq">–</span>`;
  return `<div class="panel"><div class="stH lbl"><span>#</span><span></span><span></span><span>Club</span><span>W-D-L</span><span>Pts</span></div>
    ${rows.map((r) => `<a class="stR${r.k === ME ? ' stMine' : ''}"><span class="stRk">${r.rank}</span>${mv(r.move)}${crest(r.k, 18)}<span class="stName">${tname(r.k)}</span><span class="stNum">${r.W}-${r.D}-${r.L}</span><span class="stPts">${r.pts}</span></a>`).join('')}
    <div class="stFoot"><span>Movement since Gameweek ${upto - 1}</span><a class="quiet">Full Table${glyph('right', 13)}</a></div></div>`;
}

// ── Round records ─────────────────────────────────────────────────────────
function records(gw) {
  const rows = RESULTS.filter((r) => r[0] === gw);
  const scores = rows.flatMap(([, a, sa, b, sb]) => [[a, sa], [b, sb]]);
  const hi = scores.reduce((x, y) => (y[1] > x[1] ? y : x));
  const close = rows.slice().sort((x, y) => Math.abs(x[2] - x[4]) - Math.abs(y[2] - y[4]))[0];
  const all = RESULTS.flatMap(([g, a, sa, b, sb]) => [[a, sa, g], [b, sb, g]]);
  const season = all.reduce((x, y) => (y[1] > x[1] ? y : x));
  const strip = `<span class="rrStrip" aria-hidden="true">${scores.map(([k, v]) => `<i class="${k === ME ? 'me' : ''}" style="left: ${(v - 100) / 150 * 100}%;"></i>`).join('')}<span style="left: 0%;">100</span><span style="left: 100%;">250</span></span>`;
  const lead = `<b>${tname(hi[0])}</b> set the pace in Gameweek ${gw} with ${fmt(hi[1])} points. <b>${tname(close[1])}</b> edged out <b>${tname(close[3])}</b> by ${fmt(Math.abs(close[2] - close[4]))}, the closest duel of the week.`;
  return `<div class="blk"><div class="sh shSm"><h2 class="shT">Round Records</h2><span class="shTools">${strip}</span></div>
    <div class="panel"><p class="rrLead">${lead}</p>
      <div class="rrR"><span class="rrK">Highest Score</span><span class="rrV">${fmt(hi[1])}</span><span class="rrW">${crest(hi[0], 13)}${tname(hi[0])}</span></div>
      <div class="rrR"><span class="rrK">Closest Match</span><span class="rrV">${fmt(Math.abs(close[2] - close[4]))}</span><span class="rrW">${crest(close[1], 13)}${tname(close[1])} v ${tname(close[3])}</span></div>
      <div class="rrR"><span class="rrK">Season High</span><span class="rrV">${fmt(season[1])}</span><span class="rrW">${crest(season[0], 13)}${tname(season[0])} · Gameweek ${season[2]}</span></div>
    </div></div>`;
}

// ═══ Round page ══════════════════════════════════════════════════════════
export function roundPage({ state, mobile, dark, w }) {
  const gw = state === 'upcoming' ? 6 : 5;
  const liveGw = state === 'live' ? 5 : null;
  const mine = state === 'upcoming' ? GW6 : GW5[0];
  const others = state === 'upcoming' ? null : GW5.slice(1);
  const otherKs = state === 'upcoming' ? SCHEDULE[6].filter(([a, b]) => a !== ME && b !== ME).flat() : others.flatMap((m) => [m.A.k, m.B.k]);

  let otherRows;
  if (state === 'upcoming') {
    // Fixtures that have no lineups yet: records and form only
    otherRows = SCHEDULE[6].filter(([a, b]) => a !== ME && b !== ME).map(([a, b]) => fixtureRow({ A: { k: a }, B: { k: b } }, 'upcoming', mobile)).join('');
  } else otherRows = others.map((m) => fixtureRow(m, state, mobile)).join('');

  const fixtures = `<section class="blk"><div class="sh">${cstack(otherKs)}<h2 class="shT">Other Fixtures</h2></div><div class="panel">${otherRows}</div></section>`;
  const season = state === 'upcoming';
  const tp = `<section class="blk"><div class="sh"><h2 class="shT">Top Performers</h2><span class="shTools"><span class="seg"><button class="segB${season ? '' : ' segOn'}">Round</button><button class="segB${season ? ' segOn' : ''}">Season</button></span></span></div>${performers(season ? SEASON_TOP : roundTop(6), season)}</section>`;
  const table = `<section class="blk"><div class="sh shSm">${cstack(tableWithMove(5).slice(0, 3).map((r) => r.k), 20)}<h2 class="shT">Standings</h2></div>${standings(5)}</section>`;
  const rec = state === 'upcoming' ? '' : records(5);

  const main = `${gwBar(gw, mobile, liveGw)}
    <div class="hxWide">${scoreboard({ m: mine, state, mobile, gw })}</div>
    <div class="rGrid"><div class="col">${fixtures}${state === 'live' ? '' : tp}</div>
    <aside class="rail">${table}${rec}</aside></div>`;
  return `<div class="screen ${mobile ? 'm' : 'd'}" ${dark ? 'data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;">${topbar(mobile)}<main class="wrap">${main}</main></div>`;
}

// ═══ Matchup page ════════════════════════════════════════════════════════
export function matchBar(m, state, mobile) {
  const ties = state === 'upcoming'
    ? SCHEDULE[6].map(([a, b]) => ({ a, b, on: a === m.A.k }))
    : GW5.map((t) => { const now = state === 'live' ? LIVE_NOW : null; return { a: t.A.k, b: t.B.k, va: sideAt(t.A, now).score, vb: sideAt(t.B, now).score, on: t === m }; });
  const tie = (t) => `<button class="tie${t.on ? ' tieOn' : ''}" aria-label="${tname(t.a)} v ${tname(t.b)}">${crest(t.a, 20)}${t.va != null ? `<span class="tieV${state === 'final' && t.va < t.vb - DRAW ? ' tieL' : ''}">${fmt(t.va)}</span><span class="tieDash">–</span><span class="tieV${state === 'final' && t.vb < t.va - DRAW ? ' tieL' : ''}">${fmt(t.vb)}</span>` : '<span class="tieDash">v</span>'}${crest(t.b, 20)}</button>`;
  const end = state === 'live' ? `<span class="mbEnd" style="color: var(--color-live);"><i class="ldot"></i>Live</span>` : state === 'final' ? `<span class="mbEnd">Final</span>` : `<span class="mbEnd">Sat 10 Oct</span>`;
  return `<nav class="gwb" aria-label="Gameweek ${m.gw} fixtures"><a class="mbBack">${glyph('left', 18)}Gameweek ${m.gw}</a><div class="mbTies">${ties.map(tie).join('')}</div></nav>`;
}

// ── The running score ────────────────────────────────────────────────────
function runningScoreBlock(m, state, mobile) {
  const slots = runningScore(m);
  const live = state === 'live';
  const mine = m.A.k === ME ? 'A' : 'B';
  const W = mobile ? 330 : 740, H = mobile ? 190 : 230, R = mobile ? 70 : 104, T = 14, B = 10;
  const plotW = W - R, n = slots.length, step = plotW / n;
  const done = slots.map((s) => !live || Date.parse(s.t) + 115 * 60000 <= LIVE_NOW);
  const lastDone = done.lastIndexOf(true);
  const maxV = live ? Math.max(slots[lastDone].cumA, slots[lastDone].cumB) * 1.6 : Math.max(...slots.map((s) => Math.max(s.cumA, s.cumB)));
  const top = Math.ceil(maxV / 50) * 50;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const x = (i) => (i + 0.5) * step;
  const grid = [];
  for (let v = 0; v <= top; v += 50) grid.push(`<line class="rsGrid" x1="0" x2="${plotW}" y1="${y(v)}" y2="${y(v)}"></line><text class="rsGridT" x="2" y="${y(v) - 4}">${v}</text>`);
  // the slot where the lead changed hands
  let turn = -1;
  for (let i = 1; i <= lastDone; i++) {
    const p = slots[i - 1].cumA - slots[i - 1].cumB, c = slots[i].cumA - slots[i].cumB;
    if (p !== 0 && Math.sign(p) !== Math.sign(c)) turn = i;
  }
  const path = (key) => {
    let d = `M 0 ${y(0)}`;
    for (let i = 0; i <= lastDone; i++) d += ` H ${x(i)} V ${y(slots[i]['cum' + key])}`;
    return d;
  };
  const dots = (key) => slots.slice(0, lastDone + 1).map((s, i) => `<circle class="rsDot${key}" cx="${x(i)}" cy="${y(s['cum' + key])}" r="4"></circle>`).join('');
  const endA = slots[lastDone].cumA, endB = slots[lastDone].cumB;
  const finalA = live ? endA : m.A.score, finalB = live ? endB : m.B.score;
  const ex = x(lastDone) + 10;
  let yA = y(endA) + 5, yB = y(endB) + 5;
  if (Math.abs(yA - yB) < 18) { if (yA < yB) { yA -= 9; yB += 9; } else { yA += 9; yB -= 9; } }
  const cls = (key) => (key === mine ? 'A' : 'B');
  const fut = false ? slots.slice(lastDone + 1).map((s, j) => `<circle class="rsFut" cx="${x(lastDone + 1 + j)}" cy="${y(endA)}" r="4"></circle><circle class="rsFut" cx="${x(lastDone + 1 + j)}" cy="${y(endB)}" r="4"></circle>`).join('') : '';
  const nowX = live ? (x(lastDone) + x(lastDone + 1)) / 2 : 0;
  const svg = `<svg class="rsSvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Running score across the gameweek">
    ${turn >= 0 ? `<rect class="rsSlotHi" x="${turn * step}" y="0" width="${step}" height="${H}"></rect>` : ''}
    ${grid.join('')}
    ${live ? `<line class="rsNow" x1="${nowX}" x2="${nowX}" y1="0" y2="${H}"></line><text class="rsNowT" x="${nowX + 5}" y="12">NOW</text>` : ''}
    <path class="rs${cls('B')}" d="${path('B')}"></path><path class="rs${cls('A')}" d="${path('A')}"></path>
    ${dots('B').replaceAll('rsDotB', `rsDot${cls('B')}`)}${dots('A').replaceAll('rsDotA', `rsDot${cls('A')}`)}${fut}
    <text class="rsEnd${cls('A')}" x="${ex}" y="${yA}">${fmt(finalA)}</text><text class="rsEnd${cls('B')}" x="${ex}" y="${yB}">${fmt(finalB)}</text>
  </svg>`;
  // lanes under the chart, one per kickoff slot
  const colPct = (step / W) * 100, restPct = (R / W) * 100;
  const toPlay = live ? stillToPlay(m, LIVE_NOW) : [];
  const isFutLane = (i) => live && i > lastDone;
  const lane = (s, i) => {
    const isFut = live && i > lastDone;
    const head = `<div class="rsLaneH"><span class="rsLaneT">${ukTime(s.t)}</span>${isFutLane(i) ? '<span class="rsTurnTag" style="color: var(--color-text-muted);">To Play</span>' : ''}${i === turn ? '<span class="rsTurnTag">Lead Changed</span>' : ''}</div>`;
    if (isFut) {
      const tp = toPlay.find((x) => x.t === s.t) ?? { A: [], B: [] };
      const facesOf = (arr) => arr.map((p) => face(p, 22)).join('');
      return `<div class="rsLane rsLaneFut">${head}<div class="rsGain"><span class="rsGainR"><i style="background: var(--color-accent);"></i><b>${tp[mine].length}</b><span class="rsFacesRow">${facesOf(tp[mine])}</span></span><span class="rsGainR"><i style="background: var(--color-text-primary);"></i><b>${tp[mine === 'A' ? 'B' : 'A'].length}</b><span class="rsFacesRow">${facesOf(tp[mine === 'A' ? 'B' : 'A'])}</span></span></div></div>`;
    }
    const g = (key) => {
      const v = s[key], who = s['who' + key].filter((p) => p.pts > 0 && !p.bench).slice(0, 3);
      const benchN = s['who' + key].filter((p) => p.bench && p.pts > 0).length;
      return `<span class="rsGainR"><i style="background: ${key === mine ? 'var(--color-accent)' : 'var(--color-text-primary)'};"></i><b class="${key === mine ? 'gA' : ''}">+${v.toFixed(1)}</b><span class="rsFacesRow">${who.map((p) => face(p, 22)).join('')}${benchN && !who.length ? `<span class="rsWho">Bench</span>` : ''}</span></span>`;
    };
    return `<div class="rsLane${i === turn ? ' rsLaneTurn' : ''}">${head}<div class="rsGain">${g(mine)}${g(mine === 'A' ? 'B' : 'A')}</div></div>`;
  };
  const lanes = `<div class="rsLanes" style="grid-template-columns: repeat(${n}, ${colPct}%) ${restPct}%;">${slots.map(lane).join('')}</div>`;
  const key = `<span class="rsKey"><span><i style="background: var(--color-accent);"></i>${tname(ME)}</span><span><i style="background: var(--color-text-primary);"></i>${tname(mine === 'A' ? m.B.k : m.A.k)}</span></span>`;
  return `<section class="blk"><div class="sh"><h2 class="shT">Running Score</h2><span class="shTools">${mobile ? '' : key}</span></div>
    <div class="panel"><div class="rsBody">${svg}</div>${lanes}</div></section>`;
}

// ── Match report ─────────────────────────────────────────────────────────
export function reportBlock(m, state) {
  if (state === 'live') {
    const tp = stillToPlay(m, LIVE_NOW);
    const rows = tp.map((s) => `<div class="mrCol"><span class="mrColH">${glyph('clock', 14)}${ukTime(s.t)}</span>
      ${[['A', m.A.k], ['B', m.B.k]].map(([key, k]) => `<div class="h2FR">${crest(k, 16)}<span class="nm">${s[key].map((p) => p.name).join(', ') || 'Nobody'}</span><span class="lbl">${s[key].length}</span></div>`).join('')}</div>`).join('');
    return `<section class="blk"><div class="sh"><h2 class="shT">Still to Play</h2></div><div class="panel"><div class="mrBody" style="gap: 0;">${rows.replace('class="mrCol"', 'class="mrCol" style="border-top: 0; padding-top: 0;"')}</div></div></section>`;
  }
  const r = m.report;
  const named = [...m.A.starters, ...m.B.starters].filter((p) => (r.starHighlight + r.disappointmentHighlight).includes(p.name.replace(/^[A-Z]\./, '')));
  return `<section class="blk"><div class="sh"><span class="fstack">${named.slice(0, 2).map((p) => face(p, 34)).join('')}</span><h2 class="shT">Match Report</h2></div><div class="panel"><div class="mrBody">
    <h3 class="mrHead">${bold(r.headline)}</h3><p class="mrLead">${bold(r.leadParagraph)}</p>
    <div class="mrCol"><span class="mrColH">${glyph('star', 14)}Star of the Match</span><p>${bold(r.starHighlight)}</p></div>
    <div class="mrCol"><span class="mrColH">${glyph('down', 14)}Boardroom Notes</span><p>${bold(r.disappointmentHighlight)}</p></div>
    <span class="mrBy">${esc(r.byline)}</span></div></div></section>`;
}

// ── The pitch chip ───────────────────────────────────────────────────────
export function playStatus(p, state) {
  if (state === 'upcoming') return 'pend';
  const own = p.subIn ? p.replaced : p;
  if (state === 'live' && !finishedAt(own.fixture, LIVE_NOW)) return 'pend';
  return p.mins > 0 || p.subIn ? 'played' : 'dnp';
}
export function pitchChip(p, state, size = 'cmp', withRating = true) {
  const st = playStatus(p, state);
  const badge = st === 'pend' ? '<span class="pts pts-pend">–</span>' : st === 'dnp' ? '<span class="pts pts-dnp">DNP</span>' : ptsBadge(p.pts);
  const fx = p.fixture;
  const ev = esc(p.stats.split(' · ').filter((t) => !/x[GA]|rating/.test(t)).join(' · '));
  const line = st === 'pend' && fx ? `<b>${fx.opponentShort}</b> ${size === 'xs' ? ukTime(fx.kickoffTime).slice(4) : ukTime(fx.kickoffTime)}` : st === 'dnp' ? 'Did not play' : ev || '&nbsp;';
  const rt = withRating && st === 'played' && p.rating != null ? `<span class="chRt"><b>${Number(p.rating).toFixed(2)}</b> rating</span>` : '';
  return `<button class="ch${st === 'pend' ? ' chPend' : st === 'dnp' ? ' chDnp' : ''}" aria-label="${p.name}, ${p.slot}">
    <span class="chPor">${p.subIn ? `<span class="chSub" title="Auto-subbed in">${glyph('up', 12)}</span>` : ''}${portrait(p, size)}${badge}</span>
    <span class="chBox">${chip(p.slot)}<span class="chName">${p.name}</span><span class="chStats">${line}</span>${rt}</span></button>`;
}

// Lateral order inside a line: left-sided slots first
export const LAT = { LB: 0, LWB: 0, LW: 0, CB: 1, DM: 1, CM: 1, AM: 1, ST: 1, GK: 1, RB: 2, RWB: 2, RW: 2 };
export const ORDER = ['GK', 'DEF', 'WBZ', 'DMZ', 'CMZ', 'AMZ', 'ATT'];
export function lines(side) {
  const z = {};
  for (const p of side.starters) (z[zoneOf(p.slot)] ??= []).push(p);
  for (const k in z) z[k].sort((a, b) => LAT[a.slot] - LAT[b.slot]);
  return z;
}
export function spread(zone, n, z) {
  if (zone === 'WBZ' && n === 2) return [12, 88];
  if (zone === 'CMZ' && n === 2 && z.DMZ?.length === 1) return [29, 71];
  if (zone === 'ATT' && n === 3) return [22, 50, 78];
  const st = n === 1 ? 0 : Math.min(19.5, 78 / (n - 1));
  return Array.from({ length: n }, (_, i) => 50 + (i - (n - 1) / 2) * st);
}

// One match pitch, horizontal: you attack right, they attack left.
const XH = { GK: 5.2, DEF: 15.5, WBZ: 21, DMZ: 25.5, CMZ: 31.5, AMZ: 37, ATT: 45.8 };
function pitchH(m, state) {
  const nodes = [];
  for (const [side, home] of [[m.A, true], [m.B, false]]) {
    const z = lines(side);
    for (const zone of ORDER) {
      const ps = z[zone]; if (!ps) continue;
      const ys = spread(zone, ps.length, z);
      ps.forEach((p, i) => {
        const xx = home ? XH[zone] : 100 - XH[zone];
        const yy = home ? ys[i] : 100 - ys[i];
        nodes.push(`<span class="paP" style="left: ${xx}%; top: ${yy}%;">${pitchChip(p, state)}</span>`);
      });
    }
  }
  return `<div class="pa" style="height: 790px;"><div class="paLines"><span class="paHalf"></span><span class="paCircle"></span><span class="paSpot"></span><span class="paBox paBoxL"></span><span class="paBox paBoxR"></span><span class="paGoal paGoalL"></span><span class="paGoal paGoalR"></span><span class="paArc paArcL"></span><span class="paArc paArcR"></span></div>${nodes.join('')}</div>`;
}
// Vertical on a phone: you at the bottom attacking up, they at the top.
const YV = { GK: 94.2, DEF: 85, WBZ: 81, DMZ: 75.4, CMZ: 69.6, AMZ: 64.2, ATT: 58.4 };
function pitchV(m, state, H) {
  const nodes = [];
  const mineBottom = m.A.k === ME ? m.A : m.B, other = mineBottom === m.A ? m.B : m.A;
  for (const [side, home] of [[mineBottom, true], [other, false]]) {
    const z = lines(side);
    for (const zone of ORDER) {
      const ps = z[zone]; if (!ps) continue;
      const xs = spread(zone, ps.length, z).map((v) => 50 + (v - 50) * (ps.length >= 5 ? 0.92 : 1));
      ps.forEach((p, i) => {
        const xx = home ? xs[i] : 100 - xs[i];
        const yy = home ? YV[zone] : 100 - YV[zone];
        nodes.push(`<span class="paP" style="left: ${xx}%; top: ${yy}%;">${pitchChip(p, state, 'xs', false)}</span>`);
      });
    }
  }
  return `<div class="pv" style="height: ${H}px;"><div class="pvLines"><span class="pvHalf"></span><span class="pvCircle"></span><span class="pvBox pvBoxT"></span><span class="pvBox pvBoxB"></span></div>${nodes.join('')}</div>`;
}
// The shipped two half-pitches, kept: each club's half, attacking up.
const FLEX = { ATT: 1.1, AMZ: 1.52, CMZ: 1.05, DMZ: 1.05, WBZ: 1.05, DEF: 1.22, GK: 1.15 };
export function halfPitch(side, state, mobile, H = mobile ? 660 : 880, label = true) {
  return halves({ A: side, B: side }, state, mobile, H, label, true);
}
export function halves(m, state, mobile, Hopt, label = true, single = false) {
  const half = (side) => {
    const z = lines(side);
    const zones = ORDER.slice().reverse().filter((k) => z[k]);
    const tot = zones.reduce((s, k) => s + FLEX[k], 0);
    let acc = 0;
    const H = Hopt ?? (mobile ? 660 : 880), top = mobile ? 50 : 56, bot = mobile ? 62 : 96;
    const nodes = [];
    for (const zone of zones) {
      const c = acc + FLEX[zone] / 2; acc += FLEX[zone];
      const yy = top + (H - top - bot) * (c / tot);
      const xs = spread(zone, z[zone].length, z);
      z[zone].forEach((p, i) => nodes.push(`<span class="paP" style="left: ${xs[i]}%; top: ${yy}px;">${pitchChip(p, state, mobile ? 'xs' : 'cmp', false)}</span>`));
    }
    return `<div class="ph"><div class="phField${mobile ? ' phM' : ''}" style="height: ${H}px;"><span class="phTop"></span><span class="phCircle"></span><span class="phBox"></span><span class="phGoal"></span>${label ? `<span class="phLabel">${crest(side.k, 18)}${tname(side.k)}</span>` : ''}${nodes.join('')}</div></div>`;
  };
  if (single) return half(m.A);
  return `<div class="phGrid">${half(m.A)}${half(m.B)}</div>`;
}

export function benchOne(side, state, mobile) {
  return benches({ A: side, B: side }, state, mobile, true);
}
export function benches(m, state, mobile, single = false) {
  const b = (side) => {
    const now = state === 'live' ? LIVE_NOW : null;
    const s = state === 'upcoming' ? null : sideAt(side, now);
    const chips = side.bench.map((p) => {
      const st = state === 'upcoming' || (state === 'live' && !finishedAt(p.fixture, LIVE_NOW)) ? 'pend' : p.mins > 0 ? 'played' : 'dnp';
      const badge = st === 'pend' ? '<span class="pts pts-pend">–</span>' : st === 'dnp' ? '<span class="pts pts-dnp">DNP</span>' : ptsBadge(p.pts);
      const line = st === 'pend' ? `<b>${p.fixture.opponentShort}</b> ${mobile ? ukTime(p.fixture.kickoffTime).slice(4) : ukTime(p.fixture.kickoffTime)}` : st === 'dnp' ? 'Did not play' : `<b>+${fmt(p.credit)}</b> to total`;
      return `<div class="bnSlot"><button class="ch${st === 'pend' ? ' chPend' : st === 'dnp' ? ' chDnp' : ''}"><span class="chPor">${portrait({ ...p, slot: p.pos }, mobile ? 'xs' : 'cmp')}${badge}</span><span class="chBox">${chip(p.pos)}<span class="chName">${p.name}</span><span class="chStats">${line}</span></span></button><span class="bnCat">${p.benchSlot}</span></div>`;
    }).join('');
    return `<div class="bnSide"><div class="bnH">${crest(side.k, 18)}<span class="bnT">Bench</span>${s ? `<span class="bnBonus">Bench Bonus <b>+${fmt(s.bench)}</b></span>` : `<span class="bnBonus">25% of each unused player’s points</span>`}</div><div class="bnChips">${chips}</div></div>`;
  };
  if (single) return b(m.A);
  return `<div class="bnRow">${b(m.A)}${b(m.B)}</div>`;
}

function lineupsBlock(m, state, mobile, variant) {
  const keyNode = `<span class="lnKey">${[0, 2, 5.6, 15.8, 29].map((v) => ptsBadge(v === 0 ? 0 : v)).join('')}</span>`;
  const head = mobile
    ? ''
    : `<div class="bdHead" style="border-bottom: 1px solid var(--color-border);">${crest(m.A.k, 22)}<span class="bdName">${tname(m.A.k)}</span><span class="lbl" style="margin-left: 4px;">${m.A.formation}</span><span style="margin-left: auto;"></span><span class="lbl" style="margin-right: 4px;">${m.B.formation}</span><span class="bdName">${tname(m.B.k)}</span>${crest(m.B.k, 22)}</div>`;
  let grass;
  if (variant === 'halves') grass = halves(m, state, mobile);
  else if (mobile) {
    const mineK = m.A.k === ME ? m.A : m.B, oth = mineK === m.A ? m.B : m.A;
    grass = `<div class="bdHead">${crest(oth.k, 20)}<span class="bdName" style="font-size: 16px;">${tname(oth.k)}</span><span class="lbl" style="margin-left: auto;">${oth.formation}</span></div>${pitchV(m, state, 1180)}<div class="bdHead" style="border-top: 1px solid var(--color-border);">${crest(mineK.k, 20)}<span class="bdName" style="font-size: 16px;">${tname(mineK.k)}</span><span class="lbl" style="margin-left: auto;">${mineK.formation}</span></div>`;
  } else grass = pitchH(m, state);
  return `<section class="blk"><div class="sh"><h2 class="shT">Lineups</h2><span class="shTools">${mobile ? '' : keyNode}</span></div>
    <div class="board">${variant === 'halves' || mobile ? '' : head}${grass}${benches(m, state, mobile)}</div></section>`;
}

// ── Points breakdown ─────────────────────────────────────────────────────
export const BAND = { poor: 'bPoor', low: 'bLow', mid: 'bMid', good: 'bGood', best: 'bBest', elite: 'bBest', supreme: 'bBest' };
export const sig = (perf) => `<span class="sig ramp" aria-hidden="true">${perf.map((g) => `<i class="${BAND[g.band] ?? 'bMid'}" style="height: ${Math.round(3 + g.width / 100 * 13)}px;"></i>`).join('')}</span>`;
export function perfBlock(p) {
  return `<div class="pb ramp">${p.perf.map((g) => `<div class="pbRow ${BAND[g.band] ?? 'bMid'}"><span class="pbL">${g.label}</span><span class="pbTr"><span class="pbBar"><span class="pbInk" style="width: ${g.width}%;"></span></span><span class="pbTick"></span></span><span class="pbV">${g.verdict}</span>${g.evidence || g.rank ? `<span class="pbEv">${[g.evidence, g.rank].filter(Boolean).join(' · ')}</span>` : ''}</div>`).join('')}<p class="pbNote">Centre line is the median for ${/^[AEIOU]/.test(p.slot) ? 'an' : 'a'} ${p.slot}</p></div>`;
}
function breakdownPanel(side, state, openName) {
  const now = state === 'live' ? LIVE_NOW : null;
  const s = sideAt(side, now);
  const rows = side.starters.slice().sort((a, b) => ORDER.indexOf(zoneOf(a.slot)) - ORDER.indexOf(zoneOf(b.slot)) || LAT[a.slot] - LAT[b.slot]).map((p) => {
    const st = playStatus(p, state);
    const open = p.name === openName && p.perf;
    const fx = p.fixture;
    const statTxt = st === 'pend' ? `${fx.opponent} · ${ukTime(fx.kickoffTime)}` : st === 'dnp' ? `Did not play · no bench cover` : (p.subIn ? `On for ${p.replaced.name} · ` : '') + (p.stats || '');
    const pts = st === 'pend' ? '<span class="bdP bdP0">–</span>' : st === 'dnp' ? '<span class="bdP bdP0">0.00</span>' : `<span class="bdP">${fmt(p.pts)}</span>`;
    return `<div class="bdE${open ? ' bdOpen' : ''}"><div class="bdR" role="button" tabindex="0" aria-expanded="${open ? 'true' : 'false'}">${chip(p.slot)}${portrait(p, 'sm', false)}<span class="bdTx"><span class="bdN">${p.name}${p.subIn ? glyph('up', 12) : ''}</span><span class="bdS">${esc(statTxt)}</span></span>${p.perf && st === 'played' ? sig(p.perf) : '<span></span>'}${pts}</div>${open ? perfBlock(p) : ''}</div>`;
  }).join('');
  return `<div class="panel"><div class="bdHead">${crest(side.k, 22)}<span class="bdName">${tname(side.k)}</span><span class="bdTot">${fmt(s.score)}</span></div>
    <div class="bdH lbl"><span>Pos</span><span></span><span>Player</span><span>Match</span><span>Pts</span></div>${rows}
    <div class="bdSum"><span>Starting XI</span><b>${fmt(s.xi)}</b></div>
    <div class="bdSum"><span>Bench Bonus (25%)</span><b>${fmt(s.bench)}</b></div>
    <div class="bdSum bdTotal"><span>Total</span><b>${fmt(s.score)}</b></div></div>`;
}
function breakdownBlock(m, state, mobile) {
  if (mobile) {
    const mineS = m.A.k === ME ? m.A : m.B, oth = mineS === m.A ? m.B : m.A;
    return `<section class="blk"><div class="sh"><h2 class="shT">Points Breakdown</h2></div><div class="segRow"><span class="seg"><button class="segB segOn">${tname(mineS.k)}</button><button class="segB">${tname(oth.k)}</button></span></div>${breakdownPanel(mineS, state, 'Cunha')}</section>`;
  }
  return `<section class="blk"><div class="sh">${cstack([m.A.k, m.B.k])}<h2 class="shT">Points Breakdown</h2></div><div class="bdGrid">${breakdownPanel(m.A, state, 'Cunha')}${breakdownPanel(m.B, state, 'Isak')}</div></section>`;
}

// ── Head-to-head ─────────────────────────────────────────────────────────
export function h2hBlock(m, state) {
  const [x, y] = [m.A.k, m.B.k];
  const meets = RESULTS.filter(([, a, , b]) => (a === x && b === y) || (a === y && b === x));
  const mine = x === ME ? x : y, oth = mine === x ? y : x;
  const recs = meets.map(([gw, a, sa, b, sb]) => ({ gw, my: a === mine ? sa : sb, opp: a === mine ? sb : sa }));
  const W = recs.filter((r) => res(r.my, r.opp) === 'W').length, D = recs.filter((r) => res(r.my, r.opp) === 'D').length, L = recs.length - W - D;
  const next = Object.entries(SCHEDULE).find(([g, fx]) => +g > m.gw && fx.some(([a, b]) => (a === x && b === y) || (a === y && b === x)));
  const rows = recs.map((r) => `<div class="h2M"><span class="h2Gw">GW${r.gw}</span><span class="h2Sc">${fmt(r.my)} <span class="l">–</span> ${fmt(r.opp)}</span><span class="h2Who">${r.gw === m.gw && state !== 'upcoming' ? '<span class="h2Now">This Match</span>' : `${res(r.my, r.opp) === 'W' ? 'Won' : res(r.my, r.opp) === 'L' ? 'Lost' : 'Drew'} by ${fmt(Math.abs(r.my - r.opp))}`}</span><span class="res ${res(r.my, r.opp)}">${res(r.my, r.opp)}</span></div>`).join('')
    + (next ? `<div class="h2M"><span class="h2Gw">GW${next[0]}</span><span class="h2Sc" style="color: var(--color-text-muted); font-weight: 600;">Next Meeting</span><span></span><span></span></div>` : '');
  const upto = state === 'upcoming' ? 5 : 4;
  const note = recs.length === 0 ? 'First meeting between these two clubs.' : state === 'upcoming' ? `You beat ${tname(oth)} by ${fmt(recs[0].my - recs[0].opp)} in Gameweek ${recs[0].gw}.` : recs.length === 1 && recs[0].gw === m.gw ? 'The first meeting between these two clubs.' : '';
  return `<section class="blk"><div class="sh">${cstack([mine, oth])}<h2 class="shT">Head-to-Head</h2></div><div class="panel h2">
    <div class="h2Rec"><div class="h2Big"><div><b>${W}</b><span>Won</span></div><div><b>${D}</b><span>Drawn</span></div><div><b>${L}</b><span>Lost</span></div></div><p class="h2Note">${note}</p></div>
    <div class="h2List">${rows}</div>
    <div class="h2Form"><span class="lbl">Form${state === 'upcoming' ? '' : ' Before This Match'}</span>${[mine, oth].map((k) => `<div class="h2FR">${crest(k, 18)}<span class="nm">${tname(k)}</span>${formDots(k, upto, 'frmL')}</div>`).join('')}</div>
  </div></section>`;
}

export function matchPage({ state, mobile, dark, w, variant }) {
  const m = state === 'upcoming' ? GW6 : GW5[0];
  const sb = scoreboard({ m, state, big: true, mobile, gw: m.gw });
  let body;
  if (state === 'upcoming') {
    body = `${sb}<div class="stl">${h2hBlock(m, state)}</div><div class="stl">${lineupsBlock(m, state, mobile, variant)}</div>`;
  } else {
    const story = `<div class="story">${runningScoreBlock(m, state, mobile)}${reportBlock(m, state)}</div>`;
    body = `${sb}<div class="stl">${story}</div><div class="stl">${lineupsBlock(m, state, mobile, variant)}</div><div class="stl">${breakdownBlock(m, state, mobile)}</div>${state === 'final' ? `<div class="stl">${h2hBlock(m, state)}</div>` : ''}`;
  }
  return `<div class="screen ${mobile ? 'm' : 'd'}" ${dark ? 'data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;">${topbar(mobile)}<main class="wrap">${matchBar(m, state, mobile)}${body}</main></div>`;
}
