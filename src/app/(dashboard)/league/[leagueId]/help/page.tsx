import { getSessionUser } from '@/lib/supabase/sessionUser';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import HelpClient from '@/components/settings/HelpClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueHelpPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: league } = await admin
    .from('leagues')
    .select('id, commissioner_id, is_dynasty')
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

  return <HelpClient leagueId={leagueId} isDynasty={league.is_dynasty !== false} />;
}
