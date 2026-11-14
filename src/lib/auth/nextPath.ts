/**
 * Where to send a manager after sign-in or sign-up. Only a same-site path is accepted, so a
 * crafted `?next=` can't bounce someone to another site after they sign in.
 */
export const NEXT_PATH_COOKIE = 'gaffa_next';

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // Control characters and backslashes have been used to smuggle a host past checks like the above.
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  return raw;
}

/**
 * The return path stored in NEXT_PATH_COOKIE. Next's `request.cookies` has already URI-decoded
 * the value, so it's checked as it is: decoding it again would mangle an encoded `&` or `%`.
 */
export function nextPathFromCookie(value: string | undefined): string | null {
  return safeNextPath(value);
}

/** The `next` of the page in the address bar, in the browser. */
export function currentNextPath(): string | null {
  if (typeof window === 'undefined') return null;
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}

/**
 * Before an OAuth redirect: the round trip drops query strings unless Supabase allowlists them,
 * so the return path rides in a ten-minute cookie that /auth/callback reads. No path clears it.
 */
export function rememberNextForOAuth(next: string | null): void {
  document.cookie = next
    ? `${NEXT_PATH_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax; Secure`
    : `${NEXT_PATH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}
