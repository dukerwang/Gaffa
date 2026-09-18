import type { SupabaseClient } from '@supabase/supabase-js';
import { getRightsHeldPlayerIds } from '@/lib/departures/decisions';
import { fetchAllPagesOrThrow } from '@/lib/supabase/pagination';
import type { FutbolpediaFreeAgent } from './futbolpediaContextTypes';

/** Identity only — no fantasy points / form / projections (scoring-data firewall). */
export const FA_PLAYER_SELECT =
  'id, name, web_name, primary_position, pl_team, market_value, date_of_birth, is_active' as const;

export type FreeAgentPlayerRow = {
  id: string;
  name: string | null;
  web_name: string | null;
  primary_position: string | null;
  pl_team: string | null;
  market_value: number | null;
  date_of_birth: string | null;
  is_active?: boolean | null;
};

export function computePlayerAge(
  dateOfBirth: string | null | undefined,
  asOf: Date = new Date(),
): number | null {
  if (!dateOfBirth) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    let age = asOf.getUTCFullYear() - y;
    const monthDiff = asOf.getUTCMonth() - mo;
    if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < d)) age--;
    return age;
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/**
 * Gaffa free agency is the unowned active PL catalogue: not on any roster in
 * this league, and not sitting in a retained/return/on-loan-abroad rights hold.
 *
 * Live auctions are a subset (already being bid on). They stay IN this pool with
 * `live_auction: true` — excluding them is a UI de-dupe on the browse page, not
 * the definition of FA. Listings are owned and never belong here.
 */
export function selectUnownedFreeAgents(opts: {
  players: FreeAgentPlayerRow[];
  rosteredPlayerIds: Iterable<string>;
  rightsHeldPlayerIds: Iterable<string>;
  liveAuctionPlayerIds: Iterable<string>;
  now?: Date;
}): FutbolpediaFreeAgent[] {
  const rostered = new Set(opts.rosteredPlayerIds);
  const held = new Set(opts.rightsHeldPlayerIds);
  const live = new Set(opts.liveAuctionPlayerIds);
  const now = opts.now ?? new Date();

  const out: FutbolpediaFreeAgent[] = [];
  for (const p of opts.players) {
    if (!p?.id) continue;
    if (p.is_active === false) continue;
    if (rostered.has(p.id) || held.has(p.id)) continue;
    const full = (p.name || p.web_name || '').trim();
    const display = (p.web_name || p.name || '').trim();
    if (!full && !display) continue;
    const mv = p.market_value == null ? null : Number(p.market_value);
    out.push({
      player_id: p.id,
      name: full || display,
      display_name: display && display !== full ? display : undefined,
      position: p.primary_position || '?',
      pl_team: p.pl_team ?? null,
      market_value_eur_m: Number.isFinite(mv as number) ? (mv as number) : null,
      age: computePlayerAge(p.date_of_birth, now),
      live_auction: live.has(p.id),
    });
  }

  out.sort((a, b) => {
    const av = a.market_value_eur_m;
    const bv = b.market_value_eur_m;
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (bv !== av) return bv - av;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function loadUnownedFreeAgents(
  admin: SupabaseClient,
  leagueId: string,
  liveAuctionPlayerIds: Iterable<string>,
): Promise<FutbolpediaFreeAgent[]> {
  const [players, { data: teams, error: teamsError }, rightsHeld] = await Promise.all([
    fetchAllPagesOrThrow<FreeAgentPlayerRow>((from, to) =>
      admin
        .from('players')
        .select(FA_PLAYER_SELECT)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    admin.from('teams').select('id').eq('league_id', leagueId),
    getRightsHeldPlayerIds(admin, leagueId),
  ]);

  if (teamsError) throw new Error(`Failed to load league clubs: ${teamsError.message}`);

  const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
  const rostered =
    teamIds.length === 0
      ? []
      : await fetchAllPagesOrThrow<{ player_id: string }>((from, to) =>
          admin
            .from('roster_entries')
            .select('player_id')
            .in('team_id', teamIds)
            .order('player_id', { ascending: true })
            .range(from, to),
        );

  return selectUnownedFreeAgents({
    players,
    rosteredPlayerIds: rostered.map((r) => r.player_id),
    rightsHeldPlayerIds: rightsHeld,
    liveAuctionPlayerIds,
  });
}
