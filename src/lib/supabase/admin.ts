import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for server-side data fetching.
 * Bypasses RLS — only use after verifying the caller. Pages that only read data
 * can verify with getSessionUser() (local token check, valid until the token
 * expires). Mutations, API routes and privileged pages must verify with
 * createClient().auth.getUser(), which asks the Auth server and sees revocation.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
