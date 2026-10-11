import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimCaretakerClub } from '@/lib/leagues/caretaker';
import { canJoinWithNewClub } from '@/lib/leagues/status';
import { expansionStartingBalance, getExpansionClubIds, getOpenExpansion } from '@/lib/expansion/expansion';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { inviteCode, teamName } = await req.json();

  if (!inviteCode?.trim()) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up league by invite code
  const { data: league } = await admin
    .from('leagues')
    .select('id, name, max_teams, faab_budget, status, is_dynasty')
    .eq('invite_code', inviteCode.trim().toLowerCase())
    .single();

  if (!league) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  // Check if user is already a member
  const { data: existing } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', league.id)
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json({ leagueId: league.id, alreadyMember: true });
  }

  // Once a league has history, a club the Caretaker runs is filled first. After
  // that, a newcomer only gets a brand-new club while the league waits for a
  // draft that rebuilds every squad (a redraft league between seasons); in a
  // league that's playing, a new empty club would have no squad or fixtures.
  // A dynasty league that's expanding (in the offseason) also takes new clubs
  // until it has the number it opened for; they're built in the expansion draft.
  let expansionId: string | null = null;
  let expansionClubIds: string[] = [];
  if (league.status !== 'setup') {
    try {
      const teamId = await claimCaretakerClub(admin, league.id, user.id);
      if (teamId) return NextResponse.json({ leagueId: league.id, teamId, takeover: true });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message ?? 'Failed to join league' }, { status: 500 });
    }
    const expansion = league.status === 'offseason' ? await getOpenExpansion(admin, league.id) : null;
    if (expansion?.status === 'protecting') {
      expansionClubIds = await getExpansionClubIds(admin, expansion.id);
      if (expansionClubIds.length < expansion.new_clubs) expansionId = expansion.id;
    }
    if (!expansionId && !canJoinWithNewClub(league)) {
      return NextResponse.json({ error: 'League is no longer accepting new members' }, { status: 400 });
    }
  }

  // Check capacity
  const { count } = await admin
    .from('league_members')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', league.id);

  if ((count ?? 0) >= league.max_teams) {
    return NextResponse.json({ error: 'League is full' }, { status: 400 });
  }

  // Add member
  const { error: memberErr } = await admin.from('league_members').insert({
    league_id: league.id,
    user_id: user.id,
  });
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

  // Create their team
  const { data: profile } = await admin
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single();
  const username = profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Manager';
  const resolvedTeamName = teamName?.trim() || `${username}'s Club`;

  // An expansion club starts with the league's median Club Balance.
  const faabBudget = expansionId
    ? await expansionStartingBalance(admin, league.id, expansionClubIds)
    : league.faab_budget;

  const { data: newTeam, error: teamErr } = await admin
    .from('teams')
    .insert({
      league_id: league.id,
      user_id: user.id,
      team_name: resolvedTeamName,
      abbreviation: null,
      faab_budget: faabBudget,
    })
    .select('id')
    .single();
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  if (expansionId && newTeam) {
    const { error: clubErr } = await admin.from('expansion_clubs').insert({ expansion_id: expansionId, team_id: newTeam.id });
    if (clubErr) return NextResponse.json({ error: clubErr.message }, { status: 500 });
    return NextResponse.json({ leagueId: league.id, expansion: true });
  }

  return NextResponse.json({ leagueId: league.id });
}
