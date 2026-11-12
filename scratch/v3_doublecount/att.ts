// Attackers (LW, RW, ST) under V3 as it stands: points by game type, and
// which components the points come through. 80+ minutes, 2025-26.
import { calculateMatchRating } from '../../src/lib/scoring/matchRating';
import type { GranularPosition } from '../../src/types';
import { loadApps } from './data';
import { loadRef, v3Stats } from './gap';
import { v } from './lib';
(async () => {
  const ref = await loadRef();
  const all = await loadApps();
  for (const grp of [['LW', 'RW'], ['ST']]) {
    const rows = all.filter((a) => grp.includes(a.pos) && a.s.minutes_played >= 80).map((a) => {
      const pos = a.pos as GranularPosition, r = calculateMatchRating(v3Stats(a), pos, ref, pos);
      return { a, r, fm: a.f['FotMob rating']?.value as number, xg: a.s.expected_goals ?? 0, xgot: v(a, 'Expected goals on target (xGOT)'), np: a.s.goals - a.penalty_goals };
    });
    const m = (x: number[]) => (x.reduce((s, y) => s + y, 0) / (x.length || 1)).toFixed(1);
    const types: [string, (x: any) => boolean][] = [
      ['1 open-play goal, no assist', (x) => x.np === 1 && x.a.penalty_goals === 0 && x.a.s.assists === 0],
      ['  of which tap-in (xG 0.5+)', (x) => x.np === 1 && x.a.penalty_goals === 0 && x.a.s.assists === 0 && x.xg >= 0.5],
      ['  of which low xG (<0.15)', (x) => x.np === 1 && x.a.penalty_goals === 0 && x.a.s.assists === 0 && x.xg < 0.15],
      ['2+ goals', (x) => x.a.s.goals >= 2],
      ['assist, no goal', (x) => x.a.s.goals === 0 && x.a.s.assists >= 1],
      ['no G/A, big chances missed (xG 0.8+)', (x) => x.a.s.goals + x.a.s.assists === 0 && x.xg >= 0.8],
      ['no G/A, creator (3+ chances)', (x) => x.a.s.goals + x.a.s.assists === 0 && v(x.a, 'Chances created') >= 3],
      ['no G/A, quiet (xG < 0.2, < 2 chances)', (x) => x.a.s.goals + x.a.s.assists === 0 && x.xg < 0.2 && v(x.a, 'Chances created') < 2],
    ];
    console.log(`\n${grp.join('/')} (${rows.length} games)`);
    for (const [k, f] of types) { const s = rows.filter(f); console.log(`  ${k.padEnd(38)} n=${String(s.length).padStart(4)}  V3 ${m(s.map((x) => x.r.fantasyPoints)).padStart(5)}  FotMob ${m(s.map((x) => x.fm).filter(Boolean))}`); }
    const shares: Record<string, number> = {}; let tot = 0;
    for (const x of rows) for (const b of x.r.breakdown) { shares[b.key] = (shares[b.key] ?? 0) + b.weighted; tot += b.weighted; }
    console.log('  composite share: ' + Object.entries(shares).map(([k, w]) => `${k} ${(100 * w / tot).toFixed(0)}%`).join(', '));
    const goalRows = rows.filter((x) => x.np === 1 && x.a.penalty_goals === 0 && x.a.s.assists === 0);
    const fin = (x: any) => x.r.breakdown.find((b: any) => b.key === 'finishing');
    console.log(`  1-goal games: Finishing weight incl. flex ${m(goalRows.map((x) => fin(x)?.weight ?? 0))}, score ${m(goalRows.map((x) => fin(x)?.score ?? 0))}; flex goes to: ` +
      Object.entries(goalRows.reduce((acc: any, x) => { const flex = x.r.breakdown.reduce((b: any, c: any) => (c.weight - (({ LW: { goal_involvement: .15, threat: .10, creativity: .05 }, RW: { goal_involvement: .15, threat: .10, creativity: .05 }, ST: { threat: .15, goal_involvement: .15, finishing: .10 } } as any)[x.a.pos][c.key] ?? 0)) > 0.2 ? c.key : b, ''); acc[flex] = (acc[flex] ?? 0) + 1; return acc; }, {})).map(([k, n]) => `${k} ${n}`).join(', '));
  }
})();
