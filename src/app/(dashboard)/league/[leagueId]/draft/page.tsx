import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import DraftRoom from './DraftRoom';
import type { League, Team, DraftPick } from '@/types';
import { loadDraftPool } from '@/lib/draft/loadDraftPool';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function DraftPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  // The league, membership, the clubs in draft order and every pick so far
  // need only the league id, so they go out together.
  const [{ data: league }, { data: membership }, { data: teamsData }, { data: picksData }] = await Promise.all([
    admin
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .single(),
    // Enforce membership
    admin
      .from('teams')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    // Fetch teams with draft_order
    admin
      .from('teams')
      .select('id, league_id, user_id, team_name, faab_budget, total_points, draft_order, created_at, updated_at')
      .eq('league_id', leagueId)
      .order('draft_order', { ascending: true }),
    // Fetch all picks with player + team info
    admin
      .from('draft_picks')
      .select('*, player:players(*), team:teams(id, team_name, user_id, draft_order)')
      .eq('league_id', leagueId)
      .order('pick', { ascending: true }),
  ]);

  if (!league) notFound();

  if (!membership && league.commissioner_id !== user.id) redirect('/dashboard');

  const teams = (teamsData ?? []) as Team[];

  const picks = (picksData ?? []) as DraftPick[];

  const { players, shadowMaps } = await loadDraftPool(admin, league);

  const myTeam = teams.find((t) => t.user_id === user.id) ?? null;

  return (
    <DraftRoom
      leagueId={leagueId}
      league={league as League}
      teams={teams}
      initialPicks={picks}
      allPlayers={players}
      myUserId={user.id}
      myTeam={myTeam}
      shadowMaps={shadowMaps}
    />
  );
}
