// Data for the defender-options review page: leaderboards and every 80+
// minute defender game under V3 now, the neutral team term and chances
// prevented. Reads the evaluation's --dump-apps output and leaderboard.
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import clubs from '../../src/lib/clubs/clubs.json';
import { fetchAll } from '../../scripts/lib/fetchAll';
import { appearanceGoalXg, playerShots, profile } from '../v3_shots/profile';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
// node_modules/.bin/tsx scratch/v3_doublecount/page_data.ts [defenders|midfielders]
const GROUP = process.argv[2] ?? 'defenders';
const STEPS = ({ midfielders: ['v2', 'neutral', 'cmw10', 'cmw15'], attackers: ['v2', 'neutral', 'finxgot', 'wlikest'] } as Record<string, string[]>)[GROUP] ?? ['v2', 'pen', 'xgcneu', 'xgcdef'];
const DEF = ({ midfielders: ['DM', 'CM', 'AM'], attackers: ['LW', 'RW', 'ST'] } as Record<string, string[]>)[GROUP] ?? ['CB', 'LB', 'RB', 'LWB', 'RWB'];
(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const fx = await fetchAll<any>((f, t) => sb.from('pl_fixtures').select('fpl_fixture_id, gameweek, home_club, away_club, home_score, away_score').eq('season', '2025-26').order('fpl_fixture_id').range(f, t));
  const short = new Map<string, string>((clubs as any).clubs ? (clubs as any).clubs.map((c: any) => [c.slug, c.shortName]) : (clubs as any).map((c: any) => [c.slug, c.shortName]));
  const byClubGw = new Map<string, any[]>();
  for (const f of fx) for (const side of ['home', 'away']) {
    const k = `${f[side + '_club']}:${f.gameweek}`; byClubGw.set(k, [...(byClubGw.get(k) ?? []), { ...f, side }]);
  }
  const lbAll = JSON.parse(readFileSync('scratch/v3_eval/leaderboard_2025-26.json', 'utf8')).players;
  const idOf = new Map<string, string>(lbAll.map((p: any) => [`${p.name}|${p.club}`, p.player_id]));
  const ATT = GROUP === 'attackers';
  const apps = JSON.parse(readFileSync('scratch/v3_eval/apps_2025-26.json', 'utf8')).filter((a: any) => DEF.includes(a.pos));
  const games = apps.map((a: any) => {
    const m = byClubGw.get(`${a.club}:${a.gw}`);
    const f = m && m.length === 1 ? m[0] : null;
    const opp = f ? (f.side === 'home' ? f.away_club : f.home_club) : null;
    const score = f ? (f.side === 'home' ? `${f.home_score}-${f.away_score}` : `${f.away_score}-${f.home_score}`) : null;
    return {
      n: a.name, c: short.get(a.club) ?? a.club ?? '', p: a.pos, gw: a.gw, o: opp ? (f.side === 'home' ? '' : '@') + (short.get(opp) ?? opp) : '', s: score,
      gc: a.gc, x: +(+a.xgc).toFixed(2), t: a.tackles ?? 0, cbi: a.cbi ?? 0, h: a.aerials ?? 0, fm: a.fotmob ?? null,
      g: a.goals ?? 0, a: a.assists ?? 0, ch: a.chances ?? 0, r: a.recoveries ?? 0, du: a.duels ?? 0,
      pg: a.penalty_goals ?? 0, xg: +(+(a.xg ?? 0)).toFixed(2), xgot: +(+(a.xgot ?? 0)).toFixed(2), sh: a.shots ?? 0,
      pts: STEPS.map((k) => a.steps[k].pts),
      ...(ATT ? { gx: appearanceGoalXg(idOf.get(`${a.name}|${short.get(a.club) ?? a.club}`) ?? '', a.gw, (a.goals ?? 0) - (a.penalty_goals ?? 0)) } : {}),
    };
  });
  const lb = lbAll
    .filter((p: any) => DEF.includes(p.pos) && p.minutes >= 1800)
    .map((p: any) => ({ n: p.name, c: p.club, p: p.pos, min: p.minutes, apps: p.apps, per90: STEPS.map((k) => +(p.pts[k] * 90 / p.minutes).toFixed(2)),
      ...(ATT ? { tot: STEPS.map((k) => Math.round(p.pts[k])), g: p.goals, a: p.assists, sp: (({ xg, goalXg, ...r }) => ({ ...r, xg: +xg.toFixed(1) }))(profile(playerShots(p.player_id))) } : {}) }));
  writeFileSync(`scratch/v3_doublecount/page_data${({ midfielders: '_mid', attackers: '_att' } as Record<string, string>)[GROUP] ?? ''}.json`, JSON.stringify({ steps: STEPS, games, lb }));
  console.log(games.length, 'games,', games.filter((g: any) => !g.o).length, 'without an opponent,', lb.length, 'players on the leaderboard');
})();
