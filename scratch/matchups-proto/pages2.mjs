// Round two: objects built from what a matchup is — two clubs, one weekend,
// a margin and a draw band — rather than parts lifted from other pages.
import {
  TEAMS, ME, DRAW, RESULTS, SCHEDULE, form, tableWithMove, table, recordOf, ordinal, zoneOf, GW5, GW6, LIVE_NOW,
  finishedAt, sideAt, runningScore, stillToPlay, ROUND_SLOTS, byLine, LINES, roundAll, SEASON_TOP, fmt, res,
} from './model.mjs';
import { crest, tname, glyph, chip, portrait, face, ptsBadge, ukTime } from './lib.mjs';
import { sig } from './pages.mjs';
import { rowPitch, rowCount } from './pitchrows.mjs';
import {
  esc, bold, topbar, gwBar, scoreboard, matchBar, reportBlock, playStatus, pitchChip, lines, spread, benches,
  perfBlock, h2hBlock, halves, halfPitch, benchOne, ticks, BAND, ORDER, LAT,
} from './pages.mjs';

const slotDone = (t, now) => now == null || Date.parse(t) + 115 * 60000 <= now;
const other = (m) => (m.A.k === ME ? m.B : m.A);

// ── The margin worm ──────────────────────────────────────────────────────
// Home's lead above the line, away's below; the ±10 band is where a result
// would be a draw. Area takes each club's own colour.
let wormN = 0;
function worm(m, { W, H, scale, now = null, slots = ROUND_SLOTS, dark = false, labels = false, turnTag = false, pad = 0 }) {
  const id = `wm${++wormN}`;
  const rs = runningScore(m, slots);
  const n = rs.length, step = W / n;
  const x = (i) => (i + 0.5) * step;
  const mid = H / 2, half = H / 2 - pad;
  const y = (v) => mid - Math.max(-1, Math.min(1, v / scale)) * half;
  const done = rs.map((s) => slotDone(s.t, now));
  const last = done.lastIndexOf(true);
  let d = `M 0 ${y(0)}`;
  for (let i = 0; i <= last; i++) d += ` H ${x(i)} V ${y(rs[i].cumA - rs[i].cumB)}`;
  const endX = now == null ? W : x(last) + step / 2;
  d += ` H ${endX}`;
  const area = `${d} V ${y(0)} H 0 Z`;
  const cA = TEAMS[m.A.k].color, cB = TEAMS[m.B.k].color;
  const op = dark ? 0.55 : 0.34;
  let turn = -1;
  for (let i = 1; i <= last; i++) { const p = rs[i - 1].cumA - rs[i - 1].cumB, c = rs[i].cumA - rs[i].cumB; if (p && Math.sign(p) !== Math.sign(c)) turn = i; }
  const ink = dark ? '#fff' : 'var(--color-text-primary)';
  const bandFill = dark ? 'rgba(255,255,255,.08)' : 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)';
  const bandEdge = dark ? 'rgba(255,255,255,.45)' : 'var(--color-text-muted)';
  const grid = slots.map((_, i) => `<line x1="${x(i)}" x2="${x(i)}" y1="${pad}" y2="${H - pad}" stroke="${dark ? 'rgba(255,255,255,.08)' : 'var(--color-border-subtle)'}" stroke-width="1"></line>`).join('');
  const lastV = rs[last].cumA - rs[last].cumB;
  return `<svg class="wm" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Margin through the weekend">
    <defs><clipPath id="${id}a"><rect x="0" y="0" width="${W}" height="${y(0)}"></rect></clipPath><clipPath id="${id}b"><rect x="0" y="${y(0)}" width="${W}" height="${H - y(0)}"></rect></clipPath></defs>
    ${grid}
    ${turn >= 0 && turnTag ? `<rect x="${turn * step}" y="0" width="${step}" height="${H}" fill="${dark ? 'rgba(255,255,255,.05)' : 'color-mix(in oklab, var(--color-text-primary) 5%, transparent)'}"></rect>` : ''}
    <rect x="0" y="${y(DRAW)}" width="${W}" height="${y(-DRAW) - y(DRAW)}" fill="${bandFill}"></rect>
    <line x1="0" x2="${W}" y1="${y(DRAW)}" y2="${y(DRAW)}" stroke="${bandEdge}" stroke-width="1" stroke-dasharray="3 3"></line>
    <line x1="0" x2="${W}" y1="${y(-DRAW)}" y2="${y(-DRAW)}" stroke="${bandEdge}" stroke-width="1" stroke-dasharray="3 3"></line>
    <path d="${area}" fill="${cA}" fill-opacity="${op}" clip-path="url(#${id}a)"></path>
    <path d="${area}" fill="${cB}" fill-opacity="${op}" clip-path="url(#${id}b)"></path>
    <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="${ink}" stroke-opacity=".35" stroke-width="1"></line>
    <path d="${d}" fill="none" stroke="${ink}" stroke-width="2" stroke-linejoin="round"></path>
    <circle cx="${endX}" cy="${y(lastV)}" r="3.5" fill="${ink}"></circle>
    ${now != null ? `<line x1="${endX}" x2="${endX}" y1="0" y2="${H}" stroke="var(--color-live)" stroke-width="1.5" stroke-dasharray="4 3"></line>` : ''}
    ${labels ? `<text x="${W - 6}" y="${y(DRAW) - 5}" text-anchor="end" class="wmT">Draw band ±10</text>` : ''}
  </svg>`;
}

