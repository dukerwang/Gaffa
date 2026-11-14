import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminGrantStore, exchangeCode } from '@/lib/integrations/futbolpediaGrant';
import { grantErrorResponse } from '@/lib/integrations/futbolpediaGrantRoutes';

export const dynamic = 'force-dynamic';

/**
 * Futbolpedia's server exchanges a one-time code and its PKCE verifier for a
 * read-only grant token. `return_origin` must match the one the code was
 * issued for.
 */
export async function POST(req: NextRequest) {
  let body: { code?: unknown; code_verifier?: unknown; return_origin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const token = await exchangeCode(adminGrantStore(createAdminClient()), {
      code: body.code,
      codeVerifier: body.code_verifier,
      returnOrigin: body.return_origin,
    });
    return NextResponse.json({ access_token: token, token_type: 'bearer' });
  } catch (err) {
    return grantErrorResponse(err, 'token');
  }
}
