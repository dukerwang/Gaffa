import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSharedXI } from '@/lib/lineups/sharedXI';
import styles from './xi.module.css';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

/** The query as a string, without Next's internal params, for the image and builder links. */
function queryOf(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, v);
  return q.toString();
}

const resolve = cache(async (query: string) =>
  resolveSharedXI(createAdminClient(), Object.fromEntries(new URLSearchParams(query).entries())),
);

function describe(xi: Awaited<ReturnType<typeof resolveSharedXI>>): { heading: string; line: string } {
  const heading = xi.club ? `${xi.club.name} XI` : xi.title;
  const line = [xi.club ? xi.title : null, xi.formation, xi.matchweek ? `Matchweek ${xi.matchweek}` : null]
    .filter(Boolean)
    .join(' · ');
  return { heading, line };
}

/**
 * A shared XI's link preview is the XI itself: the card from /share/xi/image as
 * og:image, so iMessage and the rest show the lineup in the bubble, and the
 * title names it. The share sheet sends this URL alone, with no message text.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = queryOf(await searchParams);
  const xi = await resolve(query);
  const { heading, line } = describe(xi);
  const image = { url: `/share/xi/image?${query}&scale=1`, width: 1080, height: 1350, alt: `${heading}, ${line}` };
  // Absolute on the host that served the page: gaffa.live redirects to www, and a
  // link previewer that won't follow the redirect would show no picture.
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  return {
    metadataBase: host ? new URL(`${proto}://${host}`) : undefined,
    title: `${heading} · Gaffa`,
    description: line,
    openGraph: { title: heading, description: line, images: [image], type: 'website', siteName: 'Gaffa' },
    twitter: { card: 'summary_large_image', title: heading, description: line, images: [image.url] },
  };
}

export default async function SharedXIPage({ searchParams }: Props) {
  const query = queryOf(await searchParams);
  const xi = await resolve(query);
  const { heading, line } = describe(xi);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h1 className={styles.h1}>{heading}</h1>
          <p className={styles.line}>{line}</p>
        </div>
        <Link href={`/lineup-builder?${query}`} className={styles.cta}>
          Open in Lineup Builder
        </Link>
      </header>
      {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, already sized */}
      <img className={styles.card} src={`/share/xi/image?${query}`} alt={`${heading}: ${line}`} width={1080} height={1350} />
    </div>
  );
}
