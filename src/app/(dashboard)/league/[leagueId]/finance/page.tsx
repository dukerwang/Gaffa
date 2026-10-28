import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
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

  const data = await loadFinance(createAdminClient(), leagueId, user.id);
  if (!data) {
    return <EmptyState>You don&rsquo;t have a club in this league.</EmptyState>;
  }

  return <FinanceClient data={data} />;
}
