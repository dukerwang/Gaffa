import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/createNotification';

/**
 * POST /api/leagues/[leagueId]/commissioner
 * Body: { userId }
 *
 * Hands the commissioner role to another manager in the league. Only the
 * current commissioner can do it, and the new one must manage a club here.
 * A commissioner of a started league has to do this before leaving it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const newCommissionerId = typeof body?.userId === 'string' ? body.userId : null;
  if (!newCommissionerId) return NextResponse.json({ error: 'Choose a manager to hand the role to.' }, { status: 400 });

  const admin = createAdminClient();

  const { data: league } = await admin
    .from('leagues')
    .select('id, name, commissioner_id')
    .eq('id', leagueId)
    .maybeSingle();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Only the commissioner can hand over the role.' }, { status: 403 });
  }
  if (newCommissionerId === user.id) {
    return NextResponse.json({ error: "You're already the commissioner." }, { status: 400 });
  }

  const { data: newClub } = await admin
    .from('teams')
    .select('id, team_name')
    .eq('league_id', leagueId)
    .eq('user_id', newCommissionerId)
    .maybeSingle();
  if (!newClub) {
    return NextResponse.json({ error: 'The new commissioner must manage a club in this league.' }, { status: 400 });
  }

  // The commissioner filter makes the swap conditional on the caller still
  // holding the role, so two handovers at once can't both land.
  const { data: updated, error } = await admin
    .from('leagues')
    .update({ commissioner_id: newCommissionerId, updated_at: new Date().toISOString() })
    .eq('id', leagueId)
    .eq('commissioner_id', user.id)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Only the commissioner can hand over the role.' }, { status: 409 });
  }

  await createNotification(admin, {
    leagueId,
    userId: newCommissionerId,
    kind: 'club',
    title: "You're the commissioner",
    content: `You're now the commissioner of ${league.name}.`,
    url: `/league/${leagueId}/settings`,
  });

  return NextResponse.json({ success: true });
}
