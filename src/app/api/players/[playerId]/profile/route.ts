import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadScoutingProfile } from '@/lib/players/hubData';

/**
 * GET /api/players/[playerId]/profile?season=
 *
 * The player card's Scouting view: the Futbolpedia report and the real-world
 * form for one season. The same figures the player hub renders; see
 * loadScoutingProfile for how they stay identical at a fraction of the cost.
 * Fetched only when the Scouting tab is first opened, never when the card opens.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;
  const { searchParams } = new URL(req.url);
  const profile = await loadScoutingProfile(createAdminClient(), playerId, searchParams.get('season'));
  if (!profile) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  return NextResponse.json(
    profile,
    // An outlook changes at most once per scouting run, and form moves once per
    // matchweek, so five minutes of browser caching loses nothing.
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}
