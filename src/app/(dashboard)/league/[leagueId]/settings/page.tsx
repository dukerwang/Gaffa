import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePrefs } from '@/lib/notifications/prefs';
import { isSiteAdminEmail } from '@/lib/auth/siteAdmin';
import SettingsClient from '@/components/settings/SettingsClient';
import { canLeaveLeague } from '@/lib/leagues/leaveGuard';
import type { CommissionerClub } from '@/components/settings/CommissionerTools';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueSettingsPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: league } = await admin
    .from('leagues')
    .select('id, name, commissioner_id, status')
    .eq('id', leagueId)
    .single();

  if (!league) notFound();

  const { data: myTeam } = await admin
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!myTeam && league.commissioner_id !== user.id) {
    redirect('/dashboard');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', user.id)
    .single();

  const isCommissioner = league.commissioner_id === user.id;
  const started = !canLeaveLeague(league.status);

  // The commissioner's controls (Transfer Commissioner, Remove Manager) only
  // apply once the draft has started; before it, managers leave themselves.
  let commissionerClubs: CommissionerClub[] | null = null;
  if (isCommissioner && started) {
    const { data: clubs } = await admin
      .from('teams')
      .select('id, team_name, user_id, user:users(username)')
      .eq('league_id', leagueId)
      .order('team_name');
    commissionerClubs = (clubs ?? []).map((c) => {
      const u = (Array.isArray(c.user) ? c.user[0] : c.user) as { username?: string } | null;
      return { teamId: c.id, teamName: c.team_name, userId: c.user_id, managerName: u?.username ?? null };
    });
  }

  return (
    <SettingsClient
      leagueId={leagueId}
      leagueName={league.name}
      isCommissioner={isCommissioner}
      canLeave={!started}
      isSiteAdmin={isSiteAdminEmail(user.email)}
      initialPrefs={resolvePrefs(profile?.notification_prefs)}
      myUserId={user.id}
      commissionerClubs={commissionerClubs}
    />
  );
}
