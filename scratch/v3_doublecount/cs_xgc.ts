// Within clean sheets, does V3 pay a defender more when the opponent created
// little (controlled game) or a lot (survived)? CB and FB, 80+ minutes, 2025-26.
import { calculateMatchRating } from '../../src/lib/scoring/matchRating';
import type { GranularPosition } from '../../src/types';
import { loadApps } from './data';
import { loadRef, v3Stats } from './gap';
(async () => {
  const ref = await loadRef();
  for (const group of [['CB'], ['LB', 'RB', 'LWB', 'RWB']]) {
    const apps = (await loadApps()).filter((a) => group.includes(a.pos) && a.s.minutes_played >= 80);
    const m = (x: number[]) => x.reduce((s, y) => s + y, 0) / (x.length || 1);
    console.log(`\n${group.join('/')}: mean V3 points (FotMob rating, n) by opponent chances (team xGC)`);
    for (const gc of [0, 1]) {
      const line = [[0, 0.6], [0.6, 1.2], [1.2, 9]].map(([lo, hi]) => {
        const s = apps.filter((a) => a.s.goals_conceded === gc && a.s.expected_goals_conceded >= lo && a.s.expected_goals_conceded < hi);
        const pts = s.map((a) => calculateMatchRating(v3Stats(a), a.pos as GranularPosition, ref, a.pos as GranularPosition).fantasyPoints);
        return `xGC ${lo}-${hi === 9 ? '+' : hi}: ${m(pts).toFixed(1)} (${m(s.map((a) => a.f['FotMob rating']?.value ?? 0).filter(Boolean)).toFixed(2)}, ${s.length})`;
      });
      console.log(`  ${gc} conceded   ${line.join('   ')}`);
    }
  }
})();
