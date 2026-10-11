import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllPages } from '@/lib/supabase/pagination';
import { isRedraft } from '@/lib/leagues/features';
import ExpansionClient, { type ExpansionModel, type ExpansionPlayer } from './ExpansionClient';

export const dynamic = 'force-dynamic';

const EXEMPT = new Set(['taxi', 'loan_out', 'loan_in']);

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function ExpansionPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: league } = await admin
    .from('leagues')
    .select('id, name, status, is_dynasty, commissioner_id, roster_size')
    .eq('id', leagueId)
    .single();
  if (!league) notFound();

  const { data: myTeam } = await admin.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).maybeSingle();
  const isCommissioner = league.commissioner_id === user.id;
  if (!myTeam && !isCommissioner) redirect('/dashboard');

  // The open expansion, or the most recent finished one.
  const { data: expansions } = await admin
    .from('expansions')
    .select('id, status, new_clubs, protect_count, per_club_cap, protection_deadline, created_at')
    .eq('league_id', leagueId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1);
  const expansion = expansions?.[0] ?? null;

  const { data: teams } = await admin.from('teams').select('id, team_name, user_id').eq('league_id', leagueId).order('team_name');
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.team_name as string]));

  let model: ExpansionModel = {
    leagueId,
    leagueName: league.name,
    canOpen: isCommissioner && !isRedraft(league) && league.status === 'offseason' && !expansion?.status?.match(/protecting|drafting/),
    isCommissioner,
    myTeamId: myTeam?.id ?? null,
    expansion: null,
  };

  if (expansion) {
    const [{ data: clubs }, { data: picks }, { data: onClock }] = await Promise.all([
      admin.from('expansion_clubs').select('team_id, pick_order').eq('expansion_id', expansion.id),
      admin.from('expansion_picks').select('pick_number, team_id, player_id, from_team_id, automatic').eq('expansion_id', expansion.id).order('pick_number'),
      expansion.status === 'drafting'
        ? admin.rpc('expansion_on_clock', { p_expansion_id: expansion.id })
        : Promise.resolve({ data: null }),
    ]);
    const newClubIds = new Set((clubs ?? []).map((c) => c.team_id as string));
    const isNewClub = !!myTeam && newClubIds.has(myTeam.id);

    // Squads of the existing clubs, for protection lists and the exposed pool.
    const existingIds = (teams ?? []).map((t) => t.id).filter((id) => !newClubIds.has(id));
    const entries = existingIds.length
      ? await fetchAllPages<{ id: string; team_id: string; player_id: string; status: string; player: any }>((from, to) =>
          admin
            .from('roster_entries')
            .select('id, team_id, player_id, status, player:players(id, name, primary_position, pl_team, market_value)')
            .in('team_id', existingIds)
            .order('id')
            .range(from, to),
        )
      : [];

    const { data: protections } = await admin
      .from('expansion_protections')
      .select('team_id, player_id')
      .eq('expansion_id', expansion.id);
    const protectedIds = new Set((protections ?? []).map((p) => p.player_id as string));
    const lostByClub = new Map<string, number>();
    for (const p of picks ?? []) if (p.from_team_id) lostByClub.set(p.from_team_id, (lostByClub.get(p.from_team_id) ?? 0) + 1);

    const toPlayer = (e: { player: any; team_id: string; status: string }): ExpansionPlayer => ({
      id: e.player.id,
      name: e.player.name,
      position: e.player.primary_position,
      club: e.player.pl_team,
      marketValue: Number(e.player.market_value ?? 0),
      exempt: EXEMPT.has(e.status),
    });

    const mySquad = myTeam && !isNewClub
      ? entries.filter((e) => e.team_id === myTeam.id && e.player).map(toPlayer).sort((a, b) => b.marketValue - a.marketValue)
      : [];
    const myProtected = (protections ?? []).filter((p) => p.team_id === myTeam?.id).map((p) => p.player_id as string);

    // While clubs are still choosing, nobody sees another club's protections.
    const exposedByClub = expansion.status === 'drafting'
      ? existingIds.map((teamId) => ({
          teamId,
          teamName: teamName.get(teamId) ?? 'Club',
          lost: lostByClub.get(teamId) ?? 0,
          players: entries
            .filter((e) => e.team_id === teamId && e.player && !EXEMPT.has(e.status) && !protectedIds.has(e.player_id))
            .map(toPlayer)
            .sort((a, b) => b.marketValue - a.marketValue),
        }))
      : [];

    let freeAgents: ExpansionPlayer[] = [];
    if (expansion.status === 'drafting') {
      const owned = new Set(
        (await fetchAllPages<{ player_id: string }>((from, to) =>
          admin.from('roster_entries').select('player_id').eq('league_id', leagueId).order('player_id').range(from, to),
        )).map((r) => r.player_id),
      );
      const { data: pool } = await admin
        .from('players')
        .select('id, name, primary_position, pl_team, market_value')
        .eq('is_active', true)
        .order('market_value', { ascending: false, nullsFirst: false })
        .limit(250);
      freeAgents = (pool ?? [])
        .filter((p) => !owned.has(p.id))
        .slice(0, 120)
        .map((p) => ({ id: p.id, name: p.name, position: p.primary_position, club: p.pl_team, marketValue: Number(p.market_value ?? 0), exempt: false }));
    }

    const playerName = new Map<string, string>();
    for (const e of entries) if (e.player) playerName.set(e.player_id, e.player.name);
    const pickPlayerIds = (picks ?? []).map((p) => p.player_id).filter((id) => !playerName.has(id));
    if (pickPlayerIds.length) {
      const { data: named } = await admin.from('players').select('id, name').in('id', pickPlayerIds);
      for (const p of named ?? []) playerName.set(p.id, p.name);
    }

    model = {
      ...model,
      expansion: {
        id: expansion.id,
        status: expansion.status,
        newClubs: expansion.new_clubs,
        protectCount: expansion.protect_count,
        perClubCap: expansion.per_club_cap,
        protectionDeadline: expansion.protection_deadline,
        clubs: (clubs ?? [])
          .sort((a, b) => (a.pick_order ?? 99) - (b.pick_order ?? 99))
          .map((c) => ({ teamId: c.team_id, teamName: teamName.get(c.team_id) ?? 'New club' })),
        isNewClub,
        onClock: (onClock as string | null) ?? null,
        onClockName: onClock ? teamName.get(onClock as string) ?? null : null,
        myTurn: !!myTeam && onClock === myTeam.id,
        mySquad,
        myProtected,
        exposedByClub,
        freeAgents,
        picks: (picks ?? []).map((p) => ({
          number: p.pick_number,
          teamName: teamName.get(p.team_id) ?? 'New club',
          playerName: playerName.get(p.player_id) ?? 'Player',
          from: p.from_team_id ? teamName.get(p.from_team_id) ?? 'a club' : null,
          automatic: p.automatic,
        })),
      },
    };
  }

  return <ExpansionClient model={model} />;
}
