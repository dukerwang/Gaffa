/**
 * Which systems a league has, by format.
 *
 * Gaffa is built around dynasty: squads carry over forever, so academies,
 * loans, a retained list, permanent facilities and a cash economy that pays
 * out over seasons all reward planning ahead. Redraft starts every squad from
 * scratch each season, and is meant to be the format a newcomer from FPL, ESPN
 * or Yahoo understands without a guide. It keeps the game a newcomer feels
 * straight away (scoring, positions, lineups, matchups, cups, trades, IR, open
 * bidding) and switches off the systems whose payoff only shows across seasons.
 *
 * Spec: docs/superpowers/specs/2026-10-04-redraft-mode-design.md. The economy
 * simulation behind the budget decisions is in scratch/redraft-economy-sim/.
 *
 * Every switch here is enforced server-side; the UI hides what it turns off.
 */

export interface LeagueFormat {
  is_dynasty: boolean | null | undefined;
}

export interface LeagueFeatures {
  /** Listing your own players for sale, with minimum bids, release clauses and asking prices. */
  listings: boolean;
  loans: boolean;
  /** The U21 academy (roster status `taxi`). */
  academy: boolean;
  /** Buying extra Academy, IR and Loans Out slots. */
  facilities: boolean;
  /** The 20% fee for dropping a player. */
  severance: boolean;
  /** Release/Retain decisions when a player leaves the Premier League. */
  retainedList: boolean;
  /** Free-agent minimum bid as a share of market value (dynasty) rather than a flat €1m (redraft). */
  marketValueBidFloor: boolean;
}

export function isRedraft(league: LeagueFormat | null | undefined): boolean {
  return league?.is_dynasty === false;
}

export function leagueFeatures(league: LeagueFormat | null | undefined): LeagueFeatures {
  const dynasty = !isRedraft(league);
  return {
    listings: dynasty,
    loans: dynasty,
    academy: dynasty,
    facilities: dynasty,
    severance: dynasty,
    retainedList: dynasty,
    marketValueBidFloor: dynasty,
  };
}

/** A redraft league's free-agent minimum bid, whatever the player's market value. */
export const REDRAFT_MINIMUM_BID = 1;

/** A redraft league's Club Balance at the start of every season. */
export const REDRAFT_BUDGET = 100;

/**
 * League columns a redraft league is created with. The database code that
 * reads them (Match Revenue, the solidarity and scout split in the auction
 * resolver, academy and loan capacity) then pays or allows nothing, so those
 * systems are off even on paths that never check the format.
 */
export const REDRAFT_LEAGUE_SETTINGS = {
  merit_win: 0,
  merit_draw: 0,
  merit_loss: 0,
  merit_bye: 0,
  solidarity_share: 0,
  scout_share: 0,
  taxi_size: 0,
  max_loan_outs: 0,
  max_loan_ins: 0,
  retained_slots: 0,
  /** A player who leaves the Premier League goes with no compensation. */
  departure_compensation_rate: 0,
} as const;

/**
 * The lowest bid a free agent can open at. Dynasty floors it at a share of
 * market value, rounded down, so a cheap player can't be signed for nothing
 * and a star can't be signed for a token amount. Redraft uses a flat €1m: the
 * simulation found a market-value floor makes prices track Transfermarkt
 * rather than points, which is the wrong signal for a one-season league.
 */
export function freeAgentMinimumBid(
  marketValue: number | null | undefined,
  league: LeagueFormat | null | undefined,
  bidFloor: number,
): number {
  if (isRedraft(league)) return REDRAFT_MINIMUM_BID;
  return Math.floor(Number(marketValue || 0) * bidFloor);
}

export const FEATURE_OFF_MESSAGE = {
  listings: "Redraft leagues don't have player listings. Trade players with other clubs instead.",
  loans: "Redraft leagues don't have loans.",
  academy: "Redraft leagues don't have an academy.",
  facilities: "Redraft leagues don't have Club Facilities.",
} as const;
