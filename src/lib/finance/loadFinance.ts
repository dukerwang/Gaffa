/**
 * Gaffa — the finance page's reads
 *
 * One round of parallel reads, then the pure modules beside this file. Every
 * club's ledger is built, not only the viewer's, because the League view
 * compares them; a league's whole money history is a few hundred rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPages } from '@/lib/supabase/pagination';
import { DEFAULT_MERIT_RATES, gameweeksInPeriod, MERIT_PERIOD_COUNT, type MatchupResultRow, type MeritRates } from '@/lib/economy/meritPayments';
import { seasonPrizeFor, type PrizeConfig } from '@/lib/offseason/prizeDistribution';
import { buildFacilityViews, effectiveSlots, type FacilityView, type TeamSlotOverrides } from '@/lib/facilities/facilities';
import { isRedraft, leagueFeatures, type LeagueFeatures } from '@/lib/leagues/features';
import type { CrestConfig } from '@/components/crest/types';
import { buildLedger, type Ledger, type LedgerPlayer, type TradeCashRow, type TransactionRow } from './ledger';
import { committedTo, liveBidsFor, matchRevenueOutlook, type AuctionStateRow, type LiveBid, type MatchRevenueOutlook } from './outlook';

const PLAYER_SELECT =
  'id, name, web_name, primary_position, pl_team, photo_url, photo_version, portrait_head_top_pct, portrait_head_width_pct';

export interface FinanceClub {
  teamId: string;
  name: string;
  crest: CrestConfig | null;
  balance: number;
  committed: number;
  spendable: number;
  totalIn: number;
  totalOut: number;
  isMine: boolean;
}

export interface FinanceData {
  leagueId: string;
  leagueName: string;
  season: string;
  features: LeagueFeatures;
  dynasty: boolean;
  serverNow: string;
  me: {
    teamId: string;
    name: string;
    crest: CrestConfig | null;
    balance: number;
    committed: number;
    spendable: number;
  };
  ledger: Ledger;
  bids: (LiveBid & { player: LedgerPlayer | null })[];
  revenue: MatchRevenueOutlook | null;
  prize: { rank: number; clubs: number; amount: number } | null;
  listings: { player: LedgerPlayer | null; topBid: number; bidCount: number; expiresAt: string | null }[];
  departures: { id: string; player: LedgerPlayer | null; amount: number; decideBy: string | null }[];
  facilities: FacilityView[] | null;
  clubs: FinanceClub[];
  /** League-wide, this season: money paid in by the league and money taken out. */
  supply: { opening: number; now: number; created: number; destroyed: number };
}

