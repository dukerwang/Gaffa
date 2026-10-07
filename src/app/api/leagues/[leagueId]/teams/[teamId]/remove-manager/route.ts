import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canLeaveLeague } from '@/lib/leagues/leaveGuard';
import { handClubToCaretaker } from '@/lib/leagues/caretaker';
import { createNotification } from '@/lib/notifications/createNotification';

/**
 * POST /api/leagues/[leagueId]/teams/[teamId]/remove-manager
 *
 * The commissioner removes a club's manager. In a league that has drafted,
 * the club passes to the Caretaker and keeps its squad, balance and record
 * until a new manager joins. The commissioner can't remove themselves; they
 * hand the role on and leave instead.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ leagueId: string; teamId: string }> },
) {
  const { leagueId, teamId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: league } = await admin
    .from('leagues')
    .select('id, name, commissioner_id, status')
    .eq('id', leagueId)
    .maybeSingle();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Only the commissioner can remove a manager.' }, { status: 403 });
  }
  if (canLeaveLeague(league.status)) {
    return NextResponse.json(
      { error: "Managers can leave before the draft themselves. Removing one hands their club to the Caretaker, so it's only for leagues that have drafted." },
      { status: 400 },
    );
  }

  const { data: team } = await admin
    .from('teams')
    .select('id, team_name, user_id')
    .eq('id', teamId)
    .eq('league_id', leagueId)
    .maybeSingle();
  if (!team) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
  if (team.user_id == null) {
    return NextResponse.json({ error: 'The Caretaker already runs this club.' }, { status: 409 });
  }
  if (team.user_id === user.id) {
    return NextResponse.json(
      { error: "You can't remove yourself. Hand the commissioner role to another manager, then leave the league." },
      { status: 400 },
    );
  }

  const removedUserId = team.user_id;
  await handClubToCaretaker(admin, team.id);

  await createNotification(admin, {
    leagueId,
    userId: removedUserId,
    kind: 'club',
    title: 'Removed from league',
    content: `The commissioner removed you from ${league.name}. ${team.team_name} is run by the Caretaker until a new manager joins.`,
    url: '/dashboard',
  });

  return NextResponse.json({ success: true });
}
