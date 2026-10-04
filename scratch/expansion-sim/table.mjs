// Prints results.jsonl as a readable table.
import fs from 'fs';
const rows = fs.readFileSync(new URL(`./${process.argv[2] || 'results.jsonl'}`, import.meta.url), 'utf8').trim().split('\n').map(l => JSON.parse(l));
for (const r of rows) console.log(r.league.padEnd(22), r.scenario.padEnd(27), 'vs median', `${r.newVsMedianPct}%`.padStart(6), ' rank', r.newClubRank, 'of', r.clubs, ' loss avg', `${r.avgLossPct}%`, 'max', `${r.maxLossPct}%`);
