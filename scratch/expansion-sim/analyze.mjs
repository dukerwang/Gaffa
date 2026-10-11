// Expansion draft options tested on the real alpha-league squads, and on
// synthetic established leagues of 6 to 12 clubs.
// For each rule set: how strong the new club comes out against the existing
// clubs, and how much each existing club loses.
// Usage: node scratch/expansion-sim/analyze.mjs   (SEEDS=8 by default)
import fs from 'fs';
const D = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const BUCKET = { GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF', DM: 'MID', CM: 'MID', AM: 'MID', LW: 'ATT', RW: 'ATT', ST: 'ATT' };

// Last season's Gaffa points per gameweek, from the redraft simulation's data.
const last = new Map();
try { const R = JSON.parse(fs.readFileSync(new URL('../redraft-economy-sim/data.json', import.meta.url))); for (const s of R.stats) last.set(s.p, (last.get(s.p) || 0) + s.pts / 38); } catch { console.error('no 2025-26 data: run scratch/redraft-economy-sim/fetch.mjs first'); }
const P = new Map();
for (const p of D.players) {
  if (!BUCKET[p.primary_position]) continue;
  const proj = Number(p.projected_points) || 0, ppg = Number(p.ppg) || 0;
  // Season view. A month of form is noisy, and picking the best of 400 free
  // agents on noisy numbers flatters them, so anchor on last season where we
  // have it and shrink players we only know from this season.
  const cur = 0.5 * proj + 0.5 * ppg;
  const v = last.has(p.id) ? 0.6 * last.get(p.id) + 0.4 * cur : (process.env.RAW ? cur : 0.75 * cur);
  P.set(p.id, { ...p, b: BUCKET[p.primary_position], v: process.env.RAW ? cur : v });
}

const MIN = { GK: 1, DEF: 3, MID: 2, ATT: 1 }, MAX = { GK: 1, DEF: 5, MID: 5, ATT: 3 };
function bestXI(ids) {
  const by = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const id of ids) { const p = P.get(id); if (p) by[p.b].push(p); }
  for (const k in by) by[k].sort((a, b) => b.v - a.v);
  const xi = [], cnt = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const k in MIN) for (let j = 0; j < Math.min(MIN[k], by[k].length); j++) { xi.push(by[k][j]); cnt[k]++; }
  const rest = []; for (const k of ['DEF', 'MID', 'ATT']) for (let j = cnt[k]; j < by[k].length; j++) rest.push(by[k][j]);
  rest.sort((a, b) => b.v - a.v);
  for (const p of rest) { if (xi.length >= 11) break; if (cnt[p.b] < MAX[p.b]) { xi.push(p); cnt[p.b]++; } }
  return xi;
}
// strength = best XI, plus a quarter of the best four outfield and one keeper on the bench (injury cover)
function strength(ids) {
  const xi = bestXI(ids); const inXI = new Set(xi.map(p => p.id));
  const bench = ids.map(id => P.get(id)).filter(p => p && !inXI.has(p.id)).sort((a, b) => b.v - a.v);
  const cover = bench.filter(p => p.b !== 'GK').slice(0, 4).reduce((a, p) => a + p.v, 0) + (bench.find(p => p.b === 'GK')?.v ?? 0);
  return xi.reduce((a, p) => a + p.v, 0) + 0.25 * cover;
}
// the next player who adds most to a squad, keeping position counts sane
const CAP = { GK: 3, DEF: 8, MID: 8, ATT: 7 };
function addBest(squad, pool) {
  const cnt = { GK: 0, DEF: 0, MID: 0, ATT: 0 }; for (const id of squad) { const p = P.get(id); if (p) cnt[p.b]++; }
  const base = strength(squad); let best = null, bg = -1e9;
  for (const id of pool) { const p = P.get(id); if (!p || cnt[p.b] >= CAP[p.b]) continue; const g = strength([...squad, id]) - base + 1e-3 * p.v; if (g > bg) { bg = g; best = id; } }
  return best;
}
// a club protects the players it would least like to lose: best XI first, then depth
function protect(ids, n) {
  const chosen = []; const left = new Set(ids);
  while (chosen.length < n && left.size) { const id = addBest(chosen, [...left]); if (!id) break; chosen.push(id); left.delete(id); }
  return new Set(chosen);
}

