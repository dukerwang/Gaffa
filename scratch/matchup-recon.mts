// Read-only: mirrors the matchup detail page for one matchup and checks that
// the per-player figures sum to the scorer's total. Writes nothing.
import { createAdminClient } from '@/lib/supabase/admin';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { applyCountedPoints, applySubsToLineup, attachLineupSlotScores, calculateTeamScore, emptyTeamScoreDetail, loadReferenceStats } from '@/lib/scoring/matchups';
const admin = createAdminClient();
const refStats = await loadReferenceStats(admin, '2025-26');
const { data: all } = await admin.from('matchups').select('*').eq('status', 'completed').not('team_b_id', 'is', null).gte('created_at', '2026-08-01');
for (const m of all!) {
const lineups = [m.lineup_a, m.lineup_b];
const ids = lineups.flatMap((l: any) => [...l.starters, ...(l.bench ?? [])].map((x: any) => x.player_id));
const { data: players } = await admin.from('players').select(FULL_PLAYER_SELECT).in('id', ids);
const { data: rows } = await admin.from('player_stats').select('player_id, fantasy_points, match_rating, stats').eq('season', '2026-27').eq('gameweek', m.gameweek).in('player_id', ids);
const rec = new Map(), pos = new Map(), prim = new Map(), pl = new Map(), dm: any = {};
for (const s of rows!) { rec.set(s.player_id, { fixtures: [{ minutes: s.stats?.minutes_played ?? 0, fantasyPoints: +s.fantasy_points, stats: s.stats }] }); dm[s.player_id] = { points: +s.fantasy_points, rating: s.match_rating, stats: s.stats }; }
for (const p of players as any[]) { pos.set(p.id, [p.primary_position, ...(p.secondary_positions ?? [])]); prim.set(p.id, p.primary_position); if (p.pl_team_id != null) pl.set(p.id, +p.pl_team_id); }
const details = lineups.map(() => emptyTeamScoreDetail());
const totals = lineups.map((l, i) => calculateTeamScore(l, rec, pos, pl, refStats, true, new Set(), details[i]));
const eff = lineups.map((l, i) => applySubsToLineup(l, details[i]));
attachLineupSlotScores(dm, eff, prim, refStats);
const sum = (i: number) => eff[i].starters.reduce((a, s) => a + (dm[s.player_id]?.bySlot?.[s.slot]?.points ?? dm[s.player_id]?.points ?? 0), 0) + details[i].benchBonusTotal;
const before = [sum(0), sum(1)];
applyCountedPoints(dm, details.map((d, i) => Math.abs(totals[i] - (i ? m.score_b : m.score_a)) < 0.005 ? d : undefined), refStats);
const name = (pid: string) => (players as any[]).find((p) => p.id === pid)?.web_name;
for (const i of [0, 1]) { const st = i ? m.score_b : m.score_a; const flag = Math.abs(st - totals[i]) > 0.001 || Math.abs(sum(i) - totals[i]) > 0.015 || Math.abs(before[i] - totals[i]) > 0.015; if (flag) console.log(m.id.slice(0, 8), 'gw', m.gameweek, { stored: st, scorer: totals[i], before: +before[i].toFixed(2), after: +sum(i).toFixed(2) }); }
}
console.log('checked', all!.length);
