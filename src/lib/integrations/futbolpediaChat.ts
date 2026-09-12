/**
 * Server-side Futbolpedia origin for in-app Gaffa chat.
 * Prefers FUTBOLPEDIA_URL; falls back to the public Ask origin.
 */
export function futbolpediaOrigin(): string {
  return (process.env.FUTBOLPEDIA_URL || process.env.NEXT_PUBLIC_FUTBOLPEDIA_URL || '').replace(
    /\/$/,
    '',
  );
}
