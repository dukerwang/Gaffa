import type { MetadataRoute } from 'next';
import { PUBLIC_PATHS, SITE } from '@/lib/seo/site';

/**
 * No lastModified: nothing here records when a page last changed, and stamping
 * "now" on every request tells crawlers everything changes constantly, so they
 * learn to ignore the field. changeFrequency and priority are left out for the
 * same reason; Google ignores both.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: path === '/' ? SITE.url : `${SITE.url}${path}`,
  }));
}