function runScenarios(label, teamIds, squads, freeAgents, R) {
  const before = new Map(teamIds.map(t => [t, strength(squads.get(t))]));
  const sorted = [...before.values()].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const scenarios = [{ name: 'Free agents only', protectN: null, perClub: 0 }];
  const grid = process.env.GRID ? JSON.parse(process.env.GRID) : process.env.WIDE ? [[8, 2], [8, 3], [9, 2], [9, 3], [11, 2], [11, 3]] : [[11, 1], [11, 2], [13, 1], [13, 2], [15, 1], [15, 2]];
  for (const [protectN, perClub] of grid) scenarios.push({ name: `Protect ${protectN}, take ${perClub} per club`, protectN, perClub });
  const res = [];
  for (const sc of scenarios) {
    const newSquad = []; const after = new Map(before); const lost = new Map();
    if (sc.protectN != null) {
      const exposed = new Map(teamIds.map(t => { const prot = protect(squads.get(t), sc.protectN); return [t, squads.get(t).filter(id => !prot.has(id))]; }));
      // strongest club first, and no club loses a second player before every club has lost one
      for (let round = 0; round < sc.perClub; round++) for (const t of [...teamIds].sort((a, b) => before.get(b) - before.get(a))) {
        const pick = addBest(newSquad, exposed.get(t)); if (!pick) continue;
        // "up to": the new club passes on a club's exposed players when a free agent is better
        if (process.env.OPTIONAL) { const fa = addBest(newSquad, freeAgents.filter(id => !newSquad.includes(id))); if (fa && strength([...newSquad, fa]) > strength([...newSquad, pick])) continue; }
        newSquad.push(pick); exposed.set(t, exposed.get(t).filter(id => id !== pick));
        lost.set(t, [...(lost.get(t) || []), pick]);
      }
      for (const t of teamIds) after.set(t, strength(squads.get(t).filter(id => !(lost.get(t) || []).includes(id))));
    }
    const pool = new Set(freeAgents);
    while (newSquad.length < R) { const id = addBest(newSquad, [...pool]); if (!id) break; newSquad.push(id); pool.delete(id); }
    const st = strength(newSquad);
    const allS = [...after.values(), st].sort((a, b) => b - a);
    const drops = teamIds.map(t => (before.get(t) - after.get(t)) / before.get(t) * 100);
    const xiMv = ids => bestXI(ids).reduce((a, p) => a + (Number(p.market_value) || 0), 0);
    const medianClub = [...teamIds].sort((a, b) => before.get(a) - before.get(b))[Math.floor(teamIds.length / 2)];
    const newXiMv = Math.round(xiMv(newSquad)), medianXiMv = Math.round(xiMv(squads.get(medianClub)));
    const takenIds = [...lost.values()].flat();
    const takenMv = takenIds.reduce((a, id) => a + (Number(P.get(id).mv ?? P.get(id).market_value) || 0), 0);
    res.push({ league: label, scenario: sc.name, taken: takenIds.length, takenMarketValue: Math.round(takenMv), newXiMv, medianXiMv, newVsMedianPct: +((st / median - 1) * 100).toFixed(1), newClubRank: allS.indexOf(st) + 1, clubs: allS.length,
      avgLossPct: +(drops.reduce((a, b) => a + b, 0) / drops.length).toFixed(1), maxLossPct: +Math.max(...drops).toFixed(1) });
  }
  return res;
}

const out = [];
for (const lg of D.leagues) {
  const teams = D.teams.filter(t => t.league_id === lg.id).map(t => t.id);
  const squads = new Map(teams.map(t => [t, D.roster.filter(r => r.team_id === t && r.status !== 'taxi').map(r => r.player_id)]));
  const owned = new Set(D.roster.filter(r => r.league_id === lg.id).map(r => r.player_id));
  out.push(...runScenarios(lg.name, teams, squads, [...P.keys()].filter(id => !owned.has(id)), lg.roster_size));
}

// Synthetic established leagues: a snake draft where each manager values
// players with their own error, so squads are good but not perfect.
function rnd(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const SEEDS = Number(process.env.SEEDS || 8);
for (const N of [6, 8, 10, 12]) {
  const agg = new Map();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = rnd(seed * 7919 + N); const R = 22; const ids = [...P.keys()];
    const err = new Map(); for (let j = 0; j < N; j++) for (const id of ids) err.set(j + ':' + id, Math.exp(0.5 * (r() + r() + r() - 1.5)));
    const squads = new Map([...Array(N).keys()].map(j => [j, []])); const taken = new Set();
    for (let round = 0; round < R; round++) for (const j of (round % 2 ? [...Array(N).keys()].reverse() : [...Array(N).keys()])) {
      const sq = squads.get(j); const cnt = { GK: 0, DEF: 0, MID: 0, ATT: 0 }; for (const id of sq) cnt[P.get(id).b]++;
      let best = null, bv = -1; for (const id of ids) { if (taken.has(id)) continue; const p = P.get(id); if (cnt[p.b] >= CAP[p.b]) continue; const v = p.v * err.get(j + ':' + id); if (v > bv) { bv = v; best = id; } }
      sq.push(best); taken.add(best);
    }
    const res = runScenarios(`${N} clubs`, [...Array(N).keys()], squads, ids.filter(id => !taken.has(id)), R);
    for (const x of res) { const a = agg.get(x.scenario) || { n: 0, nv: 0, rank: 0, avg: 0, max: 0, taken: 0, mv: 0, clubs: x.clubs }; a.n++; a.nv += x.newVsMedianPct; a.rank += x.newClubRank; a.avg += x.avgLossPct; a.max += x.maxLossPct; a.taken += x.taken; a.mv += x.takenMarketValue; a.nx = (a.nx || 0) + x.newXiMv; a.mx = (a.mx || 0) + x.medianXiMv; agg.set(x.scenario, a); }
  }
  for (const [scenario, a] of agg) out.push({ league: `Synthetic, ${N} clubs`, scenario, taken: +(a.taken / a.n).toFixed(1), takenMarketValue: Math.round(a.mv / a.n), newXiMv: Math.round(a.nx / a.n), medianXiMv: Math.round(a.mx / a.n), newVsMedianPct: +(a.nv / a.n).toFixed(1), newClubRank: +(a.rank / a.n).toFixed(1), clubs: a.clubs, avgLossPct: +(a.avg / a.n).toFixed(1), maxLossPct: +(a.max / a.n).toFixed(1) });
}
for (const r of out) console.log(JSON.stringify(r));
