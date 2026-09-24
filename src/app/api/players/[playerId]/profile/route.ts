import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPlayerHub } from '@/lib/players/hubData';

/**
 * GET /api/players/[playerId]/profile?leagueId=&season=
 *
 * The player card's Scouting view: the Futbolpedia report and the real-world
 * form for one season. The same data the player hub renders, from the same
 * loader, so the two can't disagree. Fetched only when the Scouting tab is
 * first opened, never when the card opens.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get('leagueId');
  const season = searchParams.get('season');

  const hub = await loadPlayerHub(createAdminClient(), playerId, leagueId ?? '', season);
  if (!hub) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  return NextResponse.json(
    { report: hub.football.report, form: hub.football.form, season: hub.season },
    // An outlook changes at most once per scouting run, and form moves once per
    // matchweek, so five minutes of browser caching loses nothing.
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
