/**
 * GET /api/leagues/[leagueId]/transfers/free-agents
 *
 * Server-filtered, server-sorted, paginated free agents.
 *
 * The surface this replaces was the single worst thing about the old market
 * page: `players/page.tsx:171-196` embedded the entire active Premier League
 * catalogue in the RSC payload, and `TransferMarketClient.tsx:222-227` then
 * re-downloaded all of it every 15 seconds via GET /auctions. Here the client
 * receives one page.
 *
 * Query params:
 *   q         free-text over name / web_name / full_name
 *   position  tactical position (GK, CB, ... ST)
 *   club      pl_team exact match
 *   sort      points | value | ppg | form | name        (default points)
 *   dir       asc | desc                                 (default desc)
 *   page      1-based                                    (default 1)
 *   pageSize  1..100                                     (default 40)
 *   newOnly   true to return only players whose pl_team_changed_at falls
 *             within the last 7 days AND who have no player_season_clubs row
 *             for last season ("New transfers") — the second condition is
 *             what excludes an intra-Prem move (pl_team_changed_at fires for
 *             that too) from reading as a fresh arrival. Sorted newest first
 *             regardless of `sort`/`dir` — this powers a pinned section, not
 *             the main browse list, so it ignores the caller's sort choice
 *
 * Ordering and exclusion happen AFTER stat enrichment, deliberately. `ppg`,
 * `form_rating` and `total_points` are overwritten from
 * `season_player_stats_archive` when an archive row exists, so ordering by the
 * live column in SQL would rank on numbers the user is not being shown. The
 * candidate set here is the active PL catalogue (~600 rows) after SQL filtering,
 * which is small enough to finish the job in memory and cheap compared to a
 * wrong answer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { fetchEnrichmentMaps, enrichPlayer } from '@/lib/transfers/playerEnrichment';
import { getRightsHeldPlayerIds } from '@/lib/departures/decisions';
import { fold } from '@/lib/text/fold';
import { fetchAllPages } from '@/lib/supabase/pagination';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

const SORTS: Record<string, string> = {
  points: 'total_points',
  value: 'market_value',
  ppg: 'ppg',
  form: 'form_rating',
  name: 'web_name',
};

export async function GET(req: NextRequest, { params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: myTeam }, { data: league }] = await Promise.all([
    admin
      .from('teams')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    admin
      .from('leagues')
      .select('current_season, previous_season')
      .eq('id', leagueId)
      .single(),
  ]);
  if (!myTeam || !league) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim();
  const position = sp.get('position');
  const club = sp.get('club');
  const sortKey = SORTS[sp.get('sort') ?? 'points'] ?? 'total_points';
  const desc = (sp.get('dir') ?? 'desc') !== 'asc';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '40', 10) || 40));
  const newOnly = sp.get('newOnly') === 'true';

  // SQL narrows; the rest is done post-enrichment.
  let query = admin.from('players').select(FULL_PLAYER_SELECT).eq('is_active', true);
  if (position) query = query.eq('primary_position', position);
  if (club) query = query.eq('pl_team', club);
  if (newOnly) {
    const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
    query = query.gte('pl_team_changed_at', cutoff);
  }

  // Who is unavailable: on any roster in this league, already in a live
  // auction (the board shows those, the free-agent list must not double them),
  // or held under a retained claim.
  // Fetched in parallel alongside candidate players and enrichment maps.
  const [
    { data: candidates, error },
    maps,
    { data: teams },
    { data: liveAuctions },
    rightsHeld,
    prevSeasonClubRows,
  ] = await Promise.all([
    query,
    fetchEnrichmentMaps(admin, league),
    admin.from('teams').select('id').eq('league_id', leagueId),
    admin
      .from('auction_state')
      .select('player_id')
      .eq('league_id', leagueId)
      .eq('status', 'live'),
    getRightsHeldPlayerIds(admin, leagueId),
    newOnly && league.previous_season
      ? fetchAllPages<{ player_id: string }>((from, to) =>
          admin
            .from('player_season_clubs')
            .select('player_id')
            .eq('season', league.previous_season!)
            .order('player_id', { ascending: true })
            .range(from, to),
        )
      : Promise.resolve([] as { player_id: string }[]),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: rostered } = teamIds.length
    ? await admin.from('roster_entries').select('player_id').in('team_id', teamIds)
    : { data: [] as { player_id: string }[] };

  const excluded = new Set<string>([
    ...(rostered ?? []).map((r) => r.player_id),
    ...(liveAuctions ?? []).map((a) => a.player_id),
    ...rightsHeld,
  ]);

  const prevSeasonClubIds = new Set((prevSeasonClubRows ?? []).map((r) => r.player_id));

  // Name matching runs here rather than as an `ilike` in the query above,
  // because Postgres cannot fold diacritics without the unaccent extension and
  // a manager typing "munoz" expects to find "Muñoz". The route already reads
  // the whole active-player set when no search is given (575 rows, under
  // PostgREST's default page size), so this costs nothing extra.
  const qFold = fold(q);
  const enriched = (candidates ?? [])
    .filter((p) => !excluded.has(p.id))
    .filter((p) => !newOnly || prevSeasonClubIds.size === 0 || !prevSeasonClubIds.has(p.id))
    .filter((p) => {
      if (!qFold) return true;
      return fold(p.name).includes(qFold)
        || fold(p.web_name).includes(qFold)
        || fold(p.full_name).includes(qFold);
    })
    .map((p) => enrichPlayer(p, maps));

  const effectiveSortKey = newOnly ? 'pl_team_changed_at' : sortKey;
  const effectiveDesc = newOnly ? true : desc;
  enriched.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[effectiveSortKey];
    const bv = (b as unknown as Record<string, unknown>)[effectiveSortKey];
    if (effectiveSortKey === 'web_name') {
      return effectiveDesc
        ? String(bv ?? '').localeCompare(String(av ?? ''))
        : String(av ?? '').localeCompare(String(bv ?? ''));
    }
    // Nulls always sort last regardless of direction — an unknown value is not
    // "the smallest", and floating them to the top of a desc sort is noise.
    // pl_team_changed_at is a timestamp string, so it's parsed as a date
    // rather than Number()'d — the latter is NaN for an ISO string.
    const an = av == null ? null : effectiveSortKey === 'pl_team_changed_at' ? new Date(String(av)).getTime() : Number(av);
    const bn = bv == null ? null : effectiveSortKey === 'pl_team_changed_at' ? new Date(String(bv)).getTime() : Number(bv);
    if (an == null && bn == null) return 0;
    if (an == null) return 1;
    if (bn == null) return -1;
    return effectiveDesc ? bn - an : an - bn;
  });

  const total = enriched.length;
  const start = (page - 1) * pageSize;

  return NextResponse.json(
    {
      players: enriched.slice(start, start + pageSize),
      page,
      pageSize,
      total,
      hasMore: start + pageSize < total,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
