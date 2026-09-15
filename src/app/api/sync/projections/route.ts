/**
 * POST /api/sync/projections
 *
 * Computes matchday projected points for all active Premier League players for
 * the upcoming gameweek and stamps them to public.players.
 *
 * Scheduled daily via cron in vercel.json (03:00 UTC) right after /api/sync/players.
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';
import { resolveUpcomingGw } from '@/lib/season/currentGameweek';
import { calculateGameweekProjections } from '@/lib/projections/calculateGameweekProjections';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const season = await getCurrentFplSeason();
  const gameweek = await resolveUpcomingGw();

  if (!gameweek) {
    return NextResponse.json({ error: 'No upcoming gameweek resolved' }, { status: 400 });
  }

  const result = await calculateGameweekProjections(admin, season, gameweek);
  const computedAt = new Date().toISOString();

  const updates: Array<{ id: string; projected_points: number }> = [];
  for (const [id, points] of result.projections.entries()) {
    updates.push({ id, projected_points: points });
  }

  const chunkSize = 50;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((u) =>
        admin
          .from('players')
          .update({
            projected_points: u.projected_points,
            projected_season: season,
            projected_gameweek: gameweek,
            projected_at: computedAt,
          })
          .eq('id', u.id),
      ),
    );
  }

  return NextResponse.json({
    ok: true,
    season,
    gameweek,
    synced: updates.length,
    fixturesFound: result.fixturesFound,
  });
}
