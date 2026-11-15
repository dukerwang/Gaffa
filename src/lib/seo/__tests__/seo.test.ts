import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { serializeJsonLd, siteJsonLd } from '../jsonLd';
import { PRIVATE_PATHS, PUBLIC_PATHS, SITE } from '../site';

describe('sitemap', () => {
  const entries = sitemap();

  it('lists every public path on the canonical host', () => {
    expect(entries.map((e) => e.url)).toEqual(
      PUBLIC_PATHS.map((p) => (p === '/' ? SITE.url : `${SITE.url}${p}`)),
    );
  });

  it('claims no modification date it cannot back up', () => {
    for (const e of entries) {
      expect(e.lastModified).toBeUndefined();
    }
  });

  it('never lists a private path', () => {
    for (const e of entries) {
      for (const p of PRIVATE_PATHS) expect(e.url.startsWith(`${SITE.url}${p}`)).toBe(false);
    }
  });
});

describe('robots', () => {
  const result = robots();
  const rule = (Array.isArray(result.rules) ? result.rules[0] : result.rules) as {
    disallow?: string | string[];
  };

  it('blocks routes that need a session, including /help which redirects to login', () => {
    expect(rule.disallow).toContain('/help');
    expect(rule.disallow).toContain('/login');
    expect(rule.disallow).toContain('/api/');
  });

  it('points at the sitemap on the canonical host', () => {
    expect(result.sitemap).toBe(`${SITE.url}/sitemap.xml`);
  });

  it('keeps share pages crawlable so link previews work', () => {
    expect(rule.disallow).not.toContain('/share/');
  });
});

describe('structured data', () => {
  it('describes the organization and the website', () => {
    const graph = siteJsonLd()['@graph'];
    expect(graph.map((n) => n['@type'])).toEqual(['Organization', 'WebSite']);
    expect(graph[0].url).toBe(SITE.url);
  });

  it('cannot close its own script tag', () => {
    expect(serializeJsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain('<');
  });
});

describe('site copy', () => {
  it('fits a search result snippet', () => {
    expect(SITE.description.length).toBeLessThanOrEqual(160);
    expect(SITE.title.length).toBeLessThanOrEqual(60);
  });

  it('never claims Gaffa is first', () => {
    expect(`${SITE.title} ${SITE.description}`.toLowerCase()).not.toMatch(/\bfirst\b/);
  });
});
