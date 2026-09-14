import { createAdminClient } from '@/lib/supabase/admin';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { normalizeMatchupLineup } from '@/lib/lineups/normalizeMatchupLineup';
import { resolveCurrentGw } from '@/lib/season/currentGameweek';
import { FORMATION_SLOTS } from '@/types';
import type { BenchSlot, MatchupLineup } from '@/types';
import type {
  FutbolpediaClubContextResponse,
  FutbolpediaLeagueSettings,
  FutbolpediaOpenAuction,
  FutbolpediaOpenListing,
} from './futbolpediaContextTypes';

const LINEUP_VISIBILITY: 'last_saved' | 'locked' = 'last_saved';

/**
 * Build the Futbolpedia club context bag. Identity/status only — no fantasy
 * points or private match ratings (scoring-data firewall for the chat bag).
 */
export async function buildFutbolpediaClubContext(
  leagueId: string,
  teamId: string,
): Promise<FutbolpediaClubContextResponse | null> {
  const admin = createAdminClient();

  const [{ data: league }, { data: team }] = await Promise.all([
    admin
      .from('leagues')
      .select(
        'id, name, roster_size, bench_size, ir_size, taxi_size, taxi_age_limit, max_teams, is_dynasty, faab_budget, free_agent_bid_floor, max_loan_outs, max_loan_ins, status',
      )
      .eq('id', leagueId)
      .maybeSingle(),
    admin
      .from('teams')
      .select('id, team_name, faab_budget, league_id')
      .eq('id', teamId)
      .eq('league_id', leagueId)
      .maybeSingle(),
  ]);

  if (!league || !team) return null;

  const currentGw = await resolveCurrentGw();

  const [
    { data: rosterRaw },
    { data: standings },
    { data: matchupRows },
    { data: currentMatchup },
    { data: listingRows },
    { data: auctionRows },
  ] =
    await Promise.all([
      admin
        .from('roster_entries')
        .select(`player_id, status, player:players(${FULL_PLAYER_SELECT})`)
        .eq('team_id', teamId),
      admin
        .from('league_standings')
        .select('team_id, rank, wins, draws, losses, points_for, points_against')
        .eq('league_id', leagueId),
      admin
        .from('matchups')
        .select('team_a_id, team_b_id, lineup_a, lineup_b, gameweek, status')
        .eq('league_id', leagueId)
        .or(
          `and(team_a_id.eq.${teamId},lineup_a.not.is.null),` +
            `and(team_b_id.eq.${teamId},lineup_b.not.is.null)`,
        )
        .order('gameweek', { ascending: true }),
      admin
        .from('matchups')
        .select('team_a_id, team_b_id, score_a, score_b, gameweek, status')
        .eq('league_id', leagueId)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .eq('gameweek', Math.max(currentGw, 1))
        .order('gameweek', { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from('player_sale_listings')
        .select(
          `id, seller_team_id, player_id, min_bid, ask_price, buy_now_price,
           open_to_trade, open_to_sale, open_to_loan, status, auction_expires_at,
           seller_team:teams!seller_team_id(id, team_name),
           player:players(id, name, web_name, primary_position)`,
        )
        .eq('league_id', leagueId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(24),
      admin
        .from('auction_state')
        .select('player_id, kind, highest_bid, expires_at')
        .eq('league_id', leagueId)
        .eq('status', 'live')
        .order('expires_at', { ascending: true, nullsFirst: false })
        .limit(16),
    ]);

  const roster: FutbolpediaClubContextResponse['roster'] = [];
  const byId = new Map<string, { id: string; name: string; pos: string }>();

  for (const e of (rosterRaw ?? []) as any[]) {
    const p = e.player;
    if (!p) continue;
    const display = (p.web_name as string | null)?.trim() || (p.name as string);
    roster.push({
      player_id: p.id,
      name: p.name,
      display_name: display,
      primary_position: p.primary_position,
      secondary_positions: Array.isArray(p.secondary_positions) ? p.secondary_positions : [],
      status: e.status,
      pl_team: p.pl_team ?? null,
    });
    byId.set(p.id, { id: p.id, name: display, pos: p.primary_position });
  }

  const standingRows = standings ?? [];
  const mine = standingRows.find((s: { team_id: string }) => s.team_id === teamId) as
    | {
        rank: number | null;
        wins: number;
        draws: number;
        losses: number;
        points_for: number;
        points_against?: number;
      }
    | undefined;

  // Current GW matchup + opponent name
  let matchup: FutbolpediaClubContextResponse['matchup'] = null;
  if (currentMatchup) {
    const isA = currentMatchup.team_a_id === teamId;
    const oppId = isA ? currentMatchup.team_b_id : currentMatchup.team_a_id;
    let oppName: string | null = null;
    if (oppId) {
      const { data: opp } = await admin
        .from('teams')
        .select('team_name')
        .eq('id', oppId)
        .maybeSingle();
      oppName = opp?.team_name ?? null;
    }
    matchup = {
      gameweek: currentMatchup.gameweek,
      opponent_club_name: oppName,
      status: currentMatchup.status,
      your_score: isA ? Number(currentMatchup.score_a) : Number(currentMatchup.score_b),
      opponent_score: isA ? Number(currentMatchup.score_b) : Number(currentMatchup.score_a),
    };
  }

  // Lineup (same selection logic as squad peek)
  const saved = ((matchupRows ?? []) as Array<{
    team_a_id: string;
    team_b_id: string;
    lineup_a: MatchupLineup | null;
    lineup_b: MatchupLineup | null;
    gameweek: number;
    status: string;
  }>).filter((m) => (LINEUP_VISIBILITY === 'last_saved' ? true : m.status !== 'scheduled'));
  const upTo = saved.filter((m) => m.gameweek <= Math.max(currentGw, 1));
  const chosen = upTo.length > 0 ? upTo[upTo.length - 1] : saved[0];

  let lineup: FutbolpediaClubContextResponse['lineup'] = null;
  if (chosen) {
    const raw = (chosen.team_a_id === teamId ? chosen.lineup_a : chosen.lineup_b) as MatchupLineup | null;
    const normalized = normalizeMatchupLineup(raw);
    if (normalized && Array.isArray(normalized.starters) && normalized.starters.length > 0) {
      const slots = FORMATION_SLOTS[normalized.formation] ?? [];
      lineup = {
        formation: normalized.formation,
        gameweek: chosen.gameweek,
        starters: slots
          .map((slot, i) => {
            const s = normalized.starters[i];
            const player = s?.player_id ? byId.get(s.player_id) : null;
            if (!player) return null;
            return { player_id: player.id, name: player.name, slot };
          })
          .filter((x): x is NonNullable<typeof x> => x != null),
        bench: (['DEF', 'MID', 'ATT', 'FLEX'] as BenchSlot[])
          .map((slot) => {
            const b = (normalized.bench ?? []).find((x) => x.slot === slot);
            const player = b?.player_id ? byId.get(b.player_id) : null;
            if (!player) return null;
            return { player_id: player.id, name: player.name, slot };
          })
          .filter((x): x is NonNullable<typeof x> => x != null),
      };
    }
  }

  const settings = settingsFromLeague(league as Record<string, unknown>);
  const open_listings = mapListings(listingRows as any[] | null, team.id);
  const open_auctions = await mapAuctions(admin, auctionRows as any[] | null);

  return {
    league_id: league.id,
    club_id: team.id,
    league_name: league.name,
    club_name: team.team_name,
    budget_eur_m: Number(team.faab_budget ?? 0),
    roster,
    standings: {
      rank: mine?.rank ?? null,
      of_teams: standingRows.length,
      wins: mine?.wins ?? 0,
      draws: mine?.draws ?? 0,
      losses: mine?.losses ?? 0,
      points_for: Number(mine?.points_for ?? 0),
      points_against: mine?.points_against != null ? Number(mine.points_against) : undefined,
    },
    matchup,
    lineup,
    settings,
    open_listings,
    open_auctions,
    synced_at: new Date().toISOString(),
  };
}

function asOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function settingsFromLeague(league: Record<string, unknown>): FutbolpediaLeagueSettings {
  const n = (key: string): number | null => {
    const v = Number(league[key]);
    return Number.isFinite(v) ? v : null;
  };
  return {
    roster_size: n('roster_size') ?? 22,
    bench_size: n('bench_size') ?? 4,
    ir_size: n('ir_size') ?? 2,
    taxi_size: n('taxi_size'),
    taxi_age_limit: n('taxi_age_limit'),
    max_teams: n('max_teams') ?? 0,
    is_dynasty: Boolean(league.is_dynasty),
    starting_faab_eur_m: n('faab_budget'),
    free_agent_bid_floor: n('free_agent_bid_floor'),
    max_loan_outs: n('max_loan_outs'),
    max_loan_ins: n('max_loan_ins'),
    league_status: typeof league.status === 'string' ? league.status : null,
  };
}

function mapListings(rows: any[] | null, clubId: string): FutbolpediaOpenListing[] {
  const out: FutbolpediaOpenListing[] = [];
  for (const row of rows ?? []) {
    const player = asOne(row.player) as {
      id?: string;
      name?: string;
      web_name?: string | null;
      primary_position?: string;
    } | null;
    const seller = asOne(row.seller_team) as { id?: string; team_name?: string } | null;
    if (!player?.id) continue;
    out.push({
      player_id: player.id,
      name: (player.web_name || player.name || 'Unknown').trim(),
      position: player.primary_position || '?',
      seller_club_id: seller?.id || row.seller_team_id,
      seller_club_name: seller?.team_name || 'Unknown',
      yours: (seller?.id || row.seller_team_id) === clubId,
      status: row.status,
      min_bid_eur_m: row.min_bid != null ? Number(row.min_bid) : null,
      ask_eur_m: row.ask_price != null ? Number(row.ask_price) : null,
      release_clause_eur_m: row.buy_now_price != null ? Number(row.buy_now_price) : null,
      open_to_trade: Boolean(row.open_to_trade),
      open_to_sale: Boolean(row.open_to_sale),
      open_to_loan: Boolean(row.open_to_loan),
      expires_at: row.auction_expires_at ?? null,
    });
  }
  return out;
}

async function mapAuctions(
  admin: ReturnType<typeof createAdminClient>,
  rows: any[] | null,
): Promise<FutbolpediaOpenAuction[]> {
  const list = rows ?? [];
  if (list.length === 0) return [];
  const ids = [...new Set(list.map((r) => r.player_id).filter(Boolean))];
  const { data: players } = ids.length
    ? await admin.from('players').select('id, name, web_name, primary_position').in('id', ids)
    : { data: [] as never[] };
  const byId = new Map((players ?? []).map((p: any) => [p.id, p]));
  return list.map((row) => {
    const p = byId.get(row.player_id);
    return {
      player_id: row.player_id,
      name: ((p?.web_name || p?.name || 'Unknown') as string).trim(),
      position: (p?.primary_position as string) || '?',
      kind: String(row.kind ?? 'auction'),
      highest_bid_eur_m: row.highest_bid != null ? Number(row.highest_bid) : null,
      expires_at: row.expires_at ?? null,
    };
  });
}
