import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlayerBack } from '@/lib/players/cardData';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';

/**
 * GET /api/players/[playerId]/log?leagueId=&season=
 *
 * Back of the premium player card: game log and career history. Needs FPL's
 * element-summary/bootstrap/fixtures endpoints, so it is the slow half — the
 * card fetches it in the background after paint, never as a gate.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;
  const { searchParams } = new URL(req.url);
  const admin = createAdminClient();

  const explicitSeason = searchParams.get('season');
  const back = await fetchPlayerBack(
    admin,
    playerId,
    searchParams.get('leagueId'),
    explicitSeason,
  );

  // An ARCHIVED season, asked for by name, is the one payload here that cannot
  // change: it is built entirely from our own tables (no FPL calls) and the
  // season is over. So it is cached publicly at the edge, and every later
  // request for it, from any manager in any league, costs no function
  // invocation. The client drops leagueId from these requests so they share
  // one cache entry. To republish after a backfill, bump ARCHIVE_LOG_VERSION
  // in cardCache.ts, which changes the URL.
  //
  // Everything else keeps the old rule. No stale-while-revalidate: it kept
  // serving a pre-backfill payload for ten minutes after the data behind it
  // changed, which reads as "the fix didn't work".
  const current = await getCurrentFplSeason();
  const archived = explicitSeason != null && back.season === explicitSeason && explicitSeason !== current;

  return NextResponse.json(back, {
    headers: {
      'Cache-Control': archived ? 'public, max-age=3600, s-maxage=86400' : 'private, no-cache',
    },
  });
}
