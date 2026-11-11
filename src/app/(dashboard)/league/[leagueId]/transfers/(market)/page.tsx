import { getSessionUser } from '@/lib/supabase/sessionUser';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { buildTransfersModel } from '@/lib/transfers/buildTransfersModel';
import MarketClient from '../MarketClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function TransfersPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const model = await buildTransfersModel(admin, leagueId, user.id);

  // No league, or the caller has no club in it.
  if (!model) notFound();

  return <MarketClient leagueId={leagueId} initial={model} />;
}
