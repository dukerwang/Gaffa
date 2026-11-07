import { SITE } from './site';

/**
 * JSON for a <script type="application/ld+json"> tag. A "<" inside a string
 * could otherwise close the tag early, so it is written as a unicode escape.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** What search engines read to learn who Gaffa is. Facts only: no rating or review claims. */
export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE.url}/#organization`,
        name: SITE.name,
        url: SITE.url,
        logo: `${SITE.url}${SITE.logoPath}`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        publisher: { '@id': `${SITE.url}/#organization` },
        inLanguage: 'en',
      },
    ],
  };
}