// Players each side has in each kickoff slot, for a weekend that has not started.
function weekendDots(m, W, H, slots) {
  const n = slots.length, step = W / n;
  const count = (side, t) => side.starters.filter((p) => p.fixture?.kickoffTime === t).length;
  const dots = slots.map((t, i) => {
    const cx = (i + 0.5) * step;
    const a = count(m.A, t), b = count(m.B, t);
    const col = (k, v, up) => Array.from({ length: v }, (_, j) => `<circle cx="${cx}" cy="${H / 2 + (up ? -1 : 1) * (8 + j * 9)}" r="3.5" fill="${TEAMS[k].color}"></circle>`).join('');
    return col(m.A.k, a, true) + col(m.B.k, b, false);
  }).join('');
  return `<svg class="wm" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Players in each kickoff slot"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--color-border-strong)" stroke-width="1"></line>${dots}</svg>`;
}

// ── Fixtures: every tie on one weekend clock ─────────────────────────────
function slotsFor(state) {
  if (state !== 'upcoming') return ROUND_SLOTS;
  const all = [...GW6.A.starters, ...GW6.B.starters].map((p) => p.fixture.kickoffTime);
  return [...new Set(all)].sort((a, b) => Date.parse(a) - Date.parse(b));
}
function ruler(slots, now, mobile) {
  const lab = (t) => (mobile ? ukTime(t).replace(' ', ' ') : ukTime(t));
  return `<div class="fsRuler">${slots.map((t) => `<span class="${now != null && !slotDone(t, now) ? 'fsFut' : ''}">${lab(t)}</span>`).join('')}</div>`;
}
function strip(m, state, mobile, WW) {
  const now = state === 'live' ? LIVE_NOW : null;
  const up = state === 'upcoming';
  const sA = up ? null : sideAt(m.A, now), sB = up ? null : sideAt(m.B, now);
  const a = sA?.score ?? 0, b = sB?.score ?? 0;
  const done = state === 'final';
  const lose = (v, o) => done && Math.abs(v - o) > DRAW && v < o;
  const mine = m.A.k === ME || m.B.k === ME;
  const meta = (k, s) => (state === 'live' ? `<span class="fsMeta">${ticks(s.played)}</span>` : `<span class="fsMeta">${ordinal(recordOf(k, 5).rank)} · ${recordOf(k, 5).line}</span>`);
  const slots = slotsFor(state);
  const mid = up ? weekendDots(m, WW, 64, slots) : worm(m, { W: WW, H: 64, scale: 60, now, slots });
  const v = (val, o, cls) => (up ? '' : `<span class="fsV ${cls}${lose(val, o) ? ' fsLose' : ''}">${fmt(val)}</span>`);
  const side = (k, s, val, o, away) => `<div class="fsSide${away ? ' fsAway' : ''}">${crest(k, mobile ? 28 : 34)}<span class="fsTx"><span class="fsName">${tname(k)}</span>${meta(k, s)}</span>${v(val, o, away ? 'fsVB' : 'fsVA')}</div>`;
  const verdictTxt = up ? '' : Math.abs(a - b) <= DRAW ? (done ? 'Draw' : 'Level') : `${tname(a > b ? m.A.k : m.B.k)} ${done ? 'by' : '+'} ${fmt(Math.abs(a - b))}`;
  if (mobile) {
    return `<a class="fs fsM${mine ? ' fsMine' : ''}">${side(m.A.k, sA, a, b)}${side(m.B.k, sB, b, a)}<div class="fsWorm">${mid}</div></a>`;
  }
  return `<a class="fs${mine ? ' fsMine' : ''}">${side(m.A.k, sA, a, b)}<div class="fsWorm">${mid}${up ? '' : `<span class="fsVerdict">${state === 'live' ? '<i class="ldot" style="color: var(--color-live);"></i>' : ''}${verdictTxt}</span>`}</div>${side(m.B.k, sB, b, a, true)}</a>`;
}
function fixturesBlock(state, mobile) {
  const now = state === 'live' ? LIVE_NOW : null;
  const ms = state === 'upcoming'
    ? SCHEDULE[6].map(([a, b]) => (a === GW6.A.k && b === GW6.B.k ? GW6 : { A: { k: a, starters: [] }, B: { k: b, starters: [] } }))
    : GW5;
  const WW = mobile ? 326 : 520;
  const slots = slotsFor(state);
  const key = `<span class="fsKey"><span>Above the line, home leads</span><span><i class="fsKeyBand"></i>Draw band</span><span>Below, away leads</span></span>`;
  const head = mobile ? '' : `<div class="fsHead"><span class="lbl">Home</span><div class="fsHeadMid">${ruler(slots, now)}</div><span class="lbl" style="text-align: right;">Away</span></div>`;
  return `<section class="blk"><div class="sh"><h2 class="shT">Fixtures</h2><span class="shTools">${mobile ? '' : state === 'upcoming' ? `<span class="fsKey"><span><i class="fsKeyDot"></i>Starters in each kickoff</span></span>` : key}</span></div>
    <div class="panel">${head}${mobile ? `<div class="fsRulerM">${ruler(slots, now, true)}</div>` : ''}${ms.map((m) => (m.A.starters.length ? strip(m, state, mobile, WW) : emptyStrip(m, mobile))).join('')}</div></section>`;
}
function emptyStrip(m, mobile) {
  const side = (k, away) => `<div class="fsSide${away ? ' fsAway' : ''}">${crest(k, mobile ? 28 : 34)}<span class="fsTx"><span class="fsName">${tname(k)}</span><span class="fsMeta">${ordinal(recordOf(k, 5).rank)} · ${recordOf(k, 5).line}</span></span></div>`;
  return `<a class="fs${mobile ? ' fsM' : ''}">${side(m.A.k)}<div class="fsWorm fsNone">Lineups lock at each player’s kickoff</div>${side(m.B.k, true)}</a>`;
}

