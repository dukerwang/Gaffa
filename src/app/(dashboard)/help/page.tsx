import { getSessionUser } from '@/lib/supabase/sessionUser';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HelpClient from '@/components/settings/HelpClient';

export const dynamic = 'force-dynamic';

export default async function HelpPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  return <HelpClient />;
}
