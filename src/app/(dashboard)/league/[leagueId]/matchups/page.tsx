import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { getFplStatus } from '@/lib/fpl/api';
import { loadRoundPage } from '@/lib/matchups/pages';
import { RoundView } from '@/components/gameweeks/Views';

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ leagueId: string }>;
    searchParams: Promise<{ gw?: string }>;
}

export default async function MatchupsPage({ params, searchParams }: Props) {
    const { leagueId } = await params;
    const { gw } = await searchParams;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const admin = createAdminClient();
    const [{ data: league }, { data: member }, fplStatus] = await Promise.all([
        admin.from('leagues').select('id, commissioner_id, status, current_season').eq('id', leagueId).single(),
        admin.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).maybeSingle(),
        getFplStatus().catch(() => null),
    ]);
    if (!league) notFound();
    if (!member && league.commissioner_id !== user.id) redirect('/dashboard');

    const res = await loadRoundPage(admin, {
        leagueId, gwParam: gw, myTeamId: member?.id, leagueStatus: league.status, leagueSeason: league.current_season, fplStatus,
    });
    if ('redirect' in res) redirect(res.redirect);
    return <RoundView {...res.props} />;
}
