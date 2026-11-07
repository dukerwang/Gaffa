/**
 * The one place the site's public identity lives, so the layout, the home page,
 * the sitemap, robots and the structured data can't drift apart.
 *
 * `url` is the host that actually serves pages. The apex (gaffa.live) answers
 * with a redirect to www.gaffa.live, and a sitemap or canonical that points at
 * a URL which redirects tells search engines to distrust it. If the primary
 * domain in Vercel ever changes, change it here and nowhere else.
 */
export const SITE = {
  name: 'Gaffa',
  url: 'https://www.gaffa.live',
  title: 'Gaffa · Draft and Own Your Premier League Players',
  description:
    'Draft and own your Premier League players in a league with friends. Scores match what you watched, transfers follow real moves, four trophies a season.',
  logoPath: '/apple-icon.png',
} as const;

/** Routes a search engine can reach without an account, in sitemap order. */
export const PUBLIC_PATHS = ['/', '/guide', '/lineup-builder', '/privacy', '/terms'] as const;

/** Routes that need a session or are internal. Kept out of search results. */
export const PRIVATE_PATHS = [
  '/api/',
  '/league/',
  '/admin/',
  '/dashboard',
  '/settings',
  '/help',
  '/updates',
  '/login',
  '/signup',
  '/auth/',
  '/kit',
  '/ui-showcase',
] as const;