/** Null when the viewer has no club in this league. */
export async function loadFinance(admin: SupabaseClient, leagueId: string, userId: string): Promise<FinanceData | null> {
  const [leagueRes, teamsRes] = await Promise.all([
    admin
      .from('leagues')
      .select('id, name, season, current_season, is_dynasty, prize_config, merit_win, merit_draw, merit_loss, merit_bye, taxi_size, ir_size, max_loan_outs')
      .eq('id', leagueId)
      .single(),
    admin
      .from('teams')
      .select('id, user_id, team_name, faab_budget, crest_config, academy_slots, ir_slots, loan_out_slots')
      .eq('league_id', leagueId),
  ]);

  const league = leagueRes.data;
  const teams = teamsRes.data ?? [];
  const mine = teams.find((t) => t.user_id === userId);
  if (!league || !mine) return null;

  const season: string = league.current_season ?? league.season;
  const features = leagueFeatures(league);
  const dynasty = !isRedraft(league);
  const rates: MeritRates = {
    win: Number(league.merit_win ?? DEFAULT_MERIT_RATES.win),
    draw: Number(league.merit_draw ?? DEFAULT_MERIT_RATES.draw),
    loss: Number(league.merit_loss ?? DEFAULT_MERIT_RATES.loss),
    bye: Number(league.merit_bye ?? DEFAULT_MERIT_RATES.bye),
  };

  const [transactions, tradesRes, auctionsRes, paidRes, standingsRes, departuresRes, rosterRes, loansRes] = await Promise.all([
    fetchAllPages<TransactionRow & { team_id: string }>((from, to) =>
      admin
        .from('transactions')
        .select(`id, team_id, type, faab_bid, compensation_amount, notes, processed_at, player:players(${PLAYER_SELECT})`, { count: 'exact' })
        .eq('league_id', leagueId)
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: (TransactionRow & { team_id: string })[] | null; count: number | null }>,
    ),
    admin
      .from('trade_proposals')
      .select('id, team_a_id, team_b_id, offered_faab, requested_faab, updated_at')
      .eq('league_id', leagueId)
      .eq('status', 'accepted'),
    admin
      .from('auction_state')
      .select('player_id, kind, seller_team_id, highest_bid, highest_bidder_team_id, bid_count, bids, expires_at')
      .eq('league_id', leagueId)
      .eq('status', 'live'),
    admin.from('merit_payments').select('period_index').eq('team_id', mine.id).eq('season', season),
    admin.from('league_standings').select('team_id, rank').eq('league_id', leagueId),
    admin
      .from('departure_decisions')
      .select(`id, compensation_offered, decide_by, player:players(${PLAYER_SELECT})`)
      .eq('team_id', mine.id)
      .eq('status', 'pending'),
    features.facilities
      ? admin.from('roster_entries').select('status').eq('team_id', mine.id).in('status', ['taxi', 'ir'])
      : Promise.resolve({ data: [] as { status: string }[] }),
    features.facilities
      ? admin
          .from('player_loans')
          .select('id', { count: 'exact', head: true })
          .eq('lender_team_id', mine.id)
          .in('status', ['active', 'accepted_deferred', 'pending_activation'])
      : Promise.resolve({ count: 0 }),
  ]);

  const trades = (tradesRes.data ?? []) as TradeCashRow[];
  const auctions = (auctionsRes.data ?? []) as AuctionStateRow[];
  const nameById = new Map(teams.map((t) => [t.id as string, t.team_name as string]));
  const clubName = (id: string) => nameById.get(id) ?? 'another club';

  // Every club's ledger and live commitments, for the League view.
  const txByTeam = new Map<string, TransactionRow[]>();
  for (const tx of transactions) {
    const list = txByTeam.get(tx.team_id) ?? [];
    list.push(tx);
    txByTeam.set(tx.team_id, list);
  }

  let supplyOpening = 0;
  let supplyNow = 0;
  let created = 0;
  let myLedger: Ledger | null = null;
  const clubs: FinanceClub[] = teams.map((t) => {
    const balance = Number(t.faab_budget ?? 0);
    const ledger = buildLedger({
      teamId: t.id,
      currentBalance: balance,
      transactions: txByTeam.get(t.id) ?? [],
      trades,
      clubName,
    });
    if (t.id === mine.id) myLedger = ledger;
    supplyOpening += ledger.opening;
    supplyNow += balance;
    created += ledger.created;
    const committed = committedTo(liveBidsFor(t.id, auctions));
    return {
      teamId: t.id,
      name: t.team_name,
      crest: (t.crest_config ?? null) as CrestConfig | null,
      balance,
      committed,
      spendable: balance - committed,
      totalIn: ledger.totalIn,
      totalOut: ledger.totalOut,
      isMine: t.id === mine.id,
    };
  });
  clubs.sort((a, b) => b.spendable - a.spendable || a.name.localeCompare(b.name));

  // Players for the viewer's live lots and listings.
  const myBids = liveBidsFor(mine.id, auctions);
  const myListingLots = auctions.filter((a) => a.kind === 'listing' && a.seller_team_id === mine.id && (a.bid_count ?? 0) > 0);
  const lotIds = [...new Set([...myBids.map((b) => b.playerId), ...myListingLots.map((a) => a.player_id)])];
  const playersRes = lotIds.length
    ? await admin.from('players').select(PLAYER_SELECT).in('id', lotIds)
    : { data: [] as LedgerPlayer[] };
  const playerById = new Map(((playersRes.data ?? []) as LedgerPlayer[]).map((p) => [p.id, p]));

  // Match Revenue: the first unpaid period's matchups.
  const paidPeriods = new Set(((paidRes.data ?? []) as { period_index: number }[]).map((r) => r.period_index));
  let revenue: MatchRevenueOutlook | null = null;
  {
    let next = 1;
    while (next <= MERIT_PERIOD_COUNT && paidPeriods.has(next)) next++;
    if (next <= MERIT_PERIOD_COUNT) {
      const { data: periodMatchups } = await admin
        .from('matchups')
        .select('gameweek, team_a_id, team_b_id, winner_team_id, status')
        .eq('league_id', leagueId)
        .in('gameweek', gameweeksInPeriod(next));
      revenue = matchRevenueOutlook({
        teamId: mine.id,
        paidPeriods,
        matchups: (periodMatchups ?? []) as MatchupResultRow[],
        rates,
      });
    }
  }

  // The season prize, projected from today's place. A redraft league resets
  // balances every season, so a prize there buys nothing and isn't shown.
  const standings = (standingsRes.data ?? []) as { team_id: string; rank: number | null }[];
  const myRank = standings.find((s) => s.team_id === mine.id)?.rank ?? null;
  const prize =
    dynasty && myRank != null && standings.length > 1
      ? {
          rank: myRank,
          clubs: standings.length,
          amount: seasonPrizeFor(myRank, standings.length, league.prize_config as PrizeConfig | null),
        }
      : null;

  const facilities = features.facilities
    ? buildFacilityViews(effectiveSlots(mine as TeamSlotOverrides, league), {
        academy: (rosterRes.data ?? []).filter((r) => r.status === 'taxi').length,
        ir: (rosterRes.data ?? []).filter((r) => r.status === 'ir').length,
        loansOut: (loansRes as { count?: number | null }).count ?? 0,
      })
    : null;

  const myClub = clubs.find((c) => c.isMine)!;

  return {
    leagueId,
    leagueName: league.name,
    season,
    features,
    dynasty,
    serverNow: new Date().toISOString(),
    me: {
      teamId: mine.id,
      name: mine.team_name,
      crest: myClub.crest,
      balance: myClub.balance,
      committed: myClub.committed,
      spendable: myClub.spendable,
    },
    ledger: myLedger!,
    bids: myBids.map((b) => ({ ...b, player: playerById.get(b.playerId) ?? null })),
    revenue,
    prize,
    listings: myListingLots.map((a) => ({
      player: playerById.get(a.player_id) ?? null,
      topBid: Number(a.highest_bid ?? 0),
      bidCount: a.bid_count ?? 0,
      expiresAt: a.expires_at,
    })),
    departures: ((departuresRes.data ?? []) as unknown as { id: string; compensation_offered: number | string | null; decide_by: string | null; player: LedgerPlayer | null }[])
      .map((d) => ({ id: d.id, player: d.player, amount: Number(d.compensation_offered ?? 0), decideBy: d.decide_by }))
      .filter((d) => d.amount > 0),
    facilities,
    clubs,
    supply: {
      opening: supplyOpening,
      now: supplyNow,
      created,
      destroyed: created - (supplyNow - supplyOpening),
    },
  };
}
