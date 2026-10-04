// Redraft economy simulation on real 2025-26 Gaffa points.
// One season: snake draft on noisy preseason beliefs, then 38 weeks of open
// free-agent auctions. Managers pick lineups and bid on beliefs (form plus
// injury news), and are scored on what the players really scored.
import fs from 'fs';
const D = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

const BUCKET = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', LW: 'ATT', RW: 'ATT', ST: 'ATT' };
const GW = 38, S = GW + 2;

// ---------- deterministic randomness ----------
function hash(...xs) { let h = 2166136261 >>> 0; for (const x of xs) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= 0x9e37; h = Math.imul(h, 2246822507) >>> 0; } return (h >>> 0) / 4294967296; }
function gauss(...xs) { const u = Math.max(1e-12, hash(...xs, 'a')), v = hash(...xs, 'b'); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- player table ----------
const inPL = new Set(D.psc.map(x => x.player_id));
const meta = Object.fromEntries(D.players.map(p => [p.id, p]));
const P = []; const idx = {};
for (const id of inPL) { const m = meta[id]; if (!m || !BUCKET[m.primary_position]) continue; idx[id] = P.length; P.push({ id, name: m.name, b: BUCKET[m.primary_position], mv: Number(m.market_value) || 1, pts: new Float64Array(GW + 1), played: new Uint8Array(GW + 1) }); }
for (const s of D.stats) { const i = idx[s.p]; if (i == null || s.gw < 1 || s.gw > GW) continue; P[i].pts[s.gw] += s.pts; P[i].played[s.gw] = 1; }
for (const p of P) { let t = 0, n = 0; for (let w = 1; w <= GW; w++) { t += p.pts[w]; n += p.played[w]; } p.total = t; p.ppg = t / GW; p.apps = n; p.ppa = n ? t / n : 0; }
// Preseason consensus, split the way managers think: points when he plays,
// and how often he plays. Both carry proportional error.
for (let i = 0; i < P.length; i++) {
  const p = P[i];
  p.priorPpa = Math.max(0.5, (p.ppa || 2) * Math.exp(0.3 * gauss('ppa', i) - 0.045));
  p.priorAv = Math.min(0.97, Math.max(0.05, p.apps / GW + 0.18 * gauss('av', i)));
}
const KP = 4, KA = 4; // prior weight in games, for points-per-appearance and availability
const PPA = new Float64Array(P.length * S), AV = new Float64Array(P.length * S);
for (let i = 0; i < P.length; i++) { let s = 0, n = 0; for (let t = 1; t <= GW + 1; t++) { PPA[i * S + t] = (KP * P[i].priorPpa + s) / (KP + n); AV[i * S + t] = (KA * P[i].priorAv + n) / (KA + t - 1); if (t <= GW && P[i].played[t]) { s += P[i].pts[t]; n++; } } }
// Injury and selection news: how likely the league knows, k weeks ahead,
// whether a player will play. Public, so every manager shares it.
const NEWS = [0.85, 0.55, 0.35, 0.2];
const known = (seed, i, w, k) => hash(seed, 'news', i, w, k) < NEWS[k];
export const bel = (i, t) => PPA[i * S + t] * AV[i * S + t];

// ---------- lineup ----------
const MIN = { GK: 1, DEF: 3, MID: 2, ATT: 1 }, MAX = { GK: 1, DEF: 5, MID: 5, ATT: 3 };
function bestXI(players, val) { // greedy is optimal for min/max bucket caps
  const by = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const i of players) by[P[i].b].push(i);
  for (const k in by) by[k].sort((a, b) => val(b) - val(a));
  const xi = [], cnt = { GK: 0, DEF: 0, MID: 0, ATT: 0 }; let ok = true;
  for (const k in MIN) { if (by[k].length < MIN[k]) ok = false; for (let j = 0; j < Math.min(MIN[k], by[k].length); j++) { xi.push(by[k][j]); cnt[k]++; } }
  const rest = []; for (const k of ['DEF', 'MID', 'ATT']) for (let j = cnt[k]; j < by[k].length; j++) rest.push(by[k][j]);
  rest.sort((a, b) => val(b) - val(a));
  for (const i of rest) { if (xi.length >= 11) break; const k = P[i].b; if (cnt[k] < MAX[k]) { xi.push(i); cnt[k]++; } }
  return { xi, ok };
}
function xiValue(players, val) { const { xi, ok } = bestXI(players, val); let s = 0; for (const i of xi) s += val(i); return ok ? s : s - 50; }

