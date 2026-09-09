/**
 * src/lib/fixtures/gameweekFixtures.ts
 *
 * Resolves fixture opponents and kickoff times for each club in a given gameweek.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveClub } from '@/lib/clubs/registry';

export interface ClubGameweekFixture {
  opponent: string;          // e.g. "MCI (H)" or "CHE (A)"
  opponentShort: string;     // e.g. "MCI"
  isHome: boolean;
  kickoffTime: string | null;
  finished: boolean;
  score?: string | null;
}

export async function getGameweekFixtureMap(
  admin: SupabaseClient,
  season: string,
  gameweek: number,
): Promise<Record<string, ClubGameweekFixture>> {
  const map: Record<string, ClubGameweekFixture> = {};
  if (!gameweek || !season) return map;

  const { data: fixtures } = await admin
    .from('pl_fixtures')
    .select('home_club, away_club, home_score, away_score, finished, kickoff_time')
    .eq('season', season)
    .eq('gameweek', gameweek);

  for (const f of fixtures ?? []) {
    const homeClub = resolveClub(f.home_club);
    const awayClub = resolveClub(f.away_club);

    const homeShort = homeClub?.shortName ?? f.home_club.toUpperCase();
    const awayShort = awayClub?.shortName ?? f.away_club.toUpperCase();

    const scoreHome = f.finished && f.home_score != null && f.away_score != null
      ? `${f.home_score}-${f.away_score}`
      : null;
    const scoreAway = f.finished && f.home_score != null && f.away_score != null
      ? `${f.away_score}-${f.home_score}`
      : null;

    const homeEntry: ClubGameweekFixture = {
      opponent: `${awayShort} (H)`,
      opponentShort: awayShort,
      isHome: true,
      kickoffTime: f.kickoff_time,
      finished: !!f.finished,
      score: scoreHome,
    };

    const awayEntry: ClubGameweekFixture = {
      opponent: `${homeShort} (A)`,
      opponentShort: homeShort,
      isHome: false,
      kickoffTime: f.kickoff_time,
      finished: !!f.finished,
      score: scoreAway,
    };

    if (homeClub) {
      map[homeClub.slug] = homeEntry;
      map[homeClub.name.toLowerCase()] = homeEntry;
      map[homeClub.shortName.toLowerCase()] = homeEntry;
      map[homeClub.shortName] = homeEntry;
    } else {
      map[f.home_club] = homeEntry;
      map[f.home_club.toLowerCase()] = homeEntry;
    }

    if (awayClub) {
      map[awayClub.slug] = awayEntry;
      map[awayClub.name.toLowerCase()] = awayEntry;
      map[awayClub.shortName.toLowerCase()] = awayEntry;
      map[awayClub.shortName] = awayEntry;
    } else {
      map[f.away_club] = awayEntry;
      map[f.away_club.toLowerCase()] = awayEntry;
    }
  }

  return map;
}

export function getPlayerFixture(
  player: { pl_team?: string | null } | undefined | null,
  fixtureMap?: Record<string, ClubGameweekFixture>,
): ClubGameweekFixture | undefined {
  if (!player?.pl_team || !fixtureMap) return undefined;
  const club = resolveClub(player.pl_team);
  if (club) {
    return (
      fixtureMap[club.slug] ??
      fixtureMap[club.name.toLowerCase()] ??
      fixtureMap[club.shortName.toLowerCase()] ??
      fixtureMap[club.shortName]
    );
  }
  return fixtureMap[player.pl_team.toLowerCase()] ?? fixtureMap[player.pl_team];
}
