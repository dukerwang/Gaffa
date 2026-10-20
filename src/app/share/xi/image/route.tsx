import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSharedXI } from '@/lib/lineups/sharedXI';
import { CARD_H, CARD_W, LineupCard, loadCardAssets } from '@/lib/lineups/lineupCard';

export const runtime = 'nodejs';

const FONT_DIR = join(process.cwd(), 'src/assets/fonts');
let fonts: Promise<{ name: string; data: Buffer; weight: 700; style: 'normal' }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, 'Newsreader-Bold.ttf')).then((data) => ({ name: 'Newsreader', data, weight: 700 as const, style: 'normal' as const })),
    readFile(join(FONT_DIR, 'Newsreader-Bold-Opsz14.ttf')).then((data) => ({ name: 'Wordmark', data, weight: 700 as const, style: 'normal' as const })),
    readFile(join(FONT_DIR, 'SofiaSansSemiCondensed-Bold.ttf')).then((data) => ({ name: 'Label', data, weight: 700 as const, style: 'normal' as const })),
  ]);
  return fonts;
}

/**
 * GET /share/xi/image?<Lineup Builder query>
 *
 * The XI a builder link describes, as a PNG: the link preview iMessage and
 * others show for /share/xi, and the file Save Image downloads. Rendered at 2x
 * (2160x2700) unless ?scale=1. The picture is fixed by its query, so CDNs may
 * keep it a day.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const k = params.scale === '1' ? 1 : 2;

  const xi = await resolveSharedXI(createAdminClient(), params);
  const [assets, fontData] = await Promise.all([loadCardAssets(xi, url.origin), loadFonts()]);

  return new ImageResponse(<LineupCard xi={xi} assets={assets} k={k} />, {
    width: CARD_W * k,
    height: CARD_H * k,
    fonts: fontData,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
