import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminGrantStore } from '@/lib/integrations/futbolpediaGrant';
import { grantErrorResponse } from '@/lib/integrations/futbolpediaGrantRoutes';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ grantId: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Revoke from Settings › Connected Apps. Only the grant's own manager can. */
export async function DELETE(_req: NextRequest, { params }: Props) {
  const { grantId } = await params;
  if (!UUID.test(grantId)) return NextResponse.json({ error: 'Invalid grant' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const revoked = await adminGrantStore(createAdminClient()).revokeGrant(grantId, user.id, new Date());
    if (!revoked) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return grantErrorResponse(err, 'grants');
  }
}
