import { NextRequest, NextResponse } from 'next/server';
import { authorizeFutbolpediaRead } from '@/lib/auth/authorizeFutbolpediaRead';
import { buildFutbolpediaClubContext } from '@/lib/integrations/futbolpediaContext';
import { bearerToken } from '@/lib/integrations/futbolpediaGrant';
import { grantErrorResponse, grantUser, notConnected } from '@/lib/integrations/futbolpediaGrantRoutes';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Read-only club context for Futbolpedia. Two ways in:
 * - `Authorization: Bearer <grant token>` (Connect with Gaffa): only for a club
 *   the grant's manager runs.
 * - `x-futbolpedia-secret === FUTBOLPEDIA_READ_SECRET`: server to server, for
 *   Gaffa's own chat proxy, which has already checked the session and the
 *   club's owner.
 */
export async function GET(req: NextRequest) {
  const leagueId = req.nextUrl.searchParams.get('leagueId')?.trim();
  const teamId = req.nextUrl.searchParams.get('teamId')?.trim();

  try {
    if (bearerToken(req.headers.get('authorization'))) {
      const grant = await grantUser(req);
      if (!grant) return notConnected();
      if (!leagueId || !teamId) {
        return NextResponse.json({ error: 'Missing leagueId or teamId' }, { status: 400 });
      }
      const { data: team } = await createAdminClient()
        .from('teams')
        .select('user_id')
        .eq('id', teamId)
        .eq('league_id', leagueId)
        .maybeSingle();
      if (!team) return NextResponse.json({ error: 'League or club not found' }, { status: 404 });
      if (team.user_id !== grant.userId) {
        return NextResponse.json({ error: 'Not your club' }, { status: 403 });
      }
    } else if (!authorizeFutbolpediaRead(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!leagueId || !teamId) {
      return NextResponse.json({ error: 'Missing leagueId or teamId' }, { status: 400 });
    }
    const bag = await buildFutbolpediaClubContext(leagueId, teamId);
    if (!bag) {
      return NextResponse.json({ error: 'League or club not found' }, { status: 404 });
    }
    return NextResponse.json(bag);
  } catch (err) {
    return grantErrorResponse(err, 'context');
  }
}
