/**
 * Whether a player can be proactively routed to the academy on an auction
 * win (migration 117) — independent of whether the bidder's active roster
 * happens to be full. Age math mirrors the server-side copy in
 * `src/app/api/leagues/[leagueId]/auctions/bid/route.ts` and
 * `resolve_single_player_auction_rpc`; this is the client-side pre-check
 * that decides whether the "send to academy" checkbox even appears.
 */

export interface AcademyCapacity {
  current: number;
  max: number;
  age_limit: number;
}

/**
 * Returns the season kickoff anchor date (August 1 of the season start year).
 * In Premier League academy/U21 rules, age eligibility is fixed at the start
 * of the campaign — turning 21 or 22 mid-season does not disqualify a player
 * until the next season rollover.
 */
export function getSeasonReferenceDate(season?: string | null): Date {
  let startYear: number;
  if (season && /^\d{4}/.test(season)) {
    startYear = parseInt(season.slice(0, 4), 10);
  } else {
    const now = new Date();
    // June or later is the lead-up/start of the new season
    startYear = now.getUTCMonth() >= 5 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  }
  return new Date(Date.UTC(startYear, 7, 1)); // August 1 UTC
}

export function calculateAgeInYears(dobIso: string, referenceDate: Date = getSeasonReferenceDate()): number {
  const dob = new Date(dobIso);
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function isAcademyEligible(
  dateOfBirth: string | null | undefined,
  academy: AcademyCapacity,
  referenceDate: Date = getSeasonReferenceDate(),
): boolean {
  if (!dateOfBirth) return false;
  if (academy.current >= academy.max) return false;
  return calculateAgeInYears(dateOfBirth, referenceDate) <= academy.age_limit;
}