const NZC = new Map();
function noiseFor(seed, N) { const k = seed + '|' + N; if (NZC.has(k)) return NZC.get(k); const a = new Float64Array(N * P.length); for (let j = 0; j < N; j++) for (let i = 0; i < P.length; i++) a[j * P.length + i] = Math.exp(0.15 * gauss(seed, 'mn', j, i)); if (NZC.size > 64) NZC.clear(); NZC.set(k, a); return a; }

// ---------- one season ----------
export function runSeason(cfg, seed, perturb = null, expect = null) {
  const N = cfg.teams, R = cfg.roster;
  const owner = new Int16Array(P.length).fill(-1);
  const teams = Array.from({ length: N }, (_, j) => ({ j, roster: [], bal: cfg.budget, spent: 0, income: 0, pts: 0, w: 0, d: 0, l: 0, buys: 0, gainBought: new Float64Array(S), aggr: Math.exp(0.3 * gauss(seed, 'aggr', j)) }));
  if (perturb && perturb.week === 0) teams[perturb.team].bal += perturb.amount;
  const NZ = noiseFor(seed, N); const noise = (j, i) => NZ[j * P.length + i];
  // what manager j expects from player i in week w, judged before week t
  const avAt = (i, t, w) => { const k = w - t; return k < NEWS.length && known(seed, i, w, k) ? P[i].played[w] : AV[i * S + t]; };
  const vNow = (j, i, t) => noise(j, i) * PPA[i * S + t] * avAt(i, t, t);
  const vShort = (j, i, t) => { let s = 0, n = 0; for (let w = t; w < t + 4 && w <= GW; w++) { s += avAt(i, t, w); n++; } return noise(j, i) * PPA[i * S + t] * s / n; };
  const vLong = (j, i, t) => noise(j, i) * PPA[i * S + t] * AV[i * S + t];

  // snake draft on long-run value, with bucket caps so every squad can field a side
  const CAP = { GK: 2, DEF: Math.ceil(R * 0.36), MID: Math.ceil(R * 0.36), ATT: Math.ceil(R * 0.3) };
  const order = [...Array(N).keys()].sort((a, b) => hash(seed, 'ord', a) - hash(seed, 'ord', b));
  for (let r = 0; r < R; r++) for (const j of (r % 2 ? [...order].reverse() : order)) {
    const t = teams[j]; const cnt = { GK: 0, DEF: 0, MID: 0, ATT: 0 }; for (const i of t.roster) cnt[P[i].b]++;
    const need = Object.keys(MIN).filter(k => cnt[k] < MIN[k] + (k === 'GK' ? 0 : 1)); const left = R - t.roster.length;
    let best = -1, bv = -1;
    for (let i = 0; i < P.length; i++) { if (owner[i] >= 0) continue; const k = P[i].b; if (cnt[k] >= CAP[k]) continue; if (need.length >= left && !need.includes(k)) continue; const v = vLong(j, i, 1); if (v > bv) { bv = v; best = i; } }
    owner[best] = j; t.roster.push(best);
  }
  const draftStrength = teams.map(t => xiValue(t.roster, i => P[i].ppg));

  const rounds = []; { const ids = [...Array(N).keys()]; if (N % 2) ids.push(-1); const n = ids.length; for (let r = 0; r < n - 1; r++) { const pr = []; for (let k = 0; k < n / 2; k++) pr.push([ids[k], ids[n - 1 - k]]); rounds.push(pr); ids.splice(1, 0, ids.pop()); } }

  const lots = []; const weekSpend = new Float64Array(GW + 1);
  for (let t = 1; t <= GW; t++) {
    if (perturb && perturb.week === t) teams[perturb.team].bal += perturb.amount;
    const Wrem = GW - t + 1, short = Math.min(4, Wrem), long = Wrem - short;
    // ----- free-agent market before week t -----
    const fa = []; for (let i = 0; i < P.length; i++) if (owner[i] < 0) fa.push(i);
    const consensusShort = i => PPA[i * S + t] * (avAt(i, t, t) + (Wrem > 1 ? avAt(i, t, t + 1) : 0)) / 2;
    fa.sort((a, b) => consensusShort(b) - consensusShort(a));
    const cands = fa.slice(0, cfg.candPool ?? 50);
    const baseS = teams.map(tm => xiValue(tm.roster, i => vShort(tm.j, i, t)));
    const baseL = teams.map(tm => xiValue(tm.roster, i => vLong(tm.j, i, t)));
    const expRem = expect ? expect[t] : cfg.budget;
    for (const x of cands) {
      if (owner[x] >= 0) continue;
      const fl = cfg.floor(P[x], t, Wrem, bel(x, t), cfg); const bids = [];
      for (const tm of teams) {
        if (hash(seed, 'att', t, tm.j, x) > cfg.attention) continue;
        const vs = i => vShort(tm.j, i, t), vl = i => vLong(tm.j, i, t);
        const withX = [...tm.roster, x];
        const gS = xiValue(withX, vs) - baseS[tm.j], gL = xiValue(withX, vl) - baseL[tm.j];
        const G = gS * short + Math.max(0, gL) * long; // rest-of-season gain, points
        if (G / Wrem < cfg.minGain) continue;
        let drop = -1; if (tm.roster.length >= R) { // drop the player who matters least over the next month
          const { xi } = bestXI(withX, vs); const xs = new Set(xi); let lv = 1e9;
          for (const d of tm.roster) { if (xs.has(d)) continue; const v = vs(d) + vl(d); if (v < lv) { lv = v; drop = d; } }
          if (drop < 0) continue; }
        // share of balance: this upgrade against the upgrades still expected later
        const wtp = Math.floor(Math.min(tm.bal, tm.bal * Math.min(1, tm.aggr * G / (G + Math.max(1e-6, expRem)))));
        if (wtp >= fl) bids.push({ j: tm.j, wtp, drop, G });
      }
      if (!bids.length) continue;
      bids.sort((a, b) => b.wtp - a.wtp);
      const win = bids[0]; const pay = bids.length > 1 ? Math.min(win.wtp, Math.max(fl, bids[1].wtp + 1)) : fl;
      const tm = teams[win.j];
      tm.bal -= pay; tm.spent += pay; tm.buys++; tm.gainBought[t] += win.G; weekSpend[t] += pay;
      if (win.drop >= 0) { tm.roster = tm.roster.filter(i => i !== win.drop); owner[win.drop] = -1; }
      tm.roster.push(x); owner[x] = win.j;
      baseS[win.j] = xiValue(tm.roster, i => vShort(win.j, i, t)); baseL[win.j] = xiValue(tm.roster, i => vLong(win.j, i, t));
      lots.push({ t, x, pay, fl, nb: bids.length, G: win.G, real: realRoS(x, t) });
    }
    // ----- play week t: lineup on beliefs, auto-sub within bucket -----
    const score = teams.map(tm => {
      const val = i => vNow(tm.j, i, t);
      const { xi } = bestXI(tm.roster, val); const xs = new Set(xi);
      const bench = tm.roster.filter(i => !xs.has(i)).sort((a, b) => val(b) - val(a));
      let s = 0; const used = new Set();
      for (const i of xi) { if (P[i].played[t]) { s += P[i].pts[t]; continue; }
        const sub = bench.find(b => !used.has(b) && P[b].b === P[i].b && P[b].played[t]); if (sub != null) { used.add(sub); s += P[sub].pts[t]; } }
      tm.pts += s; return s;
    });
    for (const [a, b] of rounds[(t - 1) % rounds.length]) {
      if (a < 0 || b < 0) { const k = a < 0 ? b : a; cfg.income?.(teams[k], 'bye', t, cfg); continue; }
      const diff = score[a] - score[b];
      if (Math.abs(diff) <= 10) { teams[a].d++; teams[b].d++; cfg.income?.(teams[a], 'd', t, cfg); cfg.income?.(teams[b], 'd', t, cfg); }
      else { const [wn, ls] = diff > 0 ? [a, b] : [b, a]; teams[wn].w++; teams[ls].l++; cfg.income?.(teams[wn], 'w', t, cfg); cfg.income?.(teams[ls], 'l', t, cfg); }
    }
    cfg.weekly?.(teams, t, cfg);
  }
  for (const tm of teams) tm.lp = tm.w * 3 + tm.d;
  return { teams, lots, weekSpend, draftStrength };
}
function realRoS(i, t) { let s = 0; for (let w = t; w <= GW; w++) s += P[i].pts[w]; return s; }

// Rational expectations: how much gain a team buys from week t on, learned
// from earlier runs of the same league.
export function calibrate(cfg, seeds = 6, iters = 4) {
  let expect = null;
  for (let it = 0; it < iters; it++) {
    const acc = new Float64Array(S);
    for (let s = 0; s < seeds; s++) { const r = runSeason(cfg, 'cal' + s, null, expect); for (const tm of r.teams) for (let t = 1; t <= GW; t++) acc[t] += tm.gainBought[t]; }
    const e = new Float64Array(S); let run = 0;
    for (let t = GW; t >= 1; t--) { run += acc[t] / (seeds * cfg.teams); e[t] = Math.max(run, 1); }
    expect = expect ? expect.map((v, k) => 0.5 * v + 0.5 * e[k]) : e;
  }
  return expect;
}

export { P, GW };
