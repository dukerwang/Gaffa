/**
 * Where to send a manager after sign-in. Only a same-site path is accepted, so
 * a crafted `?next=` can't bounce someone to another site after they sign in.
 */
export const NEXT_PATH_COOKIE = 'gaffa_next';

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // Control characters and backslashes have been used to smuggle a host past checks like the above.
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  return raw;
}

/** The return path stored in NEXT_PATH_COOKIE, or null when it's missing, malformed or off-site. */
export function nextPathFromCookie(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return safeNextPath(decodeURIComponent(value));
  } catch {
    return null;
  }
}
