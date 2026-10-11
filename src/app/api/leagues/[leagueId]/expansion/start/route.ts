import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/createNotification';
import { getOpenExpansion } from '@/lib/expansion/expansion';

/**
 * POST /api/leagues/[leagueId]/expansion/start
 *
 * Closes protections and starts the picks (start_expansion_draft_rpc): any
 * club short of its protected list has its most valuable players protected,
 * and the new clubs get a random pick order.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: league } = await admin.from('leagues').select('name, commissioner_id').eq('id', leagueId).maybeSingle();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });
  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Only the commissioner can start the expansion draft.' }, { status: 403 });
  }

  const expansion = await getOpenExpansion(admin, leagueId);
  if (!expansion) return NextResponse.json({ error: 'No expansion draft is open.' }, { status: 404 });

  const { data, error } = await admin.rpc('start_expansion_draft_rpc', { p_expansion_id: expansion.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = data as { success: boolean; error?: string; on_clock?: string | null; automatic_protections?: number };
  if (!res.success) return NextResponse.json({ error: res.error }, { status: 409 });

  if (res.on_clock) {
    const { data: club } = await admin.from('teams').select('user_id').eq('id', res.on_clock).maybeSingle();
    await createNotification(admin, {
      leagueId,
      userId: club?.user_id ?? null,
      kind: 'club',
      title: 'On the Clock',
      content: `The ${league.name} expansion draft has started, and it's your pick.`,
      url: `/league/${leagueId}/expansion`,
    });
  }

  return NextResponse.json({ success: true, automaticProtections: res.automatic_protections ?? 0 });
}
