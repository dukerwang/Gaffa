/**
 * Draws the cups that are due. A cup is due once the gameweek before its first
 * round is finished (cupDrawGameweek in seeding.ts), and is created, seeded and
 * announced by createTournament at that moment.
 *
 * Three callers reach it so that no single missed run leaves a cup undrawn: the
 * resolve cron (src/app/api/sync/tournaments), the stalled-gameweek resolver in
 * the matchup processor, and the page-load scaffold. All are safe to run
 * together and repeatedly: the unique (league, type, season) index lets one
 * draw win and the rest skip, and a quiet call costs three small queries.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTournament } from '@/lib/tournaments/createTournaments';
import { cupDrawGameweek } from '@/lib/tournaments/seeding';
import type { TournamentType } from '@/types';

/** Champions Cup first: a league of 7 or more splits one table into the two cups. */
const DRAW_ORDER: TournamentType[] = ['primary_cup', 'consolation_cup', 'secondary_cup'];

export interface DrawnCup {
  leagueId: string;
  type: TournamentType;
  tournamentId: string;
}

/** Draws whatever is due for one league's season. Returns the cups it drew. */
export async function drawDueCupsForLeague(
  admin: SupabaseClient,
  leagueId: string,
  season: string,
): Promise<DrawnCup[]> {
  const [{ data: cups }, { count: clubs }] = await Promise.all([
    admin.from('tournaments').select('type').eq('league_id', leagueId).eq('season', season),
    admin.from('teams').select('id', { count: 'exact', head: true }).eq('league_id', leagueId),
  ]);
  const have = new Set((cups ?? []).map((c: { type: string }) => c.type));
  const missing = DRAW_ORDER.filter((t) => !have.has(t));
  if (missing.length === 0 || !clubs) return [];

  // One cheap look at how far the league has got, so a quiet run stops here.
  const { data: latest } = await admin
    .from('matchups')
    .select('gameweek')
    .eq('league_id', leagueId)
    .eq('status', 'completed')
    .order('gameweek', { ascending: false })
    .limit(1);
  const finishedThrough = latest?.[0]?.gameweek ?? 0;
  const due = missing.filter((t) => cupDrawGameweek(t, clubs) <= finishedThrough);

  const drawn: DrawnCup[] = [];
  for (const type of due) {
    const res = await createTournament(admin, leagueId, type, 1, season);
    if (res.ok && !res.skipped && res.tournament_id) drawn.push({ leagueId, type, tournamentId: res.tournament_id });
    else if (!res.ok) console.error(`[drawDueCups] ${type} for ${leagueId}:`, res.error);
  }
  return drawn;
}

/** Draws whatever is due for every active league. */
export async function drawDueCups(admin: SupabaseClient): Promise<DrawnCup[]> {
  const { data: leagues } = await admin
    .from('leagues')
    .select('id, current_season')
    .eq('status', 'active');

  const drawn: DrawnCup[] = [];
  for (const league of (leagues ?? []) as { id: string; current_season: string | null }[]) {
    if (!league.current_season) continue;
    try {
      drawn.push(...(await drawDueCupsForLeague(admin, league.id, league.current_season)));
    } catch (err) {
      // One league's failure must not stop the others being drawn.
      console.error(`[drawDueCups] ${league.id}:`, err);
    }
  }
  return drawn;
}
