import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** The signed-in manager's live Futbolpedia grants, for Settings › Connected Apps. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from('futbolpedia_grants')
    .select('id, return_origin, created_at, last_used_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[futbolpedia/grants]', error.message);
    return NextResponse.json({ error: 'Could not load connected apps' }, { status: 500 });
  }
  return NextResponse.json({ grants: data ?? [] });
}
