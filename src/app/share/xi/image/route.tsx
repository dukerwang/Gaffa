import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSharedXI } from '@/lib/lineups/sharedXI';
import { loadCardAssets } from '@/lib/lineups/lineupCard';
import { renderCardPng, type CardFont } from '@/lib/lineups/renderCard';

export const runtime = 'nodejs';

const FONT_DIR = join(process.cwd(), 'src/assets/fonts');
let fonts: Promise<CardFont[]> | null = null;
function loadFonts() {
  const font = (file: string, name: string) =>
    readFile(join(FONT_DIR, file)).then((data): CardFont => ({ name, data, weight: 700, style: 'normal' }));
  fonts ??= Promise.all([
    font('Newsreader-Bold.ttf', 'Newsreader'),
    font('Newsreader-Bold-Opsz14.ttf', 'Wordmark'),
    font('SofiaSansSemiCondensed-Bold.ttf', 'Label'),
  ]);
  return fonts;
}

/**
 * GET /share/xi/image?<Lineup Builder query>
 *
 * The XI a builder link describes, as a 2160x2700 PNG (the 1080x1350 card at
 * 2x): the link preview iMessage and others show for /share/xi, and the file its
 * Save Image link downloads. One URL for both, so after the first render it
 * comes from the CDN. See renderCardPng for how 2x stays fast. The picture is
 * fixed by its query, so CDNs may keep it a day.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const xi = await resolveSharedXI(createAdminClient(), params);
  const [assets, fontData] = await Promise.all([loadCardAssets(xi, url.origin), loadFonts()]);
  const png = await renderCardPng(xi, assets, fontData);

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
