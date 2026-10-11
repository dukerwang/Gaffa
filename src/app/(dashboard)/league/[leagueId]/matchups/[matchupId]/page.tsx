import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { getFplStatus } from '@/lib/fpl/api';
import { loadMatchPage } from '@/lib/matchups/pages';
import { MatchView } from '@/components/gameweeks/Views';

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ leagueId: string; matchupId: string }>;
}

export default async function MatchupDetailPage({ params }: Props) {
    const { leagueId, matchupId } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const admin = createAdminClient();
    const [{ data: league }, { data: member }, fplStatus] = await Promise.all([
        admin.from('leagues').select('id, commissioner_id').eq('id', leagueId).single(),
        admin.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).maybeSingle(),
        getFplStatus().catch(() => null),
    ]);
    if (!league) notFound();
    if (!member && league.commissioner_id !== user.id) redirect('/dashboard');

    const props = await loadMatchPage(admin, { leagueId, matchupId, myTeamId: member?.id, fplStatus });
    if (!props) notFound();
    return <MatchView {...props} />;
}