// ── Round records: every club's score on one scale ───────────────────────
function recordsBlock(mobile) {
  const rows = RESULTS.filter((r) => r[0] === 5);
  const scores = rows.flatMap(([, a, sa, b, sb]) => [[a, sa], [b, sb]]).sort((x, y) => x[1] - y[1]);
  const lo = 100, hi = 240;
  const pct = (v) => ((v - lo) / (hi - lo)) * 100;
  const top = scores.at(-1);
  const close = rows.slice().sort((x, y) => Math.abs(x[2] - x[4]) - Math.abs(y[2] - y[4]))[0];
  const season = RESULTS.flatMap(([g, a, sa, b, sb]) => [[a, sa, g], [b, sb, g]]).reduce((x, y) => (y[1] > x[1] ? y : x));
  const scaleW = mobile ? 306 : 760, gapMin = mobile ? 44 : 60;
  const tierLast = [-1e9, -1e9, -1e9];
  const pins = scores.map(([k, v]) => {
    const px = pct(v) / 100 * scaleW;
    let tier = tierLast.findIndex((lx) => px - lx >= gapMin); if (tier < 0) tier = 2;
    tierLast[tier] = px;
    return `<span class="rsPin rsPinUp${k === ME ? ' rsPinMe' : ''}${k === top[0] ? ' rsPinTop' : ''}" style="left: ${pct(v)}%; bottom: ${98 + tier * (mobile ? 50 : 56)}px; --stem: ${8 + tier * (mobile ? 50 : 56)}px;"><span class="rsPinC">${crest(k, mobile ? 18 : 22)}</span><span class="rsPinV">${fmt(v)}</span></span>`;
  }).join('');
  const [c1, c2] = [close[2], close[4]].sort((a, b) => a - b);
  const ticksAx = [100, 140, 180, 220].map((v) => `<span class="rsTickAx" style="left: ${pct(v)}%;">${v}</span>`).join('');
  const lead = `<b>${tname(top[0])}</b> set the pace with ${fmt(top[1])}. <b>${tname(close[1])}</b> edged out <b>${tname(close[3])}</b> by ${fmt(Math.abs(close[2] - close[4]))}, the closest duel of the week.`;
  return `<section class="blk"><div class="sh"><h2 class="shT">Round Records</h2></div><div class="panel rrPanel">
    <div class="rrLeft"><p class="rrLead2">${lead}</p>
      <div class="rrFigs"><span><b>${fmt(top[1])}</b>Highest Score</span><span><b>${fmt(Math.abs(close[2] - close[4]))}</b>Closest Match</span><span><b>${fmt(season[1])}</b>Season High</span></div></div>
    <div class="rrBars">
      ${scores.slice().reverse().map(([k, v]) => `<div class="rrBar${k === ME ? ' rrBarMe' : ''}">${crest(k, 18)}<span class="rrBarN">${tname(k)}</span><span class="rrBarT"><i style="width: ${(v / 240) * 100}%;"></i></span><b>${fmt(v)}</b></div>`).join('')}
    </div>
  </div></section>`;
}

