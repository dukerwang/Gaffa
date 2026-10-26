import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { getFplStatus } from '@/lib/fpl/api';
import { loadTieView } from '@/lib/cups/loadTieView';
import { CupTieView } from '@/components/cups/CupTieView';

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ leagueId: string; tieId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CupTiePage({ params, searchParams }: Props) {
    const { leagueId, tieId } = await params;
    const { leg } = await searchParams;

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

    const props = await loadTieView(admin, {
        leagueId,
        tieId,
        leg: leg === '1' ? 1 : leg === '2' ? 2 : null,
        myTeamId: member?.id,
        fplStatus,
    });
    if (!props) notFound();
    return <CupTieView {...props} />;
}
