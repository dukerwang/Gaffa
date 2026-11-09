import type { SupabaseClient } from '@supabase/supabase-js';
import { insertMatchups } from './insertMatchups';
import { drawDueCupsForLeague } from '@/lib/tournaments/drawDueCups';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';

export interface SeasonScaffoldResult {
  matchupsCreated: boolean;
  tournamentsCreated: boolean;
}

/**
 * Creates everything a league needs once its draft completes: the
 * head-to-head schedule immediately, and any cup that has come due.
 *
 * Cups are not made at kickoff. Each is drawn after the last gameweek before
 * its first round, from the finished table (src/lib/tournaments/seeding.ts), so
 * right after a draft this makes no cups and a later call makes the ones that
 * are due. The resolve cron does the same sweep for every league; this is the
 * safety net for a league the cron has not reached.
 *
 * Why the schedule and the cups sit behind one call. The two generators used to
 * be invoked separately, and `draft/pick` only ever called `insertMatchups`. A
 * draft that ended on a manual final pick therefore produced a league with a
 * schedule and no cups, and the page-load backfills only ran the cups inside an
 * "are there zero matchups?" branch, so once the schedule existed the cups could
 * never be created by any path.
 *
 * Safe to call on every load for an active league: `insertMatchups` skips when
 * the league already has matchups, and a league with nothing due costs three
 * small queries.
 *
 * Failures are logged, never thrown — a cup that can't be built must not take
 * down the page or the pick that triggered it. Each generator is attempted
 * independently so one failing doesn't suppress the other.
 */
export async function ensureSeasonScaffold(
  admin: SupabaseClient,
  leagueId: string,
  season?: string | null,
): Promise<SeasonScaffoldResult> {
  const result: SeasonScaffoldResult = {
    matchupsCreated: false,
    tournamentsCreated: false,
  };

  try {
    const scheduleResult = await insertMatchups(admin, leagueId);
    result.matchupsCreated = !scheduleResult.skipped && (scheduleResult.matchups ?? 0) > 0;
  } catch (err) {
    console.error(`[ensureSeasonScaffold] schedule failed for ${leagueId}:`, err);
  }

  try {
    const resolvedSeason = season ?? (await getCurrentFplSeason());
    const drawn = await drawDueCupsForLeague(admin, leagueId, resolvedSeason);
    result.tournamentsCreated = drawn.length > 0;
  } catch (err) {
    console.error(`[ensureSeasonScaffold] cups failed for ${leagueId}:`, err);
  }

  return result;
}
