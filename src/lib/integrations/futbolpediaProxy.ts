import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { futbolpediaOrigin } from '@/lib/integrations/futbolpediaChat';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks a Futbolpedia panel request: a signed-in manager asking about their own club, with
 * Futbolpedia configured. Returns the manager and Futbolpedia's origin and secret, or the
 * response to send instead.
 */
export async function authorizeFutbolpediaClub(
  leagueId: string,
  teamId: string,
): Promise<{ userId: string; origin: string; secret: string } | { response: NextResponse }> {
  if (!UUID.test(leagueId) || !UUID.test(teamId)) {
    return { response: NextResponse.json({ error: 'Invalid league or club' }, { status: 400 }) };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: team } = await createAdminClient()
    .from('teams')
    .select('id, user_id, league_id')
    .eq('id', teamId)
    .eq('league_id', leagueId)
    .maybeSingle();
  if (!team) return { response: NextResponse.json({ error: 'Club not found' }, { status: 404 }) };
  if (team.user_id !== user.id) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  const origin = futbolpediaOrigin();
  const secret = process.env.FUTBOLPEDIA_READ_SECRET;
  if (!origin || !secret) {
    return {
      response: NextResponse.json(
        { error: 'Futbolpedia is not configured (FUTBOLPEDIA_URL / FUTBOLPEDIA_READ_SECRET)' },
        { status: 503 },
      ),
    };
  }
  return { userId: user.id, origin, secret };
}

/** A conversation id from the panel: short and URL-safe, or a fallback. */
export function panelConversationId(raw: unknown): string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : 'default';
}
