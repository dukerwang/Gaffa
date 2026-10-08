import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/createNotification';
import { getOpenExpansion, rebuildSeasonForExpansion } from '@/lib/expansion/expansion';

/**
 * POST /api/leagues/[leagueId]/expansion/pick
 * Body: { playerId?: string }
 *
 * Makes the pick for the new club on the clock: an exposed player (no club
 * loses more than the cap) or a free agent. The club's manager picks; the
 * commissioner can also pick for whichever club is on the clock, so one absent
 * manager can't stall the draft. With no playerId, the pick is made
 * automatically (most valuable exposed player still allowed, else the most
 * valuable free agent). When the last squad fills, the season's schedule and
 * cups are rebuilt with the new clubs in them.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const playerId = typeof body?.playerId === 'string' ? body.playerId : null;

  const admin = createAdminClient();
  const { data: league } = await admin
    .from('leagues')
    .select('name, commissioner_id, current_season')
    .eq('id', leagueId)
    .maybeSingle();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  const expansion = await getOpenExpansion(admin, leagueId);
  if (!expansion || expansion.status !== 'drafting') {
    return NextResponse.json({ error: "The expansion draft isn't running." }, { status: 409 });
  }

  const { data: onClock } = await admin.rpc('expansion_on_clock', { p_expansion_id: expansion.id });
  if (!onClock) return NextResponse.json({ error: 'Every new club is full.' }, { status: 409 });

  const { data: club } = await admin.from('teams').select('id, user_id').eq('id', onClock as string).maybeSingle();
  const isCommissioner = league.commissioner_id === user.id;
  if (club?.user_id !== user.id && !isCommissioner) {
    return NextResponse.json({ error: "It isn't your pick." }, { status: 403 });
  }

  const { data, error } = await admin.rpc('expansion_pick_rpc', {
    p_expansion_id: expansion.id,
    p_team_id: onClock,
    p_player_id: playerId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = data as { success: boolean; error?: string; complete?: boolean; on_clock?: string | null; from_team_id?: string | null; player_id?: string };
  if (!res.success) return NextResponse.json({ error: res.error }, { status: 409 });

  // Tell the club that lost a player.
  if (res.from_team_id && res.player_id) {
    const [{ data: loser }, { data: player }] = await Promise.all([
      admin.from('teams').select('user_id').eq('id', res.from_team_id).maybeSingle(),
      admin.from('players').select('name').eq('id', res.player_id).maybeSingle(),
    ]);
    await createNotification(admin, {
      leagueId,
      userId: loser?.user_id ?? null,
      kind: 'club',
      title: 'Expansion Draft',
      content: `${player?.name ?? 'A player'} was taken in the expansion draft.`,
      url: `/league/${leagueId}/expansion`,
    });
  }

  if (res.complete) {
    const rebuilt = await rebuildSeasonForExpansion(admin, leagueId, league.current_season);
    const { data: teams } = await admin.from('teams').select('user_id').eq('league_id', leagueId);
    await Promise.all(
      (teams ?? []).map((t) =>
        createNotification(admin, {
          leagueId,
          userId: t.user_id,
          kind: 'club',
          title: 'Expansion Draft Complete',
          content: `The ${league.name} expansion draft is complete. The new season's fixtures and cups now include the new clubs.`,
          url: `/league/${leagueId}/expansion`,
        }),
      ),
    );
    return NextResponse.json({ success: true, complete: true, ...rebuilt });
  }

  if (res.on_clock && res.on_clock !== onClock) {
    const { data: next } = await admin.from('teams').select('user_id').eq('id', res.on_clock).maybeSingle();
    await createNotification(admin, {
      leagueId,
      userId: next?.user_id ?? null,
      kind: 'club',
      title: 'On the Clock',
      content: `It's your pick in the ${league.name} expansion draft.`,
      url: `/league/${leagueId}/expansion`,
      tag: `expansion-turn-${expansion.id}`,
    });
  }

  return NextResponse.json({ success: true, complete: false });
}
