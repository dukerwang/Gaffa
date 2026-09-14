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
