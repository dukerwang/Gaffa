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
 * If verification itself fails (the public key can't be fetched, say), this
 * falls back to `auth.getUser()` so a Supabase hiccup doesn't sign everyone
 * out. A request with no session at all returns null without that fallback.
 *
 * Use this to render pages. A signed-out or revoked session stays valid until
 * its token expires (about an hour), so mutations, API routes and privileged
 * pages keep calling `auth.getUser()`, which asks the Auth server.
 */
export async function getSessionUser(
  supabase: Pick<SupabaseClient, 'auth'>,
): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (claims?.sub) {
    return {
      id: claims.sub,
      email: claims.email,
      user_metadata: claims.user_metadata ?? {},
    };
  }
  if (!error) return null;

  const { data: fallback } = await supabase.auth.getUser();
  const user = fallback?.user;
  if (!user) return null;
  return { id: user.id, email: user.email, user_metadata: user.user_metadata ?? {} };
}
