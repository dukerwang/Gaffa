/**
 * Everything a gameweek's matchups share, loaded once per page: the season's
 * reference stats, the fixture map, which clubs have kicked off or finished,
 * whether the post-lockdown pass has run, and the managers' names.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentFplSeason, getLatestReferenceStatsSeason } from '@/lib/season/currentSeason';
import { loadReferenceStats } from '@/lib/scoring/matchups';
import { isGameweekFinalised } from '@/lib/scoring/gameweekState';
import { getFinishedPlTeamIds, getLockedPlTeamIds } from '@/lib/fixtures/lockout';
import { getGameweekFixtureMap } from '@/lib/fixtures/gameweekFixtures';
import type { MatchupContext } from './matchupView';

export async function loadMatchupContext(
  admin: SupabaseClient,
  gameweek: number,
  fpl: { currentGw: number; isFinished: boolean },
  managers: Record<string, string | null>,
): Promise<MatchupContext> {
  const [currentSeason, refSeason] = await Promise.all([
    getCurrentFplSeason(undefined, true),
    getLatestReferenceStatsSeason(admin),
  ]);
  const [refStats, fixtureMap, finishedPlTeamIds, startedPlTeamIds, finalised] = await Promise.all([
    loadReferenceStats(admin, refSeason),
    getGameweekFixtureMap(admin, currentSeason, gameweek),
    getFinishedPlTeamIds(gameweek).catch(() => new Set<number>()),
    gameweek === fpl.currentGw ? getLockedPlTeamIds(admin, gameweek).catch(() => null) : Promise.resolve(gameweek < fpl.currentGw ? null : new Set<number>()),
    isGameweekFinalised(admin, currentSeason, gameweek),
  ]);
  return {
    currentSeason,
    refStats: refStats ?? {},
    fixtureMap,
    finishedPlTeamIds,
    startedPlTeamIds,
    finalised,
    currentFplGw: fpl.currentGw,
    isCurrentFplGwFinished: fpl.isFinished,
    managers,
    now: Date.now(),
  };
}

/** Manager usernames by team. A Caretaker club has none. */
export async function loadManagers(admin: SupabaseClient, leagueId: string): Promise<Record<string, string | null>> {
  const { data } = await admin.from('teams').select('id, user:users(username)').eq('league_id', leagueId);
  const out: Record<string, string | null> = {};
  for (const t of (data ?? []) as { id: string; user: { username: string | null } | { username: string | null }[] | null }[]) {
    const u = Array.isArray(t.user) ? t.user[0] : t.user;
    out[t.id] = u?.username ?? null;
  }
  return out;
}
