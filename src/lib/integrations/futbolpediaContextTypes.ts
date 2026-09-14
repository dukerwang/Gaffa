/** Wire contract for Futbolpedia club context — keep in sync with Futbolpedia types. */

export interface FutbolpediaContextRosterPlayer {
  player_id: string;
  name: string;
  display_name?: string;
  primary_position: string;
  secondary_positions?: string[];
  status: string;
  pl_team?: string | null;
}

export interface FutbolpediaContextStandings {
  rank: number | null;
  of_teams?: number;
  played?: number;
  wins: number;
  draws: number;
  losses: number;
  points_for: number;
  points_against?: number;
}

export interface FutbolpediaContextMatchup {
  gameweek: number;
  opponent_club_name: string | null;
  status: string;
  your_score?: number | null;
  opponent_score?: number | null;
}

export interface FutbolpediaContextLineupSlot {
  player_id: string;
  name: string;
  slot: string;
}

export interface FutbolpediaContextLineup {
  formation?: string | null;
  gameweek?: number;
  starters: FutbolpediaContextLineupSlot[];
  bench: FutbolpediaContextLineupSlot[];
}

/** Commissioner-tunable numbers that change Gaffa advice. No scoring-rule dump. */
export interface FutbolpediaLeagueSettings {
  roster_size: number;
  bench_size: number;
  ir_size: number;
  taxi_size: number | null;
  taxi_age_limit: number | null;
  max_teams: number;
  is_dynasty: boolean;
  starting_faab_eur_m: number | null;
  free_agent_bid_floor: number | null;
  max_loan_outs: number | null;
  max_loan_ins: number | null;
  league_status: string | null;
}

export interface FutbolpediaOpenListing {
  player_id: string;
  name: string;
  position: string;
  seller_club_id: string;
  seller_club_name: string;
  yours: boolean;
  status: string;
  min_bid_eur_m: number | null;
  ask_eur_m: number | null;
  release_clause_eur_m: number | null;
  open_to_trade: boolean;
  open_to_sale: boolean;
  open_to_loan: boolean;
  expires_at: string | null;
}

export interface FutbolpediaOpenAuction {
  player_id: string;
  name: string;
  position: string;
  kind: string;
  highest_bid_eur_m: number | null;
  expires_at: string | null;
}

export interface FutbolpediaClubContextResponse {
  league_id: string;
  club_id: string;
  league_name: string;
  club_name: string;
  budget_eur_m: number;
  roster: FutbolpediaContextRosterPlayer[];
  standings: FutbolpediaContextStandings;
  matchup: FutbolpediaContextMatchup | null;
  lineup: FutbolpediaContextLineup | null;
  settings: FutbolpediaLeagueSettings;
  open_listings: FutbolpediaOpenListing[];
  open_auctions: FutbolpediaOpenAuction[];
  synced_at: string;
}
