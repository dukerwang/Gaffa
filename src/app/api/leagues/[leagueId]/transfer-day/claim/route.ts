import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRedraft } from '@/lib/leagues/features';
import { getLockedPlTeamIds } from '@/lib/fixtures/lockout';
import { getTransferDayWindow } from '@/lib/transferDay/window';

/**
 * POST /api/leagues/[leagueId]/transfer-day/claim
 * Body: { playerId, dropPlayerId? }
 *
 * Signs a free agent instantly, for nothing, in a redraft league. Open from
 * Transfer Day until the player's own club kicks off that gameweek. A player
 * still up for auction (anyone bid, or he was dropped since the last Transfer
 * Day) can only be bid for. The race-sensitive checks and the writes happen in
 * claim_free_agent_rpc (migration 174); this route owns the timing.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const playerId = typeof body?.playerId === 'string' ? body.playerId : null;
  const dropPlayerId = typeof body?.dropPlayerId === 'string' ? body.dropPlayerId : null;
  if (!playerId) return NextResponse.json({ error: 'Choose a player to sign.' }, { status: 400 });

  const admin = createAdminClient();

  const { data: league } = await admin.from('leagues').select('id, is_dynasty, status').eq('id', leagueId).maybeSingle();
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });
  if (!isRedraft(league)) {
    return NextResponse.json({ error: 'Instant signings are for redraft leagues. Bid for the player instead.' }, { status: 400 });
  }

  const { data: myTeam } = await admin
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!myTeam) return NextResponse.json({ error: 'No team in this league' }, { status: 403 });

  const window = await getTransferDayWindow(admin);
  if (!window.instantOpen || window.instantGameweek == null) {
    return NextResponse.json(
      { error: "Instant signings open on Transfer Day and close when the gameweek's last match kicks off. Bid for him to sign him on the next Transfer Day." },
      { status: 409 },
    );
  }

  const ids = [playerId, ...(dropPlayerId ? [dropPlayerId] : [])];
  const { data: players } = await admin.from('players').select('id, name, pl_team_id').in('id', ids);
  const player = players?.find((p) => p.id === playerId);
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  const locked = await getLockedPlTeamIds(admin, window.instantGameweek);
  if (player.pl_team_id != null && locked.has(player.pl_team_id)) {
    return NextResponse.json(
      { error: `${player.name}'s match has kicked off. Bid for him to sign him on the next Transfer Day.` },
      { status: 409 },
    );
  }
  const drop = dropPlayerId ? players?.find((p) => p.id === dropPlayerId) : null;
  if (drop?.pl_team_id != null && locked.has(drop.pl_team_id)) {
    return NextResponse.json({ error: `You can't drop ${drop.name} once his match has kicked off.` }, { status: 409 });
  }

  // The same IR rule as bidding: no signing while a fit player sits on IR.
  const { data: irEntries } = await admin
    .from('roster_entries')
    .select('id, player:players(fpl_status)')
    .eq('team_id', myTeam.id)
    .eq('status', 'ir');
  if (irEntries?.some((e) => (e.player as unknown as { fpl_status: string } | null)?.fpl_status === 'a')) {
    return NextResponse.json({ error: 'Activate the fit player on your IR before signing anyone.' }, { status: 400 });
  }

  const { data: result, error } = await admin.rpc('claim_free_agent_rpc', {
    p_league_id: leagueId,
    p_team_id: myTeam.id,
    p_player_id: playerId,
    p_drop_player_id: dropPlayerId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = result as { success: boolean; error?: string; player_name?: string };
  if (!res?.success) return NextResponse.json({ error: res?.error ?? 'Could not sign that player.' }, { status: 409 });

  return NextResponse.json({ success: true, playerName: res.player_name });
}
