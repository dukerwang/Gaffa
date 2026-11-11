import type { SupabaseClient, UserMetadata } from '@supabase/supabase-js';

/** The slice of a signed-in user that page renders read. */
export interface SessionUser {
  id: string;
  email?: string;
  user_metadata: UserMetadata;
}

/**
 * Identifies the signed-in user for a server-rendered page without a network
 * round trip. `auth.getClaims()` verifies the session JWT's signature against
 * the project's cached public key (the project signs with ES256), and only
 * calls Supabase Auth when it has to refresh an expired token.
 *
 * Use this to render pages. A signed-out or revoked session stays valid until
 * its token expires (about an hour), so mutations and API routes keep calling
 * `auth.getUser()`, which asks the Auth server.
 */
export async function getSessionUser(
  supabase: Pick<SupabaseClient, 'auth'>,
): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: claims.email,
    user_metadata: claims.user_metadata ?? {},
  };
}
