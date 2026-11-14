import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminGrantStore, issueCode } from '@/lib/integrations/futbolpediaGrant';
import { grantErrorResponse } from '@/lib/integrations/futbolpediaGrantRoutes';

export const dynamic = 'force-dynamic';

/**
 * Allow on /connect/futbolpedia: issues a one-time code for the signed-in
 * manager. Same-origin only (the approval page), so no CORS.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { code_challenge?: unknown; return_origin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const code = await issueCode(adminGrantStore(createAdminClient()), {
      userId: user.id,
      codeChallenge: body.code_challenge,
      returnOrigin: body.return_origin,
    });
    return NextResponse.json({ code });
  } catch (err) {
    return grantErrorResponse(err, 'authorize');
  }
}
