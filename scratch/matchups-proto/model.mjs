// Real Matchday Militia data, shaped for the prototype. Everything here comes
// from data.json (the detail page's own scoring path) or the matchups table.
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, 'data.json'), 'utf8'));
const PHOTOS = JSON.parse(fs.readFileSync(path.join(HERE, 'photos.json'), 'utf8'));
const CLUBS = JSON.parse(fs.readFileSync(path.join(REPO, 'src/lib/clubs/clubs.json'), 'utf8'));

export const DRAW = 10;

// ── Managers' clubs ──────────────────────────────────────────────────────
export const TEAMS = {
  NTX: { id: 'b1d3dc70-e60a-4896-a49e-5fff1ead5532', name: 'Not Too Xabi', mgr: 'duke' },
  PKC: { id: '2940c79f-e88e-4cd1-bc51-52139a4432f3', name: 'Pizzaking’s Club', mgr: 'Pizzaking' },
  CHZ: { id: '17246ae2-9db0-42dd-9a7a-e96fb52ecf79', name: 'ChelsZ FC', mgr: 'ZNoh' },
  TYG: { id: '7b3742e0-273b-4891-b208-592e531bffda', name: 'tottenyang FC', mgr: 'Andrew' },
  HAY: { id: '7f9ed8d1-1bce-416f-a5f2-4255c2d7e740', name: 'Hayden FC', mgr: 'Hayden7912' },
  TEA: { id: '491d0eaa-2502-4bb8-899f-81935f0d6e56', name: 'Tea FC', mgr: 'chai' },
};
export const ME = 'NTX';
const byId = Object.fromEntries(Object.entries(TEAMS).map(([k, t]) => [t.id, k]));
for (const m of DATA) for (const s of ['a', 'b']) TEAMS[byId[m[s].id]].crest = m[s].crest;
TEAMS.NTX.crest ??= DATA.find((m) => m.b.id === TEAMS.NTX.id).b.crest;

// A club's colour for the scoreboard ground. A near-black primary gives no
// identity once it is darkened further, so fall back to the secondary.
function lum(hex) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
for (const t of Object.values(TEAMS)) t.color = lum(t.crest.primaryColor) < 0.03 ? t.crest.secondaryColor : t.crest.primaryColor;

// ── Results, GW1–5, exactly as stored ────────────────────────────────────
export const RESULTS = [
  [1, 'HAY', 98.34, 'PKC', 130.73], [1, 'CHZ', 170.95, 'TYG', 101.65], [1, 'TEA', 113.77, 'NTX', 154.41],
  [2, 'TEA', 112.06, 'CHZ', 198.39], [2, 'PKC', 220.77, 'TYG', 223.14], [2, 'HAY', 120.89, 'NTX', 135.52],
  [3, 'TYG', 131.04, 'HAY', 199.27], [3, 'TEA', 119.10, 'PKC', 174.82], [3, 'NTX', 159.14, 'CHZ', 140.27],
  [4, 'PKC', 132.92, 'CHZ', 196.75], [4, 'TYG', 193.43, 'NTX', 163.52], [4, 'TEA', 104.64, 'HAY', 144.94],
  [5, 'TEA', 110.82, 'TYG', 191.53], [5, 'CHZ', 137.60, 'HAY', 119.75], [5, 'NTX', 127.06, 'PKC', 155.75],
];
export const SCHEDULE = {
  6: [['PKC', 'TEA'], ['CHZ', 'NTX'], ['HAY', 'TYG']],
  7: [['TYG', 'TEA'], ['HAY', 'CHZ'], ['PKC', 'NTX']],
};
export const res = (my, opp) => (Math.abs(my - opp) <= DRAW ? 'D' : my > opp ? 'W' : 'L');

export function form(k, upto) {
  const out = [];
  for (const [gw, a, sa, b, sb] of RESULTS) {
    if (gw > upto) continue;
    if (a === k) out.push({ gw, r: res(sa, sb), my: sa, opp: sb, vs: b });
    if (b === k) out.push({ gw, r: res(sb, sa), my: sb, opp: sa, vs: a });
  }
  return out;
}

export function table(upto) {
  const rows = Object.keys(TEAMS).map((k) => {
    const f = form(k, upto);
    const W = f.filter((x) => x.r === 'W').length, D = f.filter((x) => x.r === 'D').length, L = f.filter((x) => x.r === 'L').length;
    const pf = f.reduce((s, x) => s + x.my, 0), pa = f.reduce((s, x) => s + x.opp, 0);
    return { k, P: f.length, W, D, L, pts: W * 3 + D, pf, gd: pf - pa };
  });
  rows.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.pf - x.pf || TEAMS[x.k].name.localeCompare(TEAMS[y.k].name));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
export function tableWithMove(upto) {
  const now = table(upto), prev = table(upto - 1);
  return now.map((r) => ({ ...r, move: prev.find((p) => p.k === r.k).rank - r.rank }));
}
export const recordOf = (k, upto) => { const r = table(upto).find((x) => x.k === k); return { ...r, line: `W${r.W} D${r.D} L${r.L}` }; };
export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th'}`;

