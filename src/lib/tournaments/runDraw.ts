/**
 * Draws one cup round and tells each manager who they got.
 *
 * Used for every League Cup round after the first and for a small league's
 * Consolation Cup once its Champions Cup losers are in. The pairing is
 * pairDraw's; apply_cup_draw (migration 183) writes it under a lock and
 * refuses a round that's already drawn, so when two resolve paths race, one
 * draw lands and only that caller notifies.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications/createNotification';
import { pairDraw, type DrawnTie, type Entrant } from '@/lib/tournaments/draw';

type Notify = typeof createNotification;

export interface DrawRound {
  id: string;
  tournament_id: string;
  name: string;
  round_number: number;
  start_gameweek: number;
  end_gameweek: number;
  is_two_leg: boolean;
}

export async function runDraw(
  admin: SupabaseClient,
  opts: {
    tournament: { id: string; league_id: string; name: string };
    round: DrawRound;
    random?: () => number;
    notify?: Notify;
  },
): Promise<{ applied: boolean; ties: DrawnTie[] }> {
  const { tournament, round } = opts;
  const random = opts.random ?? Math.random;
  const notify = opts.notify ?? createNotification;

  const [{ data: prevRound }, { data: roundTies }] = await Promise.all([
    admin
      .from('tournament_rounds')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('round_number', round.round_number - 1)
      .maybeSingle(),
    admin.from('tournament_matchups').select('id, team_a_id, team_b_id, bracket_position').eq('round_id', round.id),
  ]);
  const ties = roundTies ?? [];
  if (ties.length === 0) return { applied: false, ties: [] };

  // The same entrant rule as apply_cup_draw: the previous round's winners, or
  // (a Consolation Cup's first round) the clubs already placed in this one.
  let entrantIds: string[];
  if (prevRound) {
    const { data: prevTies } = await admin
      .from('tournament_matchups')
      .select('status, winner_id')
      .eq('round_id', prevRound.id);
    const prev = prevTies ?? [];
    if (prev.length === 0 || prev.some((t) => t.status !== 'completed')) return { applied: false, ties: [] };
    entrantIds = prev.map((t) => t.winner_id).filter((id): id is string => !!id);
  } else {
    entrantIds = ties.flatMap((t) => [t.team_a_id, t.team_b_id]).filter((id): id is string => !!id);
  }
  if (entrantIds.length < ties.length) return { applied: false, ties: [] };

  const { data: standings } = await admin.from('league_standings').select('team_id, rank').eq('league_id', tournament.league_id);
  const rankOf = new Map((standings ?? []).map((s) => [s.team_id as string, Number(s.rank)]));
  const entrants: Entrant[] = entrantIds.map((teamId) => ({ teamId, rank: rankOf.get(teamId) ?? 999 }));

  const drawn = pairDraw(entrants, ties.length, random);
  const { data: applied, error } = await admin.rpc('apply_cup_draw', {
    p_round_id: round.id,
    p_ties: drawn.map((t, position) => ({ position, a: t.a, b: t.b })),
  });
  if (error) throw new Error(`apply_cup_draw failed: ${error.message}`);
  if (applied !== true) return { applied: false, ties: drawn };

  try {
    await notifyDraw(admin, notify, tournament, round, drawn);
  } catch (err) {
    console.error('[runDraw] Failed to send draw notifications:', err);
  }
  return { applied: true, ties: drawn };
}

async function notifyDraw(
  admin: SupabaseClient,
  notify: Notify,
  tournament: { league_id: string; name: string },
  round: DrawRound,
  drawn: DrawnTie[],
) {
  const ids = drawn.flatMap((t) => [t.a, t.b]).filter((id): id is string => !!id);
  const { data: teams } = await admin.from('teams').select('id, user_id, team_name').in('id', ids);
  const byId = new Map((teams ?? []).map((t) => [t.id as string, t]));
  const stage = round.name.toLowerCase();
  const nextStage = drawNextStage(round.name);
  const when = round.is_two_leg ? `over MW${round.start_gameweek} and MW${round.end_gameweek}` : `in MW${round.start_gameweek}`;
  const url = `/league/${tournament.league_id}/tournaments`;

  for (const tie of drawn) {
    const sides: [string, string | null][] = [[tie.a, tie.b], ...(tie.b ? [[tie.b, tie.a] as [string, string]] : [])];
    for (const [mine, other] of sides) {
      const team = byId.get(mine);
      if (!team) continue;
      const content = other
        ? `**${tournament.name}** ${stage} draw: you play **${byId.get(other)?.team_name ?? 'your opponent'}** ${when}.`
        : `**${tournament.name}** ${stage} draw: you have a bye to the ${nextStage}.`;
      await notify(admin, {
        kind: 'matchdays',
        leagueId: tournament.league_id,
        userId: (team.user_id as string | null) ?? null,
        title: `${tournament.name} Draw`,
        content,
        url,
        tag: `cup-draw:${round.id}:${mine}`,
      });
    }
  }
}

function drawNextStage(roundName: string): string {
  const name = roundName.toLowerCase();
  if (name.includes('quarter')) return 'semi-final';
  if (name.includes('semi')) return 'final';
  return 'next round';
}
