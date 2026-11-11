// Where do centre-back scores swing? V3 as it stands (penalty rule
// included), 80+ minute CB appearances in 2025-26, split by goals conceded
// (0 / 1 / 2+) and by the defender's own involvement (tercile of tackles +
// clearances/blocks/interceptions + aerials won, per position), with FotMob's
// rating alongside as a second opinion.
import { calculateMatchRating } from '../../src/lib/scoring/matchRating';
import type { GranularPosition } from '../../src/types';
import { loadApps } from './data';
import { loadRef, v3Stats } from './gap';
import { v } from './lib';
(async () => {
  const ref = await loadRef();
  const pos = (process.argv[2] ?? 'CB') as GranularPosition;
  const apps = (await loadApps()).filter((a) => a.pos === pos && a.s.minutes_played >= 80);
  const inv = (a: any) => (a.s.fpl_tackles ?? 0) + (a.s.fpl_cbi ?? 0) + v(a, 'Aerial duels won');
  const sorted = apps.map(inv).sort((x, y) => x - y), t1 = sorted[Math.floor(sorted.length / 3)], t2 = sorted[Math.floor(2 * sorted.length / 3)];
  const rows = apps.map((a) => ({ a, pts: calculateMatchRating(v3Stats(a), pos, ref, pos).fantasyPoints, fm: a.f['FotMob rating']?.value as number | undefined,
    gc: Math.min(a.s.goals_conceded, 2), t: inv(a) < t1 ? 0 : inv(a) < t2 ? 1 : 2 }));
  const m = (x: number[]) => x.reduce((s, y) => s + y, 0) / (x.length || 1);
  console.log(`${pos} 80+ min: ${rows.length}. Involvement terciles cut at ${t1} and ${t2} actions.`);
  console.log('conceded   low involvement        mid                    high   (points | FotMob | n)');
  for (const gc of [0, 1, 2]) console.log(`${gc === 2 ? '2+' : gc}        ` + [0, 1, 2].map((t) => {
    const s = rows.filter((r) => r.gc === gc && r.t === t);
    return `${m(s.map((r) => r.pts)).toFixed(1).padStart(5)} | ${m(s.filter((r) => r.fm).map((r) => r.fm!)).toFixed(2)} | ${String(s.length).padStart(3)}`;
  }).join('    '));
  console.log('\nLowest-scoring 0-conceded games vs highest-scoring 1-conceded games:');
  const show = (r: any) => `${r.a.name.padEnd(12)} ${r.pts.toFixed(1).padStart(5)} pts  FotMob ${r.fm ?? '-'}  T ${r.a.s.fpl_tackles} CBI ${r.a.s.fpl_cbi} aerials ${v(r.a, 'Aerial duels won')} xGC ${r.a.s.expected_goals_conceded}`;
  rows.filter((r) => r.gc === 0).sort((x, y) => x.pts - y.pts).slice(0, 5).forEach((r) => console.log('  CS  ' + show(r)));
  rows.filter((r) => r.gc === 1).sort((x, y) => y.pts - x.pts).slice(0, 5).forEach((r) => console.log('  1GC ' + show(r)));
})();
