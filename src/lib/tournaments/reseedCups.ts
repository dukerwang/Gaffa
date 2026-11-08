/**
 * Re-draws a league's cups that were seeded before there was anything to seed
 * from (see seeding.ts), so long as no tie has been played.
 *
 * A cup is rebuilt, not edited: it is deleted (rounds and ties cascade) and
 * createTournament makes it again from the current table, which also places
 * the bye clubs and tells every manager about the redraw. Nothing that has
 * been played is ever touched; a cup with a played tie or a drawn later round
 * is left exactly as it is.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTournament } from '@/lib/tournaments/createTournaments';
import { loadArchiveRanks, loadStandings, orderForSeeding } from '@/lib/tournaments/seeding';
import type { TournamentType } from '@/types';

export type ReseedOutcome =
  | { type: TournamentType; status: 'reseeded'; before: string[]; after: string[] }
  | { type: TournamentType; status: 'kept'; reason: string };

/** A tie is played when both clubs are in it and it is complete; a bye is complete from the start. */
export function isUnplayed(
  ties: { team_a_id: string | null; team_b_id: string | null; status: string }[],
  rounds: { drawn_at: string | null }[],
): boolean {
  if (rounds.some((r) => r.drawn_at)) return false;
  return !ties.some((t) => t.team_a_id && t.team_b_id && t.status === 'completed');
}

/** Club names of a cup's first round in bracket order, byes shown as "(bye)". For a before/after read-out. */
async function firstRoundNames(admin: SupabaseClient, tournamentId: string): Promise<string[]> {
  const { data: round } = await admin
    .from('tournament_rounds')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round_number', 1)
    .single();
  if (!round) return [];
  const { data: ties } = await admin
    .from('tournament_matchups')
    .select('bracket_position, a:teams!team_a_id(team_name), b:teams!team_b_id(team_name)')
    .eq('round_id', round.id)
    .order('bracket_position');
  return (ties ?? []).map((t: any) => `${t.a?.team_name ?? '(bye)'} v ${t.b?.team_name ?? '(bye)'}`);
}

/**
 * With `dryRun`, reports what would change and writes nothing.
 * The Consolation Cup is left alone in a league under 7 clubs: it holds
 * placeholders, filled later from Champions Cup losers, with no seeding to fix.
 */
export async function reseedUnplayedCups(
  admin: SupabaseClient,
  leagueId: string,
  season: string,
  opts: { dryRun?: boolean } = {},
): Promise<ReseedOutcome[]> {
  const [archiveRanks, standings, { data: teams }, { data: cups }] = await Promise.all([
    loadArchiveRanks(admin, leagueId),
    loadStandings(admin, leagueId),
    admin.from('teams').select('id, team_name').eq('league_id', leagueId),
    admin.from('tournaments').select('id, type').eq('league_id', leagueId).eq('season', season),
  ]);

  const { basis } = orderForSeeding(teams ?? [], archiveRanks, standings);
  if (basis === 'none') {
    return (cups ?? []).map((c) => ({ type: c.type as TournamentType, status: 'kept', reason: 'no table to seed from yet' }));
  }

  const out: ReseedOutcome[] = [];
  for (const cup of cups ?? []) {
    const type = cup.type as TournamentType;
    if (type === 'consolation_cup' && (teams?.length ?? 0) < 7) {
      out.push({ type, status: 'kept', reason: 'filled from Champions Cup losers, nothing to seed' });
      continue;
    }

    const { data: rounds } = await admin.from('tournament_rounds').select('id, drawn_at').eq('tournament_id', cup.id);
    const { data: ties } = await admin
      .from('tournament_matchups')
      .select('team_a_id, team_b_id, status')
      .in('round_id', (rounds ?? []).map((r) => r.id));
    if (!isUnplayed(ties ?? [], rounds ?? [])) {
      out.push({ type, status: 'kept', reason: 'a tie has been played or a later round drawn' });
      continue;
    }

    const before = await firstRoundNames(admin, cup.id);
    if (opts.dryRun) {
      out.push({ type, status: 'reseeded', before, after: [] });
      continue;
    }

    const { error } = await admin.from('tournaments').delete().eq('id', cup.id);
    if (error) throw new Error(`Could not remove ${type} for reseeding: ${error.message}`);
    const made = await createTournament(admin, leagueId, type, 1, season, { corrected: true });
    if (!made.ok || made.skipped || !made.tournament_id) {
      throw new Error(`${type} was removed but not rebuilt: ${made.error ?? 'skipped'}. Run createTournament for it.`);
    }
    out.push({ type, status: 'reseeded', before, after: await firstRoundNames(admin, made.tournament_id) });
  }
  return out;
}
