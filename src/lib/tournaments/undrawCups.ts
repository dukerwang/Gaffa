/**
 * Removes a league's cups that were drawn before the rule that draws them after
 * the gameweek before their first round, so drawDueCups draws them again when
 * they are due (see seeding.ts).
 *
 * Only a cup nobody has played in is removed: a played tie or a drawn later
 * round leaves it exactly as it is. Rounds and ties go with the tournament row
 * (ON DELETE CASCADE). No notice is sent; the next draw sends the real one.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TournamentType } from '@/types';

export type UndrawOutcome =
  | { type: TournamentType; status: 'removed' | 'would remove'; firstRound: string[] }
  | { type: TournamentType; status: 'kept'; reason: string };

/** A tie is played when both clubs are in it and it is complete; a bye is complete from the start. */
export function isUnplayed(
  ties: { team_a_id: string | null; team_b_id: string | null; status: string }[],
  rounds: { drawn_at: string | null }[],
): boolean {
  if (rounds.some((r) => r.drawn_at)) return false;
  return !ties.some((t) => t.team_a_id && t.team_b_id && t.status === 'completed');
}

/** Club names of a cup's first round in bracket order, byes shown as "(bye)". For a read-out. */
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
 * With `dryRun`, reports what would be removed and writes nothing. A Consolation
 * Cup in a league under 7 clubs holds only placeholders, filled later from
 * Champions Cup losers; it has no draw to redo and is kept.
 */
export async function undrawUnplayedCups(
  admin: SupabaseClient,
  leagueId: string,
  season: string,
  opts: { dryRun?: boolean } = {},
): Promise<UndrawOutcome[]> {
  const [{ data: teams }, { data: cups }] = await Promise.all([
    admin.from('teams').select('id').eq('league_id', leagueId),
    admin.from('tournaments').select('id, type').eq('league_id', leagueId).eq('season', season),
  ]);

  const out: UndrawOutcome[] = [];
  for (const cup of cups ?? []) {
    const type = cup.type as TournamentType;
    if (type === 'consolation_cup' && (teams?.length ?? 0) < 7) {
      out.push({ type, status: 'kept', reason: 'placeholders only, filled from Champions Cup losers' });
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

    const firstRound = await firstRoundNames(admin, cup.id);
    if (opts.dryRun) {
      out.push({ type, status: 'would remove', firstRound });
      continue;
    }
    const { error } = await admin.from('tournaments').delete().eq('id', cup.id);
    if (error) throw new Error(`Could not remove ${type}: ${error.message}`);
    out.push({ type, status: 'removed', firstRound });
  }
  return out;
}
