/**
 * Links from Gaffa into Futbolpedia, a separate product (futbolpedia.ai.studio). Client-safe.
 * Futbolpedia's routes: `#/p/<slug>` opens a dossier card, `#/scout?name=` opens Scout with a
 * name filled in (nothing is rated until the reader presses Rate), and
 * `#/gaffa/<leagueId>/<clubId>?q=` opens a conversation with the manager's club attached.
 */

export const FUTBOLPEDIA_DEFAULT_ORIGIN = 'https://futbolpedia.ai.studio';

export function futbolpediaPublicOrigin(): string {
  return (process.env.NEXT_PUBLIC_FUTBOLPEDIA_URL || FUTBOLPEDIA_DEFAULT_ORIGIN).replace(/\/$/, '');
}

export const futbolpediaCardUrl = (slug: string): string =>
  `${futbolpediaPublicOrigin()}/#/p/${encodeURIComponent(slug)}`;

export const futbolpediaScoutUrl = (name: string): string =>
  `${futbolpediaPublicOrigin()}/#/scout?${new URLSearchParams({ name }).toString()}`;

export function futbolpediaClubUrl(leagueId: string, clubId: string, question?: string): string {
  const q = question ? `?${new URLSearchParams({ q: question }).toString()}` : '';
  return `${futbolpediaPublicOrigin()}/#/gaffa/${leagueId}/${clubId}${q}`;
}

/** A shared Futbolpedia card for a player, without its rating (ratings stay on Futbolpedia). */
export interface FutbolpediaCard {
  name: string;
  edition: string;
  /** "Current form · Nov 2026", "Prime · 2003–06". */
  label: string;
  slug: string;
}

/** A name's card, null when Futbolpedia has none, undefined when the lookup failed. */
type Lookup = FutbolpediaCard | null | undefined;

const cache = new Map<string, Promise<Lookup>>();

/**
 * Futbolpedia's shared card for each name: the card, null when it has none, or undefined when
 * the lookup failed. Asked of Futbolpedia's public lookup straight from the browser (no Gaffa
 * function call), once per name per page load. A failed lookup isn't kept, so the next one asks
 * again rather than repeating a wrong "no dossier".
 */
export async function lookUpFutbolpediaCards(names: string[]): Promise<Record<string, Lookup>> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const missing = wanted.filter((n) => !cache.has(n));
  if (missing.length > 0) {
    const request: Promise<Record<string, FutbolpediaCard | null> | null> = fetch(
      `${futbolpediaPublicOrigin()}/api/cards/lookup?${new URLSearchParams({ names: missing.slice(0, 25).join(',') })}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => (d?.cards ?? {}) as Record<string, FutbolpediaCard | null>)
      .catch(() => null);
    for (const name of missing) {
      cache.set(
        name,
        request.then((cards) => {
          if (!cards) {
            cache.delete(name);
            return undefined;
          }
          return cards[name] ?? null;
        }),
      );
    }
  }
  const entries = await Promise.all(wanted.map(async (n) => [n, await cache.get(n)] as const));
  return Object.fromEntries(entries);
}
