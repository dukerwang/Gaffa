const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Futbolpedia Gaffa-mode deep link. Hash matches Futbolpedia's `#/p/` / `#/c/` style.
 * Returns null when NEXT_PUBLIC_FUTBOLPEDIA_URL is unset or ids are not UUIDs.
 */
export function futbolpediaConnectHref(leagueId: string, clubId: string): string | null {
  const base = (process.env.NEXT_PUBLIC_FUTBOLPEDIA_URL || '').replace(/\/$/, '');
  if (!base) return null;
  if (!UUID.test(leagueId) || !UUID.test(clubId)) return null;
  return `${base}/#/gaffa/${leagueId}/${clubId}`;
}

/**
 * Where /connect/futbolpedia sends its answer when it has no opener to post
 * to (a blocked popup, or a mobile browser that opened a tab): Futbolpedia's
 * `#/gaffa/connected` route, on an origin already checked against the allowlist.
 */
export function futbolpediaConnectReturnUrl(
  returnOrigin: string,
  params: { code?: string; error?: string; state: string },
): string {
  const qs = new URLSearchParams();
  if (params.code) qs.set('code', params.code);
  if (params.error) qs.set('error', params.error);
  qs.set('state', params.state);
  return `${returnOrigin}/#/gaffa/connected?${qs.toString()}`;
}

/** The host an origin names ("futbolpedia.ai.studio", "localhost:3000"), shown so a manager can tell them apart. */
export function originHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
