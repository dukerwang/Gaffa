import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminGrantStore } from '@/lib/integrations/futbolpediaGrant';
import { grantErrorResponse, grantUser, notConnected } from '@/lib/integrations/futbolpediaGrantRoutes';

export const dynamic = 'force-dynamic';

/** Futbolpedia's Disconnect: revokes the calling grant. */
export async function DELETE(req: NextRequest) {
  try {
    const grant = await grantUser(req);
    if (!grant) return notConnected();
    await adminGrantStore(createAdminClient()).revokeGrant(grant.grantId, grant.userId, new Date());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return grantErrorResponse(err, 'grant');
  }
}
