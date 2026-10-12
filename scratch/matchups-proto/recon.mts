import { createAdminClient } from '@/lib/supabase/admin';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { getLatestReferenceStatsSeason } from '@/lib/season/currentSeason';
import { attachLineupSlotScores, calculateTeamScore, emptyTeamScoreDetail, loadReferenceStats } from '@/lib/scoring/matchups';
const admin = createAdminClient();
const { data: m } = await admin.from('matchups').select('*').eq('id', 'e7a1720b-c82b-41d0-b7c9-01f0d0b13236').single();
const refStats = await loadReferenceStats(admin, await getLatestReferenceStatsSeason(admin));
for (const lineup of [m.lineup_a, m.lineup_b]) {
  const ids = lineup.starters.map((s: any) => s.player_id);
  const { data: players } = await admin.from('players').select(FULL_PLAYER_SELECT).in('id', ids);
  const { data: stats } = await admin.from('player_stats').select('player_id, fantasy_points, match_rating, stats').eq('season', '2026-27').eq('gameweek', 5).in('player_id', ids);
  const rec = new Map(), pos = new Map(), prim = new Map(), dm: any = {};
  for (const s of stats!) { rec.set(s.player_id, { fixtures: [{ minutes: s.stats?.minutes_played ?? 0, fantasyPoints: +s.fantasy_points, stats: s.stats }] }); dm[s.player_id] = { points: +s.fantasy_points, rating: s.match_rating, stats: s.stats }; }
  for (const p of players!) { pos.set(p.id, [p.primary_position, ...(p.secondary_positions ?? [])]); prim.set(p.id, p.primary_position); }
  attachLineupSlotScores(dm, [lineup], prim, refStats);
  for (const s of lineup.starters) {
    const one = calculateTeamScore({ starters: [s], bench: [] }, rec, pos, new Map(), refStats, true, new Set(), emptyTeamScoreDetail());
    const p = players!.find((x: any) => x.id === s.player_id);
    const shown = dm[s.player_id]?.bySlot?.[s.slot]?.points ?? dm[s.player_id]?.points;
    if (Math.abs(one - shown) > 0.005) console.log(p.web_name, p.primary_position, '@', s.slot, 'score path', one.toFixed(2), 'breakdown shows', shown);
  }
}
