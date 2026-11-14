import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminGrantStore, GrantError, resolveGrant } from './futbolpediaGrant';

/** A route's error as JSON: a GrantError keeps its status, anything else is a 500. */
export function grantErrorResponse(err: unknown, tag: string): NextResponse {
  if (err instanceof GrantError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`[futbolpedia/${tag}]`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

/** The manager behind a request's grant token, or null. */
export async function grantUser(req: NextRequest): Promise<{ grantId: string; userId: string } | null> {
  return resolveGrant(adminGrantStore(createAdminClient()), req.headers.get('authorization'));
}

export function notConnected(): NextResponse {
  return NextResponse.json({ error: 'Not connected' }, { status: 401 });
}

export interface GrantClub {
  club_id: string;
  club_name: string;
  abbreviation: string | null;
  budget_eur_m: number;
  league_id: string;
  league_name: string;
  season: string | null;
  league_status: string | null;
}

/** Every club the manager runs, newest first, with its league. */
export async function listGrantClubs(userId: string): Promise<GrantClub[]> {
  const { data: teams, error } = await createAdminClient()
    .from('teams')
    .select('id, league_id, team_name, abbreviation, faab_budget, created_at, league:leagues(name, season, current_season, status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new GrantError('Could not load clubs', 500);
  type LeagueRow = { name: string | null; season: string | null; current_season: string | null; status: string | null };
  return (teams ?? []).map((t) => {
    const embedded = (t as { league?: LeagueRow | LeagueRow[] | null }).league;
    const lg = Array.isArray(embedded) ? embedded[0] : embedded;
    return {
      club_id: String(t.id),
      club_name: String(t.team_name || 'Club'),
      abbreviation: t.abbreviation ?? null,
      budget_eur_m: Number(t.faab_budget ?? 0),
      league_id: String(t.league_id),
      league_name: String(lg?.name || 'Gaffa League'),
      season: lg?.current_season ?? lg?.season ?? null,
      league_status: lg?.status ? String(lg.status) : null,
    };
  });
}
