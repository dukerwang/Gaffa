// Pulls one matchup through the same code path as matchups/[matchupId]/page.tsx and dumps JSON.
import { createAdminClient } from '@/lib/supabase/admin';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { getEffectiveLineupForTeam } from '@/lib/lineups/carryForward';
import { generateMatchReport } from '@/lib/narrative/matchReport';
import { getLatestReferenceStatsSeason } from '@/lib/season/currentSeason';
import { applySubsToLineup, attachLineupSlotScores, buildLineupPerformance, calculateTeamScore, emptyTeamScoreDetail, loadReferenceStats } from '@/lib/scoring/matchups';
import { getGameweekFixtureMap } from '@/lib/fixtures/gameweekFixtures';
import fs from 'node:fs';

const SEASON = '2026-27';
async function one(admin: any, id: string) {
  const { data: m } = await admin.from('matchups').select('*, team_a:teams!matchups_team_a_id_fkey(id, team_name, crest_config), team_b:teams!matchups_team_b_id_fkey(id, team_name, crest_config)').eq('id', id).single();
  const lineupA = await getEffectiveLineupForTeam(admin, { teamId: m.team_a_id, gameweek: m.gameweek, currentLineup: m.lineup_a });
  const lineupB = await getEffectiveLineupForTeam(admin, { teamId: m.team_b_id, gameweek: m.gameweek, currentLineup: m.lineup_b });
  const ids = new Set<string>();
  for (const l of [lineupA, lineupB]) { l?.starters.forEach((s: any) => ids.add(s.player_id)); (l?.bench ?? []).forEach((b: any) => ids.add(b.player_id)); }
  const arr = [...ids];
  const { data: players } = await admin.from('players').select(FULL_PLAYER_SELECT).in('id', arr);
  const { data: stats } = await admin.from('player_stats').select('player_id, fantasy_points, match_rating, stats, perf').eq('season', SEASON).eq('gameweek', m.gameweek).in('player_id', arr);
  const refStats = await loadReferenceStats(admin, await getLatestReferenceStatsSeason(admin));
  const fixtureMap = await getGameweekFixtureMap(admin, SEASON, m.gameweek);
  const playerMap: Record<string, any> = {}; for (const p of players ?? []) playerMap[p.id] = p;
  const detailMap: Record<string, any> = {};
  const rec = new Map();
  for (const s of stats ?? []) {
    detailMap[s.player_id] = { points: Number(s.fantasy_points), rating: s.match_rating != null ? Number(s.match_rating) : null, stats: s.stats, perf: s.perf, primaryPosition: playerMap[s.player_id]?.primary_position };
    rec.set(s.player_id, { fixtures: [{ minutes: s.stats?.minutes_played ?? 0, fantasyPoints: Number(s.fantasy_points) || 0, stats: s.stats }] });
  }
  const pos = new Map(); const plt = new Map(); const prim = new Map();
  for (const [id, p] of Object.entries(playerMap)) { pos.set(id, [p.primary_position, ...(p.secondary_positions ?? [])].filter(Boolean)); if (p.pl_team_id != null) plt.set(id, Number(p.pl_team_id)); prim.set(id, p.primary_position); }
  const dA = emptyTeamScoreDetail(), dB = emptyTeamScoreDetail();
  const finished = new Set<number>([...plt.values()]);
  const sA = calculateTeamScore(lineupA, rec, pos, plt, refStats, true, finished, dA);
  const sB = calculateTeamScore(lineupB, rec, pos, plt, refStats, true, finished, dB);
  const eA = applySubsToLineup(lineupA, dA), eB = applySubsToLineup(lineupB, dB);
  attachLineupSlotScores(detailMap, [eA, eB], prim, refStats);
  const perfMap = buildLineupPerformance(detailMap, [eA, eB], refStats);
  const report = generateMatchReport(m, lineupA, lineupB, playerMap, detailMap, m.score_a, m.score_b, dA, dB);
  const slim = (p: any) => p && ({ id: p.id, name: p.web_name, full: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(), pos: p.primary_position, sec: p.secondary_positions, club: p.pl_team, photo: p.photo_url, code: p.fpl_code ?? p.code, headTop: p.portrait_head_top_pct, headW: p.portrait_head_width_pct, ver: p.photo_version, mv: p.market_value });
  const side = (l: any, d: any) => ({
    formation: l?.formation,
    starters: (l?.starters ?? []).map((s: any) => ({ slot: s.slot, p: slim(playerMap[s.player_id]), d: detailMap[s.player_id] && { pts: detailMap[s.player_id].points, rating: detailMap[s.player_id].rating, bySlot: detailMap[s.player_id].bySlot?.[s.slot], stats: detailMap[s.player_id].stats }, perf: perfMap[s.player_id] ?? null, fixture: fixtureMap[(playerMap[s.player_id]?.pl_team ?? '').toLowerCase()] ?? null })),
    bench: (l?.bench ?? []).map((b: any) => ({ slot: b.slot, p: slim(playerMap[b.player_id]), d: detailMap[b.player_id] && { pts: detailMap[b.player_id].points, rating: detailMap[b.player_id].rating, stats: detailMap[b.player_id].stats } })),
    detail: d,
  });
  return { id, gw: m.gameweek, status: m.status, a: { id: m.team_a.id, name: m.team_a.team_name, crest: m.team_a.crest_config, score: Number(m.score_a), computed: sA, ...side(lineupA, dA) }, b: { id: m.team_b.id, name: m.team_b.team_name, crest: m.team_b.crest_config, score: Number(m.score_b), computed: sB, ...side(lineupB, dB) }, report, fixtureMap };
}
const admin = createAdminClient();
const ids = process.argv.slice(2);
const out = [];
for (const id of ids) out.push(await one(admin, id));
fs.writeFileSync('scratch/matchups-proto/data.json', JSON.stringify(out, null, 1));
console.log(out.map((o) => `${o.a.name} ${o.a.score}/${o.a.computed.toFixed(2)} v ${o.b.name} ${o.b.score}/${o.b.computed.toFixed(2)} subs ${o.a.detail.subs.length}/${o.b.detail.subs.length}`).join('\n'));