// ── Top performers: the whole round's spread, and who led it ─────────────
function spreadBlock(mobile) {
  const all = roundAll();
  const W = mobile ? 326 : 740, H = 118, r = 4.5, maxV = 45;
  const x = (v) => 14 + (Math.min(v, maxV) / maxV) * (W - 28);
  const placed = [];
  const top = all.slice().sort((a, b) => b.pts - a.pts).slice(0, 6);
  const topIds = new Map(top.map((p, i) => [p.id + p.owner, i + 1]));
  // a dot plot: one-point bins, dots stacked up from the axis, two abreast
  const bins = new Map();
  for (const p of all.slice().sort((a, b) => a.pts - b.pts)) {
    const b = Math.min(Math.floor(p.pts / 1.5), Math.floor(maxV / 1.5));
    const n = bins.get(b) ?? 0; bins.set(b, n + 1);
    const cx = x(b * 1.5 + 0.75) + (n % 2 ? r + 0.5 : -(r + 0.5));
    const cy = (H / 2 - 22) - Math.floor(n / 2) * (2 * r + 1);
    placed.push({ cx, cy, p });
  }
  const dots = placed.map(({ cx, cy, p }) => {
    const rank = topIds.get(p.id + p.owner);
    const cls = p.owner === ME ? 'spMe' : 'spOther';
    if (rank) return `<g><circle cx="${cx}" cy="${H / 2 + cy - 4}" r="9" class="${cls} spTop"></circle><text x="${cx}" y="${H / 2 + cy - 0.5}" text-anchor="middle" class="spN">${rank}</text></g>`;
    return `<circle cx="${cx}" cy="${H / 2 + cy}" r="${r}" class="${cls}"></circle>`;
  }).join('');
  const axis = [0, 10, 20, 30, 40].map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="4" y2="${H - 22}" class="spGrid"></line><text x="${x(v)}" y="${H - 4}" text-anchor="middle" class="spAx">${v}</text>`).join('');
  const svg = `<svg class="sp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Every starter’s points this round">${axis}${dots}</svg>`;
  const list = top.map((p, i) => {
    const m = GW5.find((mm) => mm.A.k === p.owner || mm.B.k === p.owner);
    const opp = m.A.k === p.owner ? m.B.k : m.A.k;
    return `<a class="spRow"><span class="spRank">${i + 1}</span>${portrait({ ...p, slot: p.slot }, 'sm')}<span class="spTx"><span class="namerow"><b class="spName">${p.name}</b>${chip(p.slot)}</span><span class="spCtx">${crest(p.owner, 13)}${tname(p.owner)} <span class="muted">v ${tname(opp)}</span></span></span><span class="spPts">${fmt(p.pts)}</span></a>`;
  }).join('');
  const key = `<span class="fsKey"><span><i class="spKeyMe"></i>Your starters</span><span><i class="spKeyO"></i>Everyone else’s</span></span>`;
  return `<section class="blk"><div class="sh"><h2 class="shT">Top Performers</h2><span class="shTools">${mobile ? '' : key}</span></div>
    <div class="panel"><div class="spChart">${svg}<span class="spUnit">Points, all ${all.length} starters</span></div><div class="spList">${list}</div></div></section>`;
}
function seasonList(mobile) {
  return `<section class="blk"><div class="sh"><h2 class="shT">Top Performers</h2><span class="shTools"><span class="lbl">Season So Far</span></span></div><div class="panel"><div class="spList">${SEASON_TOP.map((p, i) => `<a class="spRow"><span class="spRank">${i + 1}</span>${portrait({ ...p, slot: p.pos }, 'sm')}<span class="spTx"><span class="namerow"><b class="spName">${p.name}</b>${chip(p.pos)}</span><span class="spCtx">${crest(p.owner, 13)}${tname(p.owner)} <span class="muted">· 5 apps</span></span></span><span class="spPts">${fmt(p.pts)}</span></a>`).join('')}</div></div></section>`;
}

// ── The table, as this round left it ────────────────────────────────────
function tableBlock(state) {
  const upto = state === 'upcoming' ? 5 : 5;
  const rows = tableWithMove(upto);
  const roundRes = (k) => { const f = form(k, 5).find((x) => x.gw === 5); return f ? `<span class="res ${f.r}" title="${f.r} ${fmt(f.my)}–${fmt(f.opp)}">${f.r}</span>` : '<span></span>'; };
  const mv = (n) => (n > 0 ? `<span class="stMv stUp">${glyph('up', 11)}${n}</span>` : n < 0 ? `<span class="stMv stDn">${glyph('down', 11)}${-n}</span>` : `<span class="stMv stEq">–</span>`);
  return `<section class="blk"><div class="sh"><h2 class="shT">Standings</h2></div>
    <div class="panel"><div class="tbH lbl"><span>#</span><span></span><span></span><span>Club</span><span>GW5</span><span>W-D-L</span><span>Pts</span></div>
    ${rows.map((r) => `<a class="tbR${r.k === ME ? ' stMine' : ''}"><span class="stRk">${r.rank}</span>${mv(r.move)}${crest(r.k, 18)}<span class="stName">${tname(r.k)}</span>${roundRes(r.k)}<span class="stNum">${r.W}-${r.D}-${r.L}</span><span class="stPts">${r.pts}</span></a>`).join('')}
    <div class="stFoot"><span>Arrows show movement this round</span><a class="quiet">Full Table${glyph('right', 13)}</a></div></div></section>`;
}

export function roundPage2({ state, mobile, dark, w }) {
  const gw = state === 'upcoming' ? 6 : 5;
  const liveGw = state === 'live' ? 5 : null;
  const mine = state === 'upcoming' ? GW6 : GW5[0];
  const lower = state === 'final'
    ? `<div class="r2Grid"><div>${spreadBlock(mobile)}</div><div>${tableBlock(state)}</div></div>`
    : state === 'live'
      ? `<div class="r2Grid"><div>${recordsLive(mobile)}</div><div>${tableBlock(state)}</div></div>`
      : `<div class="r2Grid"><div>${seasonList(mobile)}</div><div>${tableBlock(state)}</div></div>`;
  const main = `${gwBar(gw, mobile, liveGw)}
    <div class="hxWide">${scoreboard({ m: mine, state, mobile, gw })}</div>
    ${fixturesBlock(state, mobile)}
    ${state === 'final' ? `<div class="stl">${recordsBlock(mobile)}</div>` : ''}
    <div class="stl">${lower}</div>`;
  return `<div class="screen ${mobile ? 'm' : 'd'}" ${dark ? 'data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;">${topbar(mobile)}<main class="wrap">${main}</main></div>`;
}
// While the round is live, the spread so far stands in for the records.
function recordsLive(mobile) {
  return spreadBlock(mobile).replace('Top Performers</h2>', 'Top Performers So Far</h2>');
}

// ═══ Matchup page ════════════════════════════════════════════════════════

// ── Momentum: the margin across the weekend, slot by slot ────────────────
function momentumBlock(m, state, mobile) {
  const now = state === 'live' ? LIVE_NOW : null;
  const slots = runningScore(m).map((s) => s.t);
  const W = mobile ? 326 : 1150, H = mobile ? 150 : 200;
  const rs = runningScore(m, slots);
  const svg = worm(m, { W, H, scale: 50, now, slots, labels: !mobile, turnTag: true, pad: 8 });
  const mine = m.A.k === ME ? 'A' : 'B';
  const last = rs.map((s) => slotDone(s.t, now)).lastIndexOf(true);
  let turn = -1;
  for (let i = 1; i <= last; i++) { const p = rs[i - 1].cumA - rs[i - 1].cumB, c = rs[i].cumA - rs[i].cumB; if (p && Math.sign(p) !== Math.sign(c)) turn = i; }
  const tp = now ? stillToPlay(m, now) : [];
  const lane = (s, i) => {
    const fut = now != null && i > last;
    const row = (key) => {
      const k = key === 'A' ? m.A.k : m.B.k;
      if (fut) {
        const who = (tp.find((x) => x.t === s.t)?.[key]) ?? [];
        return `<span class="mlR"><span class="mlSw" style="background: ${TEAMS[k].color};"></span><b class="muted">${who.length}</b><span class="rsFacesRow">${who.map((p) => face(p, 22)).join('')}</span></span>`;
      }
      const who = s['who' + key].filter((p) => p.pts > 0 && !p.bench).slice(0, 3);
      return `<span class="mlR"><span class="mlSw" style="background: ${TEAMS[k].color};"></span><b>+${s[key].toFixed(1)}</b><span class="rsFacesRow">${who.map((p) => face(p, 22)).join('')}</span></span>`;
    };
    const margin = s.cumA - s.cumB;
    const lead = !fut ? (Math.abs(margin) <= DRAW ? 'Level' : `${margin > 0 ? tname(m.A.k) : tname(m.B.k)} +${Math.abs(margin).toFixed(1)}`) : 'To Play';
    return `<div class="ml${i === turn ? ' mlTurn' : ''}${fut ? ' mlFut' : ''}"><span class="mlT">${ukTime(s.t)}</span><span class="mlLead">${i === turn ? 'Lead Changed' : lead}</span>${row('A')}${row('B')}</div>`;
  };
  const key = `<span class="fsKey"><span><i style="background: ${TEAMS[m.A.k].color};"></i>${tname(m.A.k)} ahead</span><span><i class="fsKeyBand"></i>Draw band</span><span><i style="background: ${TEAMS[m.B.k].color};"></i>${tname(m.B.k)} ahead</span></span>`;
  if (mobile) {
    const endM = rs[last].cumA - rs[last].cumB;
    const summary = turn >= 0 ? `Lead changed ${ukTime(rs[turn].t)}` : now ? `${rs.length - last - 1} kickoffs to come` : `${Math.abs(endM) <= DRAW ? 'Level' : tname(endM > 0 ? m.A.k : m.B.k) + ' led'} throughout`;
    return `<section class="blk"><div class="sh"><h2 class="shT">Momentum</h2></div>
    <div class="panel"><div class="mmChart">${svg}</div><button class="mmMore" aria-expanded="false"><span>${summary}</span><span class="mmMoreB">Show Kickoffs${glyph('chev', 14)}</span></button></div></section>`;
  }
  return `<section class="blk"><div class="sh"><h2 class="shT">Momentum</h2><span class="shTools">${key}</span></div>
    <div class="panel"><div class="mmChart">${svg}</div><div class="mmLanes" style="grid-template-columns: repeat(${slots.length}, minmax(0, 1fr));">${rs.map(lane).join('')}</div></div></section>`;
}

// ── Team sheets: both XIs, line by line ──────────────────────────────────
function sheetRow(p, state) {
  if (!p) return '<span class="tsCell tsEmpty"></span>';
  const st = playStatus(p, state);
  const fx = p.fixture;
  const sub = st === 'pend' ? `${fx.opponent} · ${ukTime(fx.kickoffTime)}` : st === 'dnp' ? 'Did not play' : (p.subIn ? `On for ${p.replaced.name}` : p.stats.split(' · ').filter((t) => !/x[GA]/.test(t)).join(' · '));
  const pts = st === 'pend' ? '<span class="tsP tsP0">–</span>' : `<span class="tsP${st === 'dnp' ? ' tsP0' : ''}">${fmt(st === 'dnp' ? 0 : p.pts)}</span>`;
  return `<span class="tsCell${p.name === 'Cunha' && state === 'final' ? ' tsOpen' : ''}">${chip(p.slot)}${portrait(p, 'sm', false)}<span class="tsTx"><b>${p.name}</b><span>${esc(sub)}</span></span>${pts}</span>`;
}
function teamSheets(m, state, mobile) {
  const now = state === 'live' ? LIVE_NOW : null;
  const up = state === 'upcoming';
  const LA = byLine(m.A), LB = byLine(m.B);
  const cnt = (p) => !up && playStatus(p, state) === 'played' ? p.pts : 0;
  const sum = (arr) => arr.reduce((s, p) => s + cnt(p), 0);
  const max = Math.max(...LINES.map((l) => Math.max(sum(LA[l]), sum(LB[l]))), 1);
  const block = (l) => {
    const a = sum(LA[l]), b = sum(LB[l]);
    const n = Math.max(LA[l].length, LB[l].length);
    const bar = up ? '' : `<span class="tsBar"><i class="tsBarA" style="width: ${(a / max) * 50}%; background: ${TEAMS[m.A.k].color};"></i><i class="tsBarB" style="width: ${(b / max) * 50}%; background: ${TEAMS[m.B.k].color};"></i><span class="tsDiff">${a - b >= 0 ? '+' : '−'}${fmt(Math.abs(a - b))}</span></span>`;
    const rowsHtml = mobile
      ? [...LA[l].map((p) => `<div class="tsRowM">${crest(m.A.k, 12)}${sheetRow(p, state)}</div>`), ...LB[l].map((p) => `<div class="tsRowM">${crest(m.B.k, 12)}${sheetRow(p, state)}</div>`)].join('')
      : Array.from({ length: n }, (_, i) => `<div class="tsRow">${sheetRow(LA[l][i], state)}${sheetRow(LB[l][i], state)}</div>${[LA[l][i], LB[l][i]].some((p) => p?.name === 'Cunha' && state === 'final') ? `<div class="tsPerf">${perfBlock(LA[l][i])}</div>` : ''}`).join('');
    return `<div class="tsLine"><div class="tsLH"><span class="tsLN">${l}</span>${up ? '' : `<span class="tsLA">${fmt(a)}</span>${bar}<span class="tsLB">${fmt(b)}</span>`}</div>${rowsHtml}</div>`;
  };
  const sA = up ? null : sideAt(m.A, now), sB = up ? null : sideAt(m.B, now);
  const benchLine = up ? '' : `<div class="tsLine"><div class="tsLH"><span class="tsLN">Bench Bonus</span><span class="tsLA">${fmt(sA.bench)}</span><span class="tsBar"><i class="tsBarA" style="width: ${(sA.bench / max) * 50}%; background: ${TEAMS[m.A.k].color};"></i><i class="tsBarB" style="width: ${(sB.bench / max) * 50}%; background: ${TEAMS[m.B.k].color};"></i><span class="tsDiff">${sA.bench - sB.bench >= 0 ? '+' : '−'}${fmt(Math.abs(sA.bench - sB.bench))}</span></span><span class="tsLB">${fmt(sB.bench)}</span></div></div>
    <div class="tsTot"><span>Total</span><b>${fmt(sA.score)}</b><span></span><b>${fmt(sB.score)}</b></div>`;
  const head = `<div class="tsHead">${crest(m.A.k, 20)}<b>${tname(m.A.k)}</b><span class="lbl">${m.A.formation}</span><span class="tsHeadSp"></span><span class="lbl">${m.B.formation}</span><b>${tname(m.B.k)}</b>${crest(m.B.k, 20)}</div>`;
  return `<section class="blk"><div class="sh"><h2 class="shT">Team Sheets</h2><span class="shTools">${up ? '<span class="lbl">Kickoffs</span>' : '<span class="lbl">Points by Line</span>'}</span></div>
    <div class="panel ts">${head}${LINES.map(block).join('')}${benchLine}</div></section>`;
}

// ── The pitch, vertical on every screen ──────────────────────────────────
function pitchVertical(m, state, { Wd, halfH, size, rating }) {
  const H = halfH * 2;
  const mineS = m.A.k === ME ? m.A : m.B, oth = mineS === m.A ? m.B : m.A;
  const nodes = [];
  for (const [side, home] of [[mineS, true], [oth, false]]) {
    const z = lines(side);
    const zones = ORDER.filter((k) => z[k]);
    const k = zones.length, edge = size === 'xs' ? 58 : 76, inner = size === 'xs' ? 66 : 82;
    const stepY = (halfH - edge - inner) / Math.max(1, k - 1);
    zones.forEach((zone, i) => {
      const yy = home ? H - edge - i * stepY : edge + i * stepY;
      const xs = spread(zone, z[zone].length, z).map((v) => 50 + (v - 50) * (z[zone].length >= 5 ? 0.94 : 1));
      z[zone].forEach((p, j) => {
        const xx = home ? xs[j] : 100 - xs[j];
        nodes.push(`<span class="paP" style="left: ${xx}%; top: ${yy}px;">${pitchChip(p, state, size, rating)}</span>`);
      });
    });
  }
  return `<div class="pv" style="height: ${H}px;"><div class="pvLines"><span class="pvHalf"></span><span class="pvCircle"></span><span class="pvBox pvBoxT"></span><span class="pvBox pvBoxB"></span></div>${nodes.join('')}</div>`;
}
function lineupsV(m, state, mobile, variant) {
  const mineS = m.A.k === ME ? m.A : m.B, oth = mineS === m.A ? m.B : m.A;
  const band = (s, top) => `<div class="lvBand${top ? '' : ' lvBandB'}">${crest(s.k, 20)}<b>${tname(s.k)}</b><span class="lbl">${s.formation}</span><span class="lvDir">${top ? 'Attacking down' : 'Attacking up'}</span></div>`;
  const grass = variant === 'halves' ? halves(m, state, mobile)
    : `${band(oth, true)}${pitchVertical(m, state, mobile ? { Wd: 358, halfH: 590, size: 'xs', rating: false } : { Wd: 580, halfH: 690, size: 'cmp', rating: false })}${band(mineS, false)}`;
  const keyNode = `<span class="lnKey">${[0, 2, 5.6, 15.8, 29].map((v) => ptsBadge(v)).join('')}</span>`;
  return `<section class="blk"><div class="sh"><h2 class="shT">Lineups</h2><span class="shTools">${mobile ? '' : keyNode}</span></div>
    <div class="board">${grass}${benchesStacked(m, state, mobile)}</div></section>`;
}
function benchesStacked(m, state, mobile) {
  return benches(m, state, mobile).replace('class="bnRow"', 'class="bnRow bnStack"');
}

// Each club's own half, both attacking up, each bench under its own half.
function lineupsSplit(m, state, mobile, H = 800) {
  const now = state === 'live' ? LIVE_NOW : null;
  const minRows = Math.max(rowCount(m.A), rowCount(m.B));
  const col = (side) => {
    const s = state === 'upcoming' ? null : sideAt(side, now);
    return `<div class="lsCol"><div class="lsHead">${crest(side.k, 22)}<b>${tname(side.k)}</b><span class="lbl">${side.formation}</span>${s ? `<span class="lsScore">${fmt(s.score)}</span>` : ''}</div>${rowPitch(side, state, mobile ? { fieldW: 358, compact: true } : { fieldW: 595, minRows })}${benchOne(side, state, mobile)}</div>`;
  };
  const keyNode = `<span class="lnKey">${[0, 2, 5.6, 15.8, 29].map((v) => ptsBadge(v)).join('')}</span>`;
  if (mobile) {
    const mineS = m.A.k === ME ? m.A : m.B, oth = mineS === m.A ? m.B : m.A;
    const body = `<div class="board">${col(mineS)}</div><div class="board lsNext">${col(oth)}</div><p class="lsHint">Turn your phone sideways for the two halves side by side</p>`;
    return `<section class="blk"><div class="sh"><h2 class="shT">Lineups</h2></div>${body}</section>`;
  }
  return `<section class="blk"><div class="sh"><h2 class="shT">Lineups</h2><span class="shTools">${keyNode}</span></div>
    <div class="board lsGrid">${col(m.A)}${col(m.B)}</div></section>`;
}
const o = { view: 'both' };

// Both squads at once on a phone: each club's half at glance size.
const MFLEX = { ATT: 1.1, AMZ: 1.3, CMZ: 1, DMZ: 1, WBZ: 1, DEF: 1.15, GK: 1.05 };
function miniHalf(side, state) {
  const now = state === 'live' ? LIVE_NOW : null;
  const s = state === 'upcoming' ? null : sideAt(side, now);
  const z = lines(side);
  const zones = ORDER.slice().reverse().filter((k) => z[k]);
  const tot = zones.reduce((t, k) => t + MFLEX[k], 0);
  const H = 390, top = 26, bot = 30;
  let acc = 0;
  const nodes = [];
  for (const zone of zones) {
    const c = acc + MFLEX[zone] / 2; acc += MFLEX[zone];
    const yy = top + (H - top - bot) * (c / tot);
    const xs = spread(zone, z[zone].length, z).map((v) => 50 + (v - 50) * 1.04);
    z[zone].forEach((p, i) => {
      const st = playStatus(p, state);
      const badge = st === 'pend' ? '<span class="pts pts-pend">–</span>' : st === 'dnp' ? '<span class="pts pts-dnp">DNP</span>' : ptsBadge(p.pts);
      nodes.push(`<span class="paP" style="left: ${xs[i]}%; top: ${yy}px;"><button class="mn${st === 'dnp' ? ' chDnp' : st === 'pend' ? ' chPend' : ''}" aria-label="${p.name}, ${p.slot}">${face(p, 30)}<span class="mnN">${p.name.replace(/^[A-Z]\./, '')}</span>${badge}</button></span>`);
    });
  }
  return `<div class="mbCol"><div class="mbHead">${crest(side.k, 16)}<b>${tname(side.k)}</b>${s ? `<span>${fmt(s.score)}</span>` : ''}</div><div class="ph mbPh"><div class="phField" style="height: ${H}px;"><span class="phTop"></span><span class="phCircle"></span><span class="phBox"></span><span class="phGoal"></span>${nodes.join('')}</div></div></div>`;
}

// ── Line totals: where the matchup was won and lost ──────────────────────
function lineTotals(m, state, mobile) {
  const now = state === 'live' ? LIVE_NOW : null;
  const LA = byLine(m.A), LB = byLine(m.B);
  const cnt = (p) => (playStatus(p, state) === 'played' ? p.pts : 0);
  const sum = (arr) => arr.reduce((t, p) => t + cnt(p), 0);
  const sA = sideAt(m.A, now), sB = sideAt(m.B, now);
  const rows = [...LINES.map((l) => [l, sum(LA[l]), sum(LB[l])]), ['Bench Bonus', sA.bench, sB.bench]];
  const max = Math.max(...rows.flatMap((r) => [r[1], r[2]]), 1);
  const row = ([l, a, b]) => {
    const d = a - b;
    return `<div class="ltR"><span class="ltL">${l}</span><span class="ltV">${fmt(a)}</span><span class="ltBar"><i style="right: 50%; width: ${(a / max) * 50}%; background: ${TEAMS[m.A.k].color};"></i><i style="left: 50%; width: ${(b / max) * 50}%; background: ${TEAMS[m.B.k].color};"></i></span><span class="ltV">${fmt(b)}</span><span class="ltD${Math.abs(d) < 0.005 ? '' : d > 0 ? ' ltDa' : ' ltDb'}">${crest(d >= 0 ? m.A.k : m.B.k, 12)}${fmt(Math.abs(d))}</span></div>`;
  };
  return `<section class="blk"><div class="sh"><h2 class="shT">Line Totals</h2></div><div class="panel">
    <div class="ltH"><span></span><span class="ltHc">${crest(m.A.k, 16)}</span><span></span><span class="ltHc">${crest(m.B.k, 16)}</span><span class="lbl">Edge</span></div>
    ${rows.map(row).join('')}
    <div class="ltR ltTot"><span class="ltL">Total</span><span class="ltV">${fmt(sA.score)}</span><span></span><span class="ltV">${fmt(sB.score)}</span><span class="ltD">${crest(sA.score >= sB.score ? m.A.k : m.B.k, 12)}${fmt(Math.abs(sA.score - sB.score))}</span></div></div></section>`;
}

// ── One team sheet per club ──────────────────────────────────────────────
function teamSheet(side, state, mobile, openName) {
  const now = state === 'live' ? LIVE_NOW : null;
  const up = state === 'upcoming';
  const s = up ? null : sideAt(side, now);
  const L = byLine(side);
  const row = (p) => {
    const st = playStatus(p, state);
    const fx = p.fixture;
    const stats = mobile ? p.stats.split(' · ').filter((t) => !/x[GA]/.test(t)).join(' · ').replace(' rating', ' Rtg') : p.stats;
    const sub = st === 'pend' ? `${fx.opponent} · ${ukTime(fx.kickoffTime)}` : st === 'dnp' ? (mobile ? 'Did not play' : 'Did not play · no bench cover') : (p.subIn ? `On for ${p.replaced.name} · ` : '') + stats;
    const pts = st === 'pend' ? '<span class="shP shP0">–</span>' : `<span class="shP${st === 'dnp' ? ' shP0' : ''}">${fmt(st === 'dnp' ? 0 : p.pts)}</span>`;
    const open = p.name === openName && p.perf && st === 'played';
    return `<div class="shE${open ? ' shOpen' : ''}"><div class="shRow" role="button" tabindex="0" aria-expanded="${open}">${chip(p.slot)}${portrait(p, 'sm', false)}<span class="shTx"><b>${p.name}${p.subIn ? glyph('up', 12) : ''}</b><span>${esc(sub)}</span></span>${p.perf && st === 'played' ? sig(p.perf) : '<span></span>'}${pts}</div>${open ? perfBlock(p) : ''}</div>`;
  };
  const line = (l) => {
    const sub = L[l].reduce((t, p) => t + (playStatus(p, state) === 'played' ? p.pts : 0), 0);
    return `<div class="shLine"><div class="shLH"><span>${l}</span>${up ? '' : `<b>${fmt(sub)}</b>`}</div>${L[l].map(row).join('')}</div>`;
  };
  const bench = side.bench.map((b) => {
    const st = up || (state === 'live' && !finishedAt(b.fixture, LIVE_NOW)) ? 'pend' : b.mins > 0 ? 'played' : 'dnp';
    const txt = st === 'pend' ? `${b.fixture.opponent} · ${ukTime(b.fixture.kickoffTime)}` : st === 'dnp' ? 'Did not play' : b.subOut ? 'Came on as an auto-sub' : `${fmt(b.pts)} pts × 25%`;
    return `<div class="shE"><div class="shRow">${chip(b.pos)}${portrait({ ...b, slot: b.pos }, 'sm', false)}<span class="shTx"><b>${b.name}</b><span>${b.benchSlot} · ${txt}</span></span><span></span><span class="shP${st === 'played' ? '' : ' shP0'}">${st === 'played' ? '+' + fmt(b.credit) : '–'}</span></div></div>`;
  }).join('');
  return `<div class="panel shPanel"><div class="shHead">${crest(side.k, 24)}<span class="shName">${tname(side.k)}</span><span class="lbl">${side.formation}</span>${s ? `<span class="shTot">${fmt(s.score)}</span>` : ''}</div>
    ${LINES.map(line).join('')}
    <div class="shLine"><div class="shLH"><span>Bench</span>${s ? `<b>+${fmt(s.bench)}</b>` : ''}</div>${bench}</div>
    ${s ? `<div class="shSum"><span>Starting XI</span><b>${fmt(s.xi)}</b></div><div class="shSum"><span>Bench Bonus</span><b>${fmt(s.bench)}</b></div><div class="shSum shTotal"><span>Total</span><b>${fmt(s.score)}</b></div>` : ''}</div>`;
}
function teamSheetsBlock(m, state, mobile) {
  if (mobile) {
    const mineS = m.A.k === ME ? m.A : m.B, oth = mineS === m.A ? m.B : m.A;
    const pager = `<span class="swpPager" role="tablist" aria-label="Team sheets"><button class="swpDot swpOn" role="tab" aria-selected="true" aria-label="${tname(mineS.k)}">${crest(mineS.k, 14)}</button><button class="swpDot" role="tab" aria-selected="false" aria-label="${tname(oth.k)}">${crest(oth.k, 14)}</button></span>`;
    return `<section class="blk"><div class="sh"><h2 class="shT">Team Sheets</h2><span class="shTools">${pager}</span></div>
      <div class="swp"><div class="swpTrack"><div class="swpCard">${teamSheet(mineS, state, mobile, 'Cunha')}</div><div class="swpCard">${teamSheet(oth, state, mobile, 'Isak')}</div></div></div>
      <p class="lsHint">Swipe for ${tname(oth.k)}</p></section>`;
  }
  return `<section class="blk"><div class="sh"><h2 class="shT">Team Sheets</h2></div><div class="bdGrid">${teamSheet(m.A, state, mobile, 'Cunha')}${teamSheet(m.B, state, mobile, 'Isak')}</div></section>`;
}

export function matchPage2({ state, mobile, dark, w, variant }) {
  const m = state === 'upcoming' ? GW6 : GW5[0];
  const sb = scoreboard({ m, state, big: true, mobile, gw: m.gw });
  o.view = variant === 'single' ? 'single' : 'both';
  const lineups = lineupsSplit(m, state, mobile, mobile ? 640 : 820);
  const mid = state === 'upcoming' ? ''
    : mobile ? `<div class="stl">${lineTotals(m, state, mobile)}</div><div class="stl">${reportBlock(m, state)}</div>`
    : `<div class="stl"><div class="story2"><div>${lineTotals(m, state, mobile)}</div><div>${reportBlock(m, state)}</div></div></div>`;
  const duo = `${lineups}${mid}<div class="stl">${teamSheetsBlock(m, state, mobile)}</div>`;
  let body;
  if (state === 'upcoming') body = `${sb}<div class="stl">${h2hBlock(m, state)}</div><div class="stl">${duo}</div>`;
  else body = `${sb}<div class="stl">${momentumBlock(m, state, mobile)}</div><div class="stl">${duo}</div>${state === 'final' ? `<div class="stl">${h2hBlock(m, state)}</div>` : ''}`;
  return `<div class="screen ${mobile ? 'm' : 'd'}" ${dark ? 'data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;">${topbar(mobile)}<main class="wrap">${matchBar(m, state, mobile)}${body}</main></div>`;
}

// A phone turned sideways: both halves side by side, phone-sized chips.
export function landscapeLineups({ w, dark }) {
  const m = GW5[0];
  const col = (side) => {
    const s = sideAt(side, null);
    return `<div class="lsCol"><div class="lsHead">${crest(side.k, 20)}<b>${tname(side.k)}</b><span class="lbl">${side.formation}</span><span class="lsScore">${fmt(s.score)}</span></div>${rowPitch(side, 'final', { fieldW: 405, compact: true, minRows: Math.max(rowCount(m.A), rowCount(m.B)) })}${benchOne(side, 'final', true)}</div>`;
  };
  return `<div class="screen m land" ${dark ? 'data-theme="dark"' : ''} style="width: ${w}px; height: __H__px;"><main class="wrap" style="padding: 12px 16px 24px;"><div class="sh"><h2 class="shT">Lineups</h2></div><div class="board lsGrid">${col(m.A)}${col(m.B)}</div></main></div>`;
}
