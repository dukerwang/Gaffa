import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRedraft } from '@/lib/leagues/features';
import { createNotification } from '@/lib/notifications/createNotification';
import { EXPANSION_ONLY_IN_OFFSEASON, getExpansionClubIds, getOpenExpansion } from '@/lib/expansion/expansion';

type Props = { params: Promise<{ leagueId: string }> };

async function loadCommissionerLeague(leagueId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: league } = await admin
    .from('leagues')
    .select('id, name, status, is_dynasty, commissioner_id, max_teams, current_season')
    .eq('id', leagueId)
    .maybeSingle();
  if (!league) return { ok: false as const, response: NextResponse.json({ error: 'League not found' }, { status: 404 }) };
  if (league.commissioner_id !== user.id) {
    return { ok: false as const, response: NextResponse.json({ error: 'Only the commissioner can run an expansion draft.' }, { status: 403 }) };
  }
  return { ok: true as const, admin, league };
}

/**
 * POST /api/leagues/[leagueId]/expansion
 * Body: { newClubs: 1-4, protectionDeadline?: ISO date }
 *
 * Opens an expansion draft. Dynasty leagues only (a redraft league takes new
 * managers before its next draft), and only in the offseason. Room is made for
 * the new clubs; they join with the league's invite code.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { leagueId } = await params;
  const loaded = await loadCommissionerLeague(leagueId);
  if (!loaded.ok) return loaded.response;
  const { admin, league } = loaded;

  if (isRedraft(league)) {
    return NextResponse.json({ error: 'A redraft league adds clubs before its next draft. Share the invite code instead.' }, { status: 400 });
  }
  if (league.status !== 'offseason') return NextResponse.json({ error: EXPANSION_ONLY_IN_OFFSEASON }, { status: 400 });
  if (await getOpenExpansion(admin, leagueId)) {
    return NextResponse.json({ error: 'An expansion draft is already open.' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const newClubs = Math.round(Number(body?.newClubs ?? 1));
  if (!Number.isFinite(newClubs) || newClubs < 1 || newClubs > 4) {
    return NextResponse.json({ error: 'Add between 1 and 4 clubs.' }, { status: 400 });
  }
  const deadline = typeof body?.protectionDeadline === 'string' ? body.protectionDeadline : null;

  const { count: clubCount } = await admin.from('teams').select('id', { count: 'exact', head: true }).eq('league_id', leagueId);
  const needed = (clubCount ?? 0) + newClubs;

  const { data: expansion, error } = await admin
    .from('expansions')
    .insert({ league_id: leagueId, season: league.current_season, new_clubs: newClubs, protection_deadline: deadline })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if ((league.max_teams ?? 0) < needed) {
    await admin.from('leagues').update({ max_teams: needed, updated_at: new Date().toISOString() }).eq('id', leagueId);
  }

  const { data: teams } = await admin.from('teams').select('user_id').eq('league_id', leagueId);
  await Promise.all(
    (teams ?? []).map((t) =>
      createNotification(admin, {
        leagueId,
        userId: t.user_id,
        kind: 'club',
        title: 'Expansion Draft',
        content: `${league.name} is adding ${newClubs === 1 ? 'a new club' : `${newClubs} new clubs`}. Protect 8 players before the draft starts. Your academy and anyone out on loan are safe anyway, and no club loses more than 2.`,
        url: `/league/${leagueId}/expansion`,
      }),
    ),
  );

  return NextResponse.json({ success: true, expansionId: expansion.id });
}

/**
 * DELETE /api/leagues/[leagueId]/expansion
 *
 * Cancels an expansion draft that hasn't started. Any new club that already
 * joined is removed: it has no squad, fixtures or history yet.
 */
export async function DELETE(_req: NextRequest, { params }: Props) {
  const { leagueId } = await params;
  const loaded = await loadCommissionerLeague(leagueId);
  if (!loaded.ok) return loaded.response;
  const { admin } = loaded;

  const expansion = await getOpenExpansion(admin, leagueId);
  if (!expansion) return NextResponse.json({ error: 'No expansion draft is open.' }, { status: 404 });
  if (expansion.status !== 'protecting') {
    return NextResponse.json({ error: "An expansion draft can't be cancelled once picks have started." }, { status: 409 });
  }

  const newClubIds = await getExpansionClubIds(admin, expansion.id);
  if (newClubIds.length > 0) {
    const { data: clubs } = await admin.from('teams').select('id, user_id').in('id', newClubIds);
    const userIds = (clubs ?? []).map((c) => c.user_id).filter((id): id is string => !!id);
    await admin.from('teams').delete().in('id', newClubIds);
    if (userIds.length) await admin.from('league_members').delete().eq('league_id', leagueId).in('user_id', userIds);
  }
  await admin.from('expansions').update({ status: 'cancelled' }).eq('id', expansion.id);

  return NextResponse.json({ success: true });
}
