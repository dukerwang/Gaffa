// Evaluates one league configuration. Usage, from this folder:
//   node run.mjs '{"floorName":"flat1","seeds":24}'
// Prints one JSON line of metrics. See README.md for what each one means.
import { runSeason, calibrate, P, GW, bel } from './sim.mjs';

const spearman = (a, b) => { const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); o.forEach(([, i], k) => r[i] = k); return r; }; const ra = rk(a), rb = rk(b); const n = a.length; const ma = (n - 1) / 2; let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; } return num / Math.sqrt(da * db); };

export const FLOOR = {
  flat1: () => 1,
  mv60: p => Math.max(1, Math.floor(0.6 * p.mv)),
  mv50: p => Math.max(1, Math.floor(0.5 * p.mv)),
  mv20: p => Math.max(1, Math.floor(0.2 * p.mv)),
  // floor tied to projected rest-of-season points above replacement level
  proj: (p, t, Wrem, b, cfg) => Math.max(1, Math.round(cfg.phi * Math.max(0, b - repl(cfg.teams, p.b, t)) * Wrem)),
};
const STARTERS = { GK: 1, DEF: 4, MID: 4, ATT: 2 };
const replCache = {};
function repl(N, b, t) { const k = `${N}${b}${t}`; if (replCache[k] != null) return replCache[k]; const v = []; for (let i = 0; i < P.length; i++) if (P[i].b === b) v.push(bel(i, t)); v.sort((x, y) => y - x); return replCache[k] = v[Math.min(v.length - 1, N * STARTERS[b])]; }

export const INCOME = {
  none: null,
  merit: (tm, r, t, cfg) => { const a = { w: 2.5, d: 1.5, l: 0.5, bye: 1.5 }[r] * cfg.budget / 250; tm.bal += a; tm.income += a; },
  flat: (tm, r, t, cfg) => { const a = 1.5 * cfg.budget / 250; tm.bal += a; tm.income += a; },
  catchup: (tm, r, t, cfg) => { const a = { w: 0.5, d: 1.5, l: 2.5, bye: 1.5 }[r] * cfg.budget / 250; tm.bal += a; tm.income += a; },
};
export const WEEKLY = {
  window: (teams, t, cfg) => { if (t === 19) for (const tm of teams) { const a = cfg.windowAmt; tm.bal += a; tm.income += a; } },
};

export function evaluate(cfg, { seeds = 16, perturb = true } = {}) {
  const expect = calibrate(cfg);
  if (cfg.floorName === 'proj' && cfg.phiK) cfg.phi = cfg.phiK * cfg.budget / expect[1];
  const m = { spent: 0, avail: 0, lots: 0, contested: 0, atFloor: 0, buys: 0, q: [0, 0, 0, 0], corrPV: 0, corrDraft: 0, payMean: 0 };
  let corrN = 0, sdP = 0, sdL = 0, meanP = 0;
  for (let s = 0; s < seeds; s++) {
    const r = runSeason(cfg, 'ev' + s, null, expect);
    for (const tm of r.teams) { m.spent += tm.spent; m.avail += cfg.budget + tm.income; m.buys += tm.buys; }
    for (const l of r.lots) { m.lots++; if (l.nb > 1) m.contested++; if (l.pay <= l.fl) m.atFloor++; m.payMean += l.pay; }
    for (let t = 1; t <= GW; t++) m.q[Math.min(3, Math.floor((t - 1) / 9.5))] += r.weekSpend[t];
    if (r.lots.length > 5) { m.corrPV += spearman(r.lots.map(l => l.pay + 1e-6 * l.G), r.lots.map(l => l.real)); corrN++; }
    m.corrDraft += spearman(r.draftStrength, r.teams.map(t => t.pts));
    const ps = r.teams.map(t => t.pts), ls = r.teams.map(t => t.lp);
    const mp = ps.reduce((a, b) => a + b) / ps.length, ml = ls.reduce((a, b) => a + b) / ls.length;
    meanP += mp; sdP += Math.sqrt(ps.reduce((a, b) => a + (b - mp) ** 2, 0) / ps.length); sdL += Math.sqrt(ls.reduce((a, b) => a + (b - ml) ** 2, 0) / ls.length);
  }
  const tot = m.q.reduce((a, b) => a + b, 0) || 1;
  const out = {
    spentPct: +(100 * m.spent / m.avail).toFixed(0),
    buysPerTeam: +(m.buys / (seeds * cfg.teams)).toFixed(1),
    contestedPct: +(100 * m.contested / Math.max(1, m.lots)).toFixed(0),
    atFloorPct: +(100 * m.atFloor / Math.max(1, m.lots)).toFixed(0),
    avgPay: +(m.payMean / Math.max(1, m.lots)).toFixed(1),
    spendByQuarter: m.q.map(x => Math.round(100 * x / tot)),
    priceVsRealValue: +(m.corrPV / Math.max(1, corrN)).toFixed(2),
    draftVsFinal: +(m.corrDraft / seeds).toFixed(2),
    teamSeasonPts: Math.round(meanP / seeds), sdTeamPts: Math.round(sdP / seeds), sdLeaguePts: +(sdL / seeds).toFixed(1),
  };
  if (perturb) { // marginal value of money: extra budget to one team, common random numbers
    const amt = Math.round(cfg.budget * (cfg.perturbPct ?? 0.2)); let d0 = 0, d19 = 0, dw0 = 0, n = 0, sq = 0;
    for (let s = 0; s < seeds; s++) for (let team = 0; team < cfg.teams; team += Math.max(1, Math.floor(cfg.teams / 3))) {
      const b = runSeason(cfg, 'pt' + s, null, expect).teams[team];
      const a0 = runSeason(cfg, 'pt' + s, { team, week: 0, amount: amt }, expect).teams[team];
      const a19 = runSeason(cfg, 'pt' + s, { team, week: 19, amount: amt }, expect).teams[team];
      d0 += a0.pts - b.pts; sq += (a0.pts - b.pts) ** 2; d19 += a19.pts - b.pts; dw0 += a0.lp - b.lp; n++;
    }
    out.extraBudgetAtStart_pts = +(d0 / n).toFixed(1);
    out.extraBudgetAtStart_se = +(Math.sqrt(Math.max(0, sq / n - (d0 / n) ** 2) / n)).toFixed(1);
    out.extraBudgetAtStart_leaguePts = +(dw0 / n).toFixed(2);
    out.extraBudgetAtGW19_pts = +(d19 / n).toFixed(1);
  }
  return out;
}

export function make(over) {
  const cfg = { teams: 10, roster: 18, budget: 100, attention: 0.8, minGain: 0.4, candPool: 50, floorName: 'flat1', incomeName: 'none', ...over };
  cfg.floor = FLOOR[cfg.floorName]; cfg.income = INCOME[cfg.incomeName] || null; cfg.weekly = cfg.weeklyName ? WEEKLY[cfg.weeklyName] : null;
  return cfg;
}

if (process.argv[2]) {
  const over = JSON.parse(process.argv[2]);
  const t0 = Date.now(); const r = evaluate(make(over), { seeds: over.seeds ?? 12, perturb: over.perturb ?? true });
  console.log(JSON.stringify({ cfg: over, ...r, sec: ((Date.now() - t0) / 1000).toFixed(0) }));
}
