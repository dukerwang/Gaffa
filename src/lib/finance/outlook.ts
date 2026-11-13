/**
 * Gaffa — money on its way
 *
 * Pure projections for the finance page: what Match Revenue the current
 * period has earned so far, and what a club's live bids commit it to.
 */

import {
  gameweeksInPeriod,
  MERIT_PERIOD_COUNT,
  type MatchupResultRow,
  type MeritRates,
} from '@/lib/economy/meritPayments';

export type PipResult = 'W' | 'D' | 'L' | 'B' | null;

export interface MatchRevenueOutlook {
  periodIndex: number;
  /** One per gameweek in the period; null for a gameweek not yet resolved. */
  pips: { gameweek: number; result: PipResult }[];
  /** Earned by the results so far, before the payout rounds down. */
  earned: number;
  /** The most the rest of the period can add: every remaining match won. */
  upside: number;
  /** The gameweek whose resolution pays the period. */
  payAfterGw: number;
}

/**
 * The next unpaid period. Periods pay in order as gameweeks resolve, so the
 * first one with no `merit_payments` row is the one accruing now. Null once
 * the season's last period has paid, or when the league pays no Match Revenue.
 */
export function matchRevenueOutlook({
  teamId,
  paidPeriods,
  matchups,
  rates,
}: {
  teamId: string;
  paidPeriods: Set<number>;
  /** Every league matchup in the period; others are ignored. */
  matchups: MatchupResultRow[];
  rates: MeritRates;
}): MatchRevenueOutlook | null {
  if (rates.win === 0 && rates.draw === 0 && rates.loss === 0 && rates.bye === 0) return null;

  let periodIndex = 1;
  while (periodIndex <= MERIT_PERIOD_COUNT && paidPeriods.has(periodIndex)) periodIndex++;
  if (periodIndex > MERIT_PERIOD_COUNT) return null;

  const gameweeks = gameweeksInPeriod(periodIndex);
  let earned = 0;
  let open = 0;

  const pips = gameweeks.map((gameweek) => {
    const week = matchups.filter((m) => m.gameweek === gameweek);
    const mine = week.find((m) => m.team_a_id === teamId || m.team_b_id === teamId);
    let result: PipResult = null;
    if (mine?.status === 'completed') {
      result = mine.winner_team_id === null ? 'D' : mine.winner_team_id === teamId ? 'W' : 'L';
    } else if (!mine && week.some((m) => m.status === 'completed')) {
      // Odd-sized league: the club sat the week out while everyone else played.
      result = 'B';
    }
    if (result === 'W') earned += rates.win;
    else if (result === 'D') earned += rates.draw;
    else if (result === 'L') earned += rates.loss;
    else if (result === 'B') earned += rates.bye;
    else open++;
    return { gameweek, result };
  });

  return {
    periodIndex,
    pips,
    earned,
    upside: open * rates.win,
    payAfterGw: gameweeks[gameweeks.length - 1],
  };
}

export interface AuctionStateRow {
  player_id: string;
  kind: string;
  seller_team_id: string | null;
  highest_bid: number | null;
  highest_bidder_team_id: string | null;
  bid_count: number | null;
  bids: unknown;
  expires_at: string | null;
}

export interface LiveBid {
  playerId: string;
  /** Your highest bid on the lot. */
  myBid: number;
  topBid: number;
  winning: boolean;
  expiresAt: string | null;
}

/**
 * Every live lot the club has bid on, soonest clock first. A bid is only a
 * commitment while it is winning: an outbid one costs nothing at the clock.
 */
export function liveBidsFor(teamId: string, auctions: AuctionStateRow[]): LiveBid[] {
  const out: LiveBid[] = [];
  for (const a of auctions) {
    const bids = Array.isArray(a.bids) ? (a.bids as { team_id?: string; amount?: number }[]) : [];
    const mine = bids.filter((b) => b.team_id === teamId).map((b) => Number(b.amount ?? 0));
    if (mine.length === 0) continue;
    out.push({
      playerId: a.player_id,
      myBid: Math.max(...mine),
      topBid: Number(a.highest_bid ?? 0),
      winning: a.highest_bidder_team_id === teamId,
      expiresAt: a.expires_at,
    });
  }
  return out.sort((x, y) => (x.expiresAt ?? '9').localeCompare(y.expiresAt ?? '9'));
}

/** Sum of the bids a club is currently winning: what it is committed to. */
export function committedTo(bids: LiveBid[]): number {
  return bids.reduce((sum, b) => (b.winning ? sum + b.topBid : sum), 0);
}
