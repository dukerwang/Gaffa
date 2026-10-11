import { createAdminClient } from '@/lib/supabase/admin';
import { loadReferenceStats } from '@/lib/scoring/matchups';
import { calculateMatchRating } from '@/lib/scoring/matchRating';
const admin = createAdminClient();
const ref = await loadReferenceStats(admin, '2025-26');
const POS = ['GK','CB','LB','RB','LWB','RWB','DM','CM','AM','LW','RW','ST'];
const { data: players } = await admin.from('players').select('id, web_name, primary_position, updated_at').limit(5000);
const pm = new Map(players!.map((p: any) => [p.id, p]));
for (const gw of [2, 3, 4, 5]) {
  const { data: rows } = await admin.from('player_stats').select('player_id, fantasy_points, match_rating, stats').eq('season', '2026-27').eq('gameweek', gw).gt('fantasy_points', 0).limit(1000);
  let explained = 0, unexplained: string[] = [];
  for (const r of rows!) {
    const p: any = pm.get(r.player_id); if (!p || !r.stats) continue;
    const a = calculateMatchRating(r.stats, p.primary_position, ref as any);
    if (Math.abs(a.fantasyPoints - Number(r.fantasy_points)) <= 0.01) continue;
    const hit = POS.filter((pos) => { const b = calculateMatchRating(r.stats, pos as any, ref as any); return Math.abs(b.fantasyPoints - Number(r.fantasy_points)) <= 0.01 && Math.abs(b.rating - Number(r.match_rating)) <= 0.01; });
    if (hit.length) { explained++; if (gw === 5) console.log(`  ${p.web_name}: now ${p.primary_position}, stored matches ${hit.join('/')}`); }
    else unexplained.push(`${p.web_name}(${p.primary_position}) stored ${r.fantasy_points} now ${a.fantasyPoints}`);
  }
  console.log({ gw, explained, unexplained });
}
