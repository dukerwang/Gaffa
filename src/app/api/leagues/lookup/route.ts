import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canJoinWithNewClub } from '@/lib/leagues/status';

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const code = req.nextUrl.searchParams.get('code')?.trim().toLowerCase();
  if (!code) return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });

  const admin = createAdminClient();

  const { data: league } = await admin
    .from('leagues')
    .select('id, name, max_teams, roster_size, faab_budget, is_dynasty, status')
    .eq('invite_code', code)
    .single();

  if (!league) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  const { count } = await admin
    .from('league_members')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', league.id);

  // After the draft, a newcomer joins by taking over the club the Caretaker
  // has run longest (the same order claim_caretaker_club_rpc uses).
  let openClub: { teamName: string } | null = null;
  if (league.status !== 'setup') {
    const { data: club } = await admin
      .from('teams')
      .select('team_name')
      .eq('league_id', league.id)
      .is('user_id', null)
      .order('caretaker_since', { ascending: true })
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (club) openClub = { teamName: club.team_name };
  }

  return NextResponse.json({
    openClub,
    /** Joining creates a new club (before the first draft, or between redraft seasons). */
    newClubOpen: canJoinWithNewClub(league),
    name: league.name,
    maxTeams: league.max_teams,
    currentTeams: count ?? 0,
    rosterSize: league.roster_size,
    faabBudget: league.faab_budget,
    isDynasty: league.is_dynasty,
    status: league.status,
  });
}
