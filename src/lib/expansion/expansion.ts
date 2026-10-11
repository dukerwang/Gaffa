import type { SupabaseClient } from '@supabase/supabase-js';
import { insertMatchups } from '@/lib/schedule/insertMatchups';
import { createAllTournaments } from '@/lib/tournaments/createTournaments';
import { resetMatchups, resetTournaments } from '@/lib/offseason/seasonReset';

/**
 * The expansion draft (migration 175): a dynasty league adding clubs in the
 * offseason. Each existing club protects 8 players (academy and loaned-out
 * players are exempt as well); the new clubs then take turns picking exposed
 * players, no more than 2 from any one club, or free agents, until their
 * squads are full. A new club starts with the league's median Club Balance.
 * Spec: docs/superpowers/specs/2026-10-04-expansion-and-takeovers-design.md
 */

export type ExpansionStatus = 'protecting' | 'drafting' | 'complete' | 'cancelled';

export interface Expansion {
  id: string;
  league_id: string;
  season: string;
  status: ExpansionStatus;
  new_clubs: number;
  protect_count: number;
  per_club_cap: number;
  protection_deadline: string | null;
}

export const EXPANSION_OPEN_STATUSES: ExpansionStatus[] = ['protecting', 'drafting'];

/** The league's expansion that's still choosing protections or drafting, if any. */
export async function getOpenExpansion(admin: SupabaseClient, leagueId: string): Promise<Expansion | null> {
  const { data, error } = await admin
    .from('expansions')
    .select('id, league_id, season, status, new_clubs, protect_count, per_club_cap, protection_deadline')
    .eq('league_id', leagueId)
    .in('status', EXPANSION_OPEN_STATUSES)
    .maybeSingle();
  if (error) throw error;
  return (data as Expansion | null) ?? null;
}

export async function getExpansionClubIds(admin: SupabaseClient, expansionId: string): Promise<string[]> {
  const { data, error } = await admin.from('expansion_clubs').select('team_id').eq('expansion_id', expansionId);
  if (error) throw error;
  return (data ?? []).map((r) => r.team_id as string);
}

/** Median of a set of balances, rounded down to whole €m. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.floor(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * The Club Balance a new club starts with: the median of the existing clubs'.
 * Median rather than average so one club sitting on a fortune doesn't inflate
 * it; existing rather than a fixed figure so it matches what the new club's
 * rivals hold at the summer auctions.
 */
export async function expansionStartingBalance(
  admin: SupabaseClient,
  leagueId: string,
  excludeTeamIds: string[] = [],
): Promise<number> {
  const { data, error } = await admin.from('teams').select('id, faab_budget').eq('league_id', leagueId);
  if (error) throw error;
  const balances = (data ?? [])
    .filter((t) => !excludeTeamIds.includes(t.id))
    .map((t) => Number(t.faab_budget ?? 0));
  return median(balances);
}

/**
 * Once the last pick lands: rebuild the season's schedule and cups with the
 * new clubs in them. Safe because expansion only runs in the offseason, before
 * a ball has been kicked in the season the reset generated.
 */
export async function rebuildSeasonForExpansion(admin: SupabaseClient, leagueId: string, season: string) {
  await resetMatchups(admin, leagueId);
  await resetTournaments(admin, leagueId);
  const schedule = await insertMatchups(admin, leagueId);
  const cups = await createAllTournaments(admin, leagueId, season);
  return { matchups: schedule.matchups ?? 0, tournaments: cups.tournamentsCreated.length };
}

export const EXPANSION_ONLY_IN_OFFSEASON =
  'An expansion draft can only run in the offseason, after the reset and before Kickoff.';
