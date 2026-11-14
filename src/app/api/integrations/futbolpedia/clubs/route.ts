import { NextRequest, NextResponse } from 'next/server';
import { grantErrorResponse, grantUser, listGrantClubs, notConnected } from '@/lib/integrations/futbolpediaGrantRoutes';

export const dynamic = 'force-dynamic';

/** Every club the grant's manager runs, across leagues. Auth: `Authorization: Bearer <grant token>`. */
export async function GET(req: NextRequest) {
  try {
    const grant = await grantUser(req);
    if (!grant) return notConnected();
    return NextResponse.json({ clubs: await listGrantClubs(grant.userId) });
  } catch (err) {
    return grantErrorResponse(err, 'clubs');
  }
}
