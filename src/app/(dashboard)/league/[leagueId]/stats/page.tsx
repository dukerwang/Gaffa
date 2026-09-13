import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import GlobalStatsTable from './GlobalStatsTable';
import type { Player } from '@/types';
import { getCurrentFplSeason, isFplSeasonKickedOff } from '@/lib/season/currentSeason';
import { loadSeasonLeaderboard } from '@/lib/stats/seasonStats';
import { isSiteAdminEmail } from '@/lib/auth/siteAdmin';
import { isPlayerMapped } from '@/lib/players/playerMapping';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export interface StatPlayer extends Player {
  owner_team_id: string | null;
  owner_team_name: string | null;
}

export default async function StatsPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const isSiteAdmin = isSiteAdminEmail(user.email);
  const admin = createAdminClient();

  // Validate league. Its season inputs and its clubs come in the same wave.
  const [{ data: league }, currentFpl, kickedOff, { data: allTeams }] = await Promise.all([
    admin
      .from('leagues')
      .select('id, name, current_season, previous_season')
      .eq('id', leagueId)
      .single(),
    getCurrentFplSeason(),
    isFplSeasonKickedOff(),
    admin
      .from('teams')
      .select('id')
      .eq('league_id', leagueId),
  ]);
  if (!league) notFound();

  let season = (league as any).current_season ?? currentFpl;
  if (season === currentFpl && !kickedOff) {
    season = (league as any).previous_season ?? season;
  }

  const teamIds = (allTeams ?? []).map((t: { id: string }) => t.id);

  // The leaderboard is the slow read (every stats row of the season); the
  // owner lookup beside it no longer waits for it to finish.
  const [{ players, shadowMaps }, { data: rosterEntries }] = await Promise.all([
    loadSeasonLeaderboard(admin, season),
    teamIds.length > 0
      ? admin
          .from('roster_entries')
          .select('player_id, team:teams(id, team_name)')
          .in('team_id', teamIds)
      : Promise.resolve({ data: null }),
  ]);

  // Roster entries for this league → owner map
  const ownerMap = new Map<string, { teamId: string; teamName: string }>();
  if (teamIds.length > 0) {
    for (const entry of rosterEntries ?? []) {
      const team = entry.team as any;
      if (team) {
        ownerMap.set(entry.player_id, { teamId: team.id, teamName: team.team_name });
      }
    }
  }

  // Merge owners
  const statPlayers: StatPlayer[] = players.map((p: any) => {
    const owner = ownerMap.get(p.id) ?? null;
    return {
      ...p,
      owner_team_id: owner?.teamId ?? null,
      owner_team_name: owner?.teamName ?? null,
    };
  });

  const visiblePlayers = isSiteAdmin ? statPlayers : statPlayers.filter(isPlayerMapped);

  return (
    <GlobalStatsTable
      leagueId={leagueId}
      leagueName={league.name}
      players={visiblePlayers}
      season={season}
      shadowMaps={shadowMaps}
      isSiteAdmin={isSiteAdmin}
    />
  );
}
