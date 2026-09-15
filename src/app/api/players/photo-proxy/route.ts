import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOST = 'resources.premierleague.com';

/**
 * GET /api/players/photo-proxy?url=<PL CDN photo url>
 *
 * PL's photo CDN sends no Access-Control-Allow-Origin header, so an <img>
 * loaded with crossOrigin="anonymous" for canvas export (lineupImageExport.ts)
 * always fails its CORS check and falls back to initials — the photo itself
 * loads fine for ordinary <img> tags (Portrait.tsx), which need no CORS mode
 * at all, so this proxy exists only for the canvas-export path. It re-serves
 * the same bytes from our own origin so drawImage() doesn't taint the canvas.
 *
 * Locked to the one CDN host so this can't be used as an open image proxy.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: { Referer: 'https://www.premierleague.com/' },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: upstream.status || 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
