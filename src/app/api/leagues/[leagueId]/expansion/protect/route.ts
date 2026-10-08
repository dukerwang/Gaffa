import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getExpansionClubIds, getOpenExpansion } from '@/lib/expansion/expansion';

/** Academy players and loans can't be taken, so they don't need protecting. */
const EXEMPT = new Set(['taxi', 'loan_out', 'loan_in']);

/**
 * POST /api/leagues/[leagueId]/expansion/protect
 * Body: { playerIds: string[] }
 *
 * Replaces the caller's protected list while the expansion is choosing
 * protections. Up to the expansion's protect count, all from the club's own
 * squad. A club that doesn't choose has its most valuable players protected
 * when the draft starts.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const playerIds: string[] = Array.isArray(body?.playerIds) ? [...new Set<string>(body.playerIds.filter((x: unknown) => typeof x === 'string'))] : [];

  const admin = createAdminClient();
  const expansion = await getOpenExpansion(admin, leagueId);
  if (!expansion || expansion.status !== 'protecting') {
    return NextResponse.json({ error: 'Protections are closed.' }, { status: 409 });
  }

  const { data: myTeam } = await admin.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).maybeSingle();
  if (!myTeam) return NextResponse.json({ error: 'No team in this league' }, { status: 403 });
  if ((await getExpansionClubIds(admin, expansion.id)).includes(myTeam.id)) {
    return NextResponse.json({ error: "A new club doesn't protect anyone." }, { status: 400 });
  }

  if (playerIds.length > expansion.protect_count) {
    return NextResponse.json({ error: `Protect at most ${expansion.protect_count} players.` }, { status: 400 });
  }

  const { data: squad } = await admin.from('roster_entries').select('player_id, status').eq('team_id', myTeam.id);
  const eligible = new Set((squad ?? []).filter((e) => !EXEMPT.has(e.status)).map((e) => e.player_id as string));
  const invalid = playerIds.filter((id) => !eligible.has(id));
  if (invalid.length > 0) {
    return NextResponse.json({ error: 'Protect players from your own squad. Academy and loan players are already safe.' }, { status: 400 });
  }

  await admin.from('expansion_protections').delete().eq('expansion_id', expansion.id).eq('team_id', myTeam.id);
  if (playerIds.length > 0) {
    const { error } = await admin
      .from('expansion_protections')
      .insert(playerIds.map((player_id) => ({ expansion_id: expansion.id, team_id: myTeam.id, player_id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, protected: playerIds.length });
}
