import { readFileSync } from 'node:fs';
import { playerShots, profile, BANDS } from './profile';
const lb = JSON.parse(readFileSync('scratch/v3_eval/leaderboard_2025-26.json', 'utf8')).players;
for (const n of process.argv.slice(2)) {
  const p = lb.find((x: any) => x.name === n); if (!p) { console.log('no', n); continue; }
  const pr = profile(playerShots(p.player_id));
  const conv = pr.shotBands.map((s, i) => `${BANDS[i][0]} ${pr.goalBands[i]}/${s}`).join('  ');
  console.log(`${n.padEnd(14)} npShots ${pr.shots}  npxG ${pr.xg.toFixed(1)}  npG ${pr.goals} (fpl ${p.goals})  xG/shot ${(pr.xg / pr.shots).toFixed(3)}  ${conv}  goals at xG: ${pr.goalXg.sort((a, b) => b - a).join(' ')}`);
}
