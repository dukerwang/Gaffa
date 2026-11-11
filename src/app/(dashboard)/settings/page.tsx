import { getSessionUser } from '@/lib/supabase/sessionUser';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolvePrefs } from '@/lib/notifications/prefs';
import { isSiteAdminEmail } from '@/lib/auth/siteAdmin';
import SettingsClient from '@/components/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('notification_prefs')
    .eq('id', user.id)
    .single();

  return (
    <SettingsClient
      isSiteAdmin={isSiteAdminEmail(user.email)}
      initialPrefs={resolvePrefs(profile?.notification_prefs)}
    />
  );
}
