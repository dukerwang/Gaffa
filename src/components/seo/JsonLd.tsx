import { serializeJsonLd } from '@/lib/seo/jsonLd';

/** Renders structured data for search engines. Server component; adds no client JavaScript. */
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