// ── Premier League clubs ─────────────────────────────────────────────────
export function clubOf(name) {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[’']/g, "'");
  return CLUBS.find((c) => c.name.toLowerCase() === n || c.shortName.toLowerCase() === n || c.slug === n || (c.aliases ?? []).some((a) => a.toLowerCase().replace(/[’']/g, "'") === n)) ?? null;
}

// ── Players ──────────────────────────────────────────────────────────────
const ZONE = { LW: 'ATT', ST: 'ATT', RW: 'ATT', AM: 'AMZ', DM: 'DMZ', CM: 'CMZ', LWB: 'WBZ', RWB: 'WBZ', CB: 'DEF', LB: 'DEF', RB: 'DEF', GK: 'GK' };
export const zoneOf = (slot) => ZONE[slot] ?? 'CMZ';

// Port of MatchupPitch's fmtStats: only fields the sync actually fills.
function statLine(stats, slot, rating) {
  if (!stats) return '';
  const z = zoneOf(slot);
  const parts = [];
  const g = +stats.goals || 0, a = +stats.assists || 0, cs = stats.clean_sheet;
  if (z === 'GK') { if (+stats.saves) parts.push(`${stats.saves} Sv`); if (cs) parts.push('CS'); }
  else if (z === 'DEF' || z === 'DMZ') { if (cs) parts.push('CS'); if (+stats.fpl_tackles) parts.push(`${stats.fpl_tackles} Tk`); }
  else if (z === 'CMZ' || z === 'AMZ') { if (g) parts.push(`${g}G`); if (a) parts.push(`${a}A`); const xa = +stats.expected_assists || 0; if (xa >= 0.05) parts.push(`${xa.toFixed(2)} xA`); }
  else { if (g) parts.push(`${g}G`); if (a) parts.push(`${a}A`); const xg = +stats.expected_goals || 0; if (xg >= 0.05) parts.push(`${xg.toFixed(2)} xG`); }
  if (+stats.minutes_played && rating != null) parts.push(`${Number(rating).toFixed(2)} rating`);
  return parts.join(' · ');
}

const OVERRIDE = { Cunha: 32.81 };
const codeOf = (url) => (url ?? '').match(/(\d+)\.png/)?.[1] ?? null;
function player(p, d, slot, fixture, perf) {
  const code = codeOf(p.photo);
  const kind = PHOTOS[code]?.kind ?? 'none';
  // The matchup total re-rates every starter at his slot. For Cunha (LW at LW)
  // that is 32.81, not the stored 27.61 the live page shows — so the pitch and
  // breakdown there do not add up to the header. Use what the total counted.
  const pts = OVERRIDE[p.name] ?? d?.bySlot?.points ?? d?.pts ?? 0;
  const rating = d?.bySlot?.rating ?? d?.rating ?? null;
  return {
    id: p.id, name: p.name, pos: p.pos, slot: slot ?? p.pos, club: clubOf(p.club),
    code, photo: kind === 'none' ? null : kind, pts, rating,
    mins: +(d?.stats?.minutes_played ?? 0), stats: statLine(d?.stats, slot ?? p.pos, rating),
    perf: perf ?? null, fixture,
  };
}

function side(raw, k) {
  const subs = raw.detail.subs ?? [];
  const credit = Object.fromEntries((raw.detail.benchBonus ?? []).map((b) => [b.playerId, b.credit]));
  const starters = raw.starters.map((s) => {
    const sub = subs.find((x) => x.outId === s.p.id);
    const out = player(s.p, s.d, s.slot, s.fixture, s.perf);
    if (sub) {
      const b = raw.bench.find((x) => x.p.id === sub.inId);
      const inP = player(b.p, { pts: sub.points, rating: b.d?.rating, stats: b.d?.stats }, s.slot, null, null);
      return { ...inP, subIn: true, replaced: out };
    }
    return out;
  });
  const bench = raw.bench.map((b) => ({ ...player(b.p, b.d, null, null, null), benchSlot: b.slot, credit: credit[b.p.id] ?? 0, subOut: subs.some((x) => x.inId === b.p.id) }));
  const blanked = (raw.detail.blanked ?? []).filter((b) => !b.covered).map((b) => starters.find((s) => s.id === b.playerId)?.name).filter(Boolean);
  return { k, formation: raw.formation, score: raw.score, benchBonus: raw.detail.benchBonusTotal ?? 0, starters, bench, blanked, subs };
}

// fixture per club slug, from the gameweek's own fixture map
function fixtureFor(fmap, club) {
  if (!club) return null;
  return fmap[club.slug] ?? fmap[club.shortName] ?? null;
}

export function matchup(i) {
  const raw = DATA[i];
  const A = side(raw.a, byId[raw.a.id]), B = side(raw.b, byId[raw.b.id]);
  for (const s of [A, B]) for (const p of [...s.starters, ...s.bench]) { p.fixture ??= fixtureFor(raw.fixtureMap, p.club); if (p.replaced) p.replaced.fixture ??= fixtureFor(raw.fixtureMap, p.replaced.club); }
  return { gw: raw.gw, A, B, report: raw.report };
}

export const GW5 = [0, 1, 2].map(matchup); // NTX-PKC, TEA-TYG, CHZ-HAY
export const GW6 = matchup(3);            // CHZ-NTX

// ── The gameweek clock ───────────────────────────────────────────────────
// A fixture's points land at the final whistle, ~115 minutes after kickoff.
export const WHISTLE = 115 * 60 * 1000;
export const LIVE_NOW = Date.parse('2026-09-20T12:00:00Z'); // Sunday lunchtime of GW5, before the last three fixtures
export const finishedAt = (fx, now) => fx && Date.parse(fx.kickoffTime) + WHISTLE <= now;

// Score a side as it stood at `now` (null = final).
export function sideAt(s, now) {
  if (now == null) return { score: s.score, xi: +(s.score - s.benchBonus).toFixed(2), bench: s.benchBonus, played: 11, toPlay: 0 };
  let xi = 0, bench = 0, played = 0;
  for (const p of s.starters) {
    const own = p.subIn ? p.replaced : p;
    if (!finishedAt(own.fixture, now)) continue;
    played++;
    if (p.subIn) { if (finishedAt(p.fixture, now)) xi += p.pts; }
    else xi += p.pts;
  }
  for (const b of s.bench) if (finishedAt(b.fixture, now)) bench += b.credit;
  return { score: +(xi + bench).toFixed(2), xi: +xi.toFixed(2), bench: +bench.toFixed(2), played, toPlay: 11 - played };
}

// Kickoff slots across both sides, and what each side banked in each.
export function runningScore(m) {
  const slots = new Map();
  const add = (fx, key, v, who) => {
    if (!fx) return;
    const t = fx.kickoffTime;
    if (!slots.has(t)) slots.set(t, { t, A: 0, B: 0, whoA: [], whoB: [] });
    const s = slots.get(t); s[key] += v; if (who) s['who' + key].push(who);
  };
  for (const [key, side] of [['A', m.A], ['B', m.B]]) {
    for (const p of side.starters) add((p.subIn ? p.fixture : p.fixture), key, p.pts, { name: p.name, pos: p.slot, pts: p.pts, photo: p.photo, code: p.code });
    for (const b of side.bench) if (b.credit) add(b.fixture, key, b.credit, { name: `${b.name} (bench)`, pos: b.pos, pts: b.credit, bench: true });
    // a slot a side has players in but scored nothing still needs to exist
    for (const p of side.starters) add(p.fixture, key, 0, null);
  }
  const arr = [...slots.values()].sort((x, y) => Date.parse(x.t) - Date.parse(y.t));
  let a = 0, b = 0;
  for (const s of arr) { a += s.A; b += s.B; s.cumA = +a.toFixed(2); s.cumB = +b.toFixed(2); s.whoA.sort((x, y) => y.pts - x.pts); s.whoB.sort((x, y) => y.pts - x.pts); }
  return arr;
}

// Who is still to play at `now`, per kickoff slot.
export function stillToPlay(m, now) {
  const map = new Map();
  for (const [key, side] of [['A', m.A], ['B', m.B]]) for (const p of side.starters) {
    const own = p.subIn ? p.replaced : p;
    if (finishedAt(own.fixture, now)) continue;
    const t = own.fixture.kickoffTime;
    if (!map.has(t)) map.set(t, { t, A: [], B: [] });
    map.get(t)[key].push(own);
  }
  return [...map.values()].sort((x, y) => Date.parse(x.t) - Date.parse(y.t));
}

// Top returns among starters across the round (slot-scored, as the matchups count them).
export function roundTop(n = 6) {
  const all = [];
  for (const m of GW5) for (const s of [m.A, m.B]) for (const p of s.starters) all.push({ ...p, owner: s.k });
  return all.sort((x, y) => y.pts - x.pts).slice(0, n);
}

export const SEASON_TOP = [
  { name: 'Groß', pos: 'DM', club: 'Brighton', code: '60307', owner: 'CHZ', pts: 121.39 },
  { name: 'Cherki', pos: 'RW', club: 'Man City', code: '466052', owner: 'CHZ', pts: 119.67 },
  { name: 'Haaland', pos: 'ST', club: 'Man City', code: '223094', owner: 'TYG', pts: 116.31 },
  { name: 'Tarkowski', pos: 'CB', club: 'Everton', code: '17761', owner: 'TYG', pts: 114.55 },
  { name: 'Tavernier', pos: 'LW', club: 'Bournemouth', code: '201658', owner: 'CHZ', pts: 111.19 },
  { name: 'Schade', pos: 'LW', club: 'Brentford', code: '513418', owner: 'NTX', pts: 108.71 },
].map((p) => ({ ...p, club: clubOf(p.club), photo: 'sq' }));

export const ptsBand = (v) => (v >= 29 ? 'elite' : v >= 15.8 ? 'good' : v >= 5.6 ? 'fair' : v >= 2 ? 'below' : v > 0 ? 'weak' : 'bad');
export const fmt = (v) => Number(v).toFixed(2);
