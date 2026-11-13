import { getSessionUser } from '@/lib/supabase/sessionUser';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { buildTransfersModel } from '@/lib/transfers/buildTransfersModel';
import DealsClient from './DealsClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function DealsPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const model = await buildTransfersModel(admin, leagueId, user.id);
  if (!model) notFound();

  return <DealsClient leagueId={leagueId} initial={model} />;
}
