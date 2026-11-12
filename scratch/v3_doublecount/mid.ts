// Midfielders under V3 as it stands: points by game type, and which
// components the points come through. 80+ minutes, 2025-26.
import { calculateMatchRating } from '../../src/lib/scoring/matchRating';
import type { GranularPosition } from '../../src/types';
import { loadApps } from './data';
import { loadRef, v3Stats } from './gap';
import { v } from './lib';
(async () => {
  const ref = await loadRef();
  const all = await loadApps();
  for (const pos of ['DM', 'CM', 'AM'] as GranularPosition[]) {
    const apps = all.filter((a) => a.pos === pos && a.s.minutes_played >= 80);
    const rows = apps.map((a) => { const r = calculateMatchRating(v3Stats(a), pos, ref, pos); return { a, r, fm: a.f['FotMob rating']?.value as number }; });
    const win = (a: any) => (a.s.fpl_tackles ?? 0) + (a.s.fpl_recoveries ?? 0) + v(a, 'Ground duels won');
    const cut = rows.map((x) => win(x.a)).sort((p, q) => p - q)[Math.floor(rows.length * 0.75)];
    const m = (x: number[]) => (x.reduce((s, y) => s + y, 0) / (x.length || 1)).toFixed(1);
    const types: [string, (x: any) => boolean][] = [
      ['goal, no assist', (x) => x.a.s.goals >= 1 && x.a.s.assists === 0],
      ['assist, no goal', (x) => x.a.s.goals === 0 && x.a.s.assists >= 1],
      ['no G/A, creator (3+ chances)', (x) => x.a.s.goals + x.a.s.assists === 0 && v(x.a, 'Chances created') >= 3],
      ['no G/A, ball-winner (top quarter)', (x) => x.a.s.goals + x.a.s.assists === 0 && win(x.a) >= cut],
      ['no G/A, neither', (x) => x.a.s.goals + x.a.s.assists === 0 && v(x.a, 'Chances created') < 3 && win(x.a) < cut],
    ];
    console.log(`\n${pos} (${rows.length} games). Ball-winning = tackles + recoveries + ground duels won, top quarter >= ${cut}`);
    for (const [k, f] of types) { const s = rows.filter(f); console.log(`  ${k.padEnd(34)} n=${String(s.length).padStart(4)}  V3 ${m(s.map((x) => x.r.fantasyPoints)).padStart(5)} pts  FotMob ${m(s.map((x) => x.fm).filter(Boolean))}`); }
    // Where a goal's points go: same games with goals and assists zeroed in GI only.
    const shares: Record<string, number[]> = {};
    for (const x of rows) for (const b of x.r.breakdown) (shares[b.key] ??= []).push(b.weighted);
    console.log('  composite share by component: ' + Object.entries(shares).map(([k, w]) => `${k} ${(100 * w.reduce((s, y) => s + y, 0) / rows.reduce((s, x) => s + x.r.breakdown.reduce((t, b) => t + b.weighted, 0), 0)).toFixed(0)}%`).join(', '));
  }
})();
