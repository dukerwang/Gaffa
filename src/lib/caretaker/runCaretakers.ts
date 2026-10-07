import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiveSlots } from '@/lib/facilities/facilities';
import { getLockedPlTeamIds } from '@/lib/fixtures/lockout';
import { resolveLineupEditMatchup } from '@/lib/lineups/editTarget';
import { loadIrLockChecker } from '@/lib/lineups/irLockServer';
import { isGameweekInProgress } from '@/lib/roster/holds';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';
import { resolveCurrentGw } from '@/lib/season/currentGameweek';
import { pickCaretakerLineup, planSquadMoves, type CaretakerEntry } from './plan';

const PLAYER_SELECT =
  'id, primary_position, secondary_positions, pl_team_id, ppg, fpl_status, fpl_chance_next_round, projected_points, projected_season, projected_gameweek';

export interface CaretakerClubReport {
  teamId: string;
  teamName: string;
  moves: string[];
  lineup: 'set' | 'locked' | 'no_matchup' | 'not_enough_players' | 'skipped';
  gameweek?: number;
}

/**
 * Runs the Caretaker for every club that has no manager.
 *
 * For each one: tidy the squad (IR and held players) while no gameweek is
 * under way, then set the best lineup for the gameweek managers are editing,
 * until the club's first player kicks off. After that the lineup stands, the
 * same as for a manager whose formation has locked.
 *
 * Cheap when there's nothing to do: one query finds no Caretaker clubs and it
 * returns. Called from the daily lineup crons.
 */
export async function runCaretakers(admin: SupabaseClient, now: Date = new Date()): Promise<CaretakerClubReport[]> {
  const { data: clubs, error } = await admin
    .from('teams')
    .select('id, team_name, league_id, ir_slots, league:leagues(id, status, ir_size)')
    .is('user_id', null);
  if (error) throw error;

  const active = (clubs ?? []).filter((c) => {
    const league = (Array.isArray(c.league) ? c.league[0] : c.league) as { status?: string } | null;
    return league?.status === 'active';
  });
  if (active.length === 0) return [];

  const [currentGw, season, inProgress] = await Promise.all([
    resolveCurrentGw(),
    getCurrentFplSeason(),
    isGameweekInProgress(admin, now),
  ]);
  const lockedByGameweek = new Map<number, Set<number>>();
  const lockedFor = async (gw: number) => {
    if (!lockedByGameweek.has(gw)) lockedByGameweek.set(gw, await getLockedPlTeamIds(admin, gw));
    return lockedByGameweek.get(gw)!;
  };

  const reports: CaretakerClubReport[] = [];
  for (const club of active) {
    const report: CaretakerClubReport = { teamId: club.id, teamName: club.team_name, moves: [], lineup: 'skipped' };
    reports.push(report);
    try {
      const league = (Array.isArray(club.league) ? club.league[0] : club.league) as { ir_size?: number | null } | null;

      // 1. Squad housekeeping. Held players can't be activated mid-gameweek,
      // and keeping IR moves to the same window keeps every scoring lineup
      // intact; the IR lock check covers the rest.
      if (!inProgress) {
        const entries = await loadEntries(admin, club.id);
        const [{ data: rosterLimit }, isIrLocked] = await Promise.all([
          admin.rpc('team_roster_limit', { p_team_id: club.id }),
          loadIrLockChecker(admin, club.id),
        ]);
        const moves = planSquadMoves({
          entries,
          irSlots: effectiveSlots(club, league).ir,
          rosterLimit: Number(rosterLimit ?? 0),
          isIrLocked,
        });
        for (const move of moves) {
          if (move.kind === 'activate_held') {
            const { error: heldErr } = await admin.rpc('activate_held_rpc', { p_entry_id: move.entryId, p_target: 'bench' });
            if (heldErr) {
              report.moves.push(`held ${move.playerId}: ${heldErr.message}`);
              continue;
            }
          } else {
            const { error: moveErr } = await admin
              .from('roster_entries')
              .update({ status: move.kind === 'to_ir' ? 'ir' : 'bench' })
              .eq('id', move.entryId);
            if (moveErr) {
              report.moves.push(`${move.kind} ${move.playerId}: ${moveErr.message}`);
              continue;
            }
          }
          report.moves.push(`${move.kind} ${move.playerId}`);
        }
      }

      // 2. Lineup for the week managers are editing.
      const matchup = await resolveLineupEditMatchup(admin, club.id, currentGw);
      if (!matchup) {
        report.lineup = 'no_matchup';
        continue;
      }
      report.gameweek = matchup.gameweek;

      const entries = await loadEntries(admin, club.id);
      const locked = await lockedFor(matchup.gameweek);
      const squadKickedOff = entries.some(
        (e) => e.status !== 'taxi' && e.status !== 'loan_out' && e.player.pl_team_id != null && locked.has(e.player.pl_team_id),
      );
      if (squadKickedOff) {
        report.lineup = 'locked';
        continue;
      }

      const lineup = pickCaretakerLineup(entries, season, matchup.gameweek);
      if (!lineup) {
        report.lineup = 'not_enough_players';
        continue;
      }

      const column = matchup.team_a_id === club.id ? 'lineup_a' : 'lineup_b';
      const { error: writeErr } = await admin.from('matchups').update({ [column]: lineup }).eq('id', matchup.id);
      if (writeErr) throw writeErr;

      // Mirror the lineup route: starters are 'active', everyone else in the
      // squad is 'bench'.
      const starterIds = new Set(lineup.starters.map((s) => s.player_id));
      const starterEntries = entries.filter((e) => (e.status === 'active' || e.status === 'bench') && starterIds.has(e.player.id));
      const benchEntries = entries.filter((e) => (e.status === 'active' || e.status === 'bench') && !starterIds.has(e.player.id));
      if (starterEntries.length) {
        await admin.from('roster_entries').update({ status: 'active' }).in('id', starterEntries.map((e) => e.id));
      }
      if (benchEntries.length) {
        await admin.from('roster_entries').update({ status: 'bench' }).in('id', benchEntries.map((e) => e.id));
      }
      report.lineup = 'set';
    } catch (err) {
      report.moves.push(`error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return reports;
}

async function loadEntries(admin: SupabaseClient, teamId: string): Promise<CaretakerEntry[]> {
  const { data, error } = await admin
    .from('roster_entries')
    .select(`id, status, player:players(${PLAYER_SELECT})`)
    .eq('team_id', teamId);
  if (error) throw error;
  return (data ?? [])
    .map((r) => ({ id: r.id, status: r.status, player: Array.isArray(r.player) ? r.player[0] : r.player }) as CaretakerEntry)
    .filter((e) => !!e.player);
}
