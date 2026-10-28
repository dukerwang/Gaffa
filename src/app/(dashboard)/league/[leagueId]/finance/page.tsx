import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound, redirect } from 'next/navigation';
import EmptyState from '@/components/ui/EmptyState';
import { loadFinance } from '@/lib/finance/loadFinance';
import FinanceClient from './FinanceClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function FinancePage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const data = await loadFinance(admin, leagueId, user.id);
  if (!data) {
    // No club here: a missing league is a 404, a commissioner without a club
    // gets a notice, and anyone else goes back to their leagues.
    const { data: league } = await admin.from('leagues').select('commissioner_id').eq('id', leagueId).maybeSingle();
    if (!league) notFound();
    if (league.commissioner_id !== user.id) redirect('/dashboard');
    return <EmptyState>You don&rsquo;t have a club in this league.</EmptyState>;
  }

  return <FinanceClient data={data} />;
}
