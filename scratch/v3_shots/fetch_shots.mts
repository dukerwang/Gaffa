/**
 * Fetches every 2025-26 FotMob shot map (per-shot xG, xGOT, situation) for the
 * matches already in .fotmob-cache/2025-26/matches. Local, read-only.
 *   node_modules/.bin/tsx scratch/v3_shots/fetch_shots.ts [--only=<matchId>]
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
const DIR = '.fotmob-cache/2025-26';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
mkdirSync(`${DIR}/shots`, { recursive: true });
const ids = only ? [Number(only)] : readdirSync(`${DIR}/matches`).map((f) => Number(f.replace('.json', '')));
const todo = ids.filter((id) => only || !existsSync(`${DIR}/shots/${id}.json`));

function nextData(html: string) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}
async function payload(id: number): Promise<any> {
  const api = await fetch(`https://www.fotmob.com/api/data/matchDetails?matchId=${id}`, { headers: HEADERS });
  if (api.ok) { try { const j = await api.json(); if (Number(j?.general?.matchId) === id) return j; } catch {} }
  const page = await fetch(`https://www.fotmob.com/en-GB/match/${id}`, { headers: HEADERS });
  if (!page.ok) throw new Error(`HTTP ${api.status}/${page.status}`);
  const p = nextData(await page.text())?.props?.pageProps;
  if (Number(p?.general?.matchId) !== id) throw new Error('wrong match');
  return p;
}
const failed: number[] = [];
for (let i = 0; i < todo.length; i += 4) {
  await Promise.all(todo.slice(i, i + 4).map(async (id) => {
    for (let a = 1; a <= 3; a++) {
      try {
        const p = await payload(id);
        const shots = (p?.content?.shotmap?.shots ?? []).map((s: any) => ({
          playerId: Number(s.playerId), name: s.playerName, teamId: s.teamId, min: s.min,
          eventType: s.eventType, situation: s.situation, shotType: s.shotType,
          isOwnGoal: !!s.isOwnGoal, isOnTarget: !!s.isOnTarget, isBlocked: !!s.isBlocked, inBox: !!s.isFromInsideBox,
          xg: s.expectedGoals ?? null, xgot: s.expectedGoalsOnTarget ?? null, x: s.x, y: s.y,
        }));
        if (only) console.log(JSON.stringify((p?.content?.shotmap?.shots ?? [])[0], null, 1));
        writeFileSync(`${DIR}/shots/${id}.json`, JSON.stringify({ matchId: id, shots }));
        return;
      } catch (e) { if (a === 3) failed.push(id); else await sleep(1500 * a); }
    }
  }));
  await sleep(400);
}
console.log(`fetched ${todo.length - failed.length}/${todo.length}; failed: ${failed.join(',') || 'none'}`);
