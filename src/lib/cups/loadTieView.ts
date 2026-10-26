/**
 * Reads for a cup tie's page.
 *
 * A cup tie has the shape of a league matchup, two clubs on one matchweek's
 * scores, but its clubs usually aren't each other's league opponent that
 * week. So each side comes from its own league matchup, and the two are put
 * together as one synthetic row for the unchanged loadMatchupView: the same
 * source scoreLeg uses to score a cup leg, so the page and the result agree.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FplStatus } from '@/lib/fpl/api';
import type { HonourKind } from '@/lib/honours/getClubHonours';
import { loadManagers, loadMatchupContext } from '@/lib/matchups/context';
import { clubColour, loadMatchupView, type MatchupRow, type MatchupView } from '@/lib/matchups/matchupView';
import { loadHeadToHead, MATCHUP_SELECT } from '@/lib/matchups/pages';
import type { TeamLite, TieLite } from '@/components/gameweeks/types';
import type { H2HData } from '@/components/gameweeks/TeamSheets';
import type { Matchup, TournamentType } from '@/types';

const KIND: Record<TournamentType, HonourKind> = { primary_cup: 'champions_cup', secondary_cup: 'league_cup', consolation_cup: 'consolation_cup' };

export interface CupTieProps {
  leagueId: string;
  myTeamId?: string;
  cup: { id: string; name: string; kind: HonourKind };
  round: { name: string; twoLeg: boolean; legs: number[] };
  /** Which leg is on screen, 1 or 2. */
  leg: 1 | 2;
  view: MatchupView;
  teams: { a: TeamLite; b: TeamLite };
  current: TieLite;
  /** Total across legs played, per side. */
  aggregate: { a: number; b: number } | null;
  winnerId: string | null;
  /** "Level at 54.30. Through on best performer: Saka 14.2 v Palmer 11.8." */
  decidedLine: string | null;
  h2h: H2HData | null;
  window: { first: string | null; last: string | null };
  deadline: string | null;
}

const fmt2 = (v: number) => v.toFixed(2);
const fmt1 = (v: number) => v.toFixed(1);

/** One club's league matchup for a matchweek, as the side of a cup tie. */
function sideOf(rows: MatchupRow[], teamId: string) {
  const row = rows.find((m) => m.team_a_id === teamId || m.team_b_id === teamId) ?? null;
  if (!row) return { lineup: null, score: 0, status: 'scheduled' as const };
  const isA = row.team_a_id === teamId;
  return { lineup: isA ? row.lineup_a : row.lineup_b, score: Number(isA ? row.score_a : row.score_b), status: row.status };
}

export async function loadTieView(
  admin: SupabaseClient,
  opts: { leagueId: string; tieId: string; leg: 1 | 2 | null; myTeamId?: string; fplStatus: FplStatus | null },
): Promise<CupTieProps | null> {
  const { leagueId, tieId, myTeamId } = opts;
  const { data: tie } = await admin
    .from('tournament_matchups')
    .select('id, round_id, team_a_id, team_b_id, team_a_score_leg1, team_b_score_leg1, team_a_score_leg2, team_b_score_leg2, winner_id, decided_by, status')
    .eq('id', tieId)
    .maybeSingle();
  if (!tie?.team_a_id || !tie.team_b_id) return null;
  const { data: round } = await admin
    .from('tournament_rounds')
    .select('id, tournament_id, name, start_gameweek, end_gameweek, is_two_leg, drawn_at')
    .eq('id', tie.round_id)
    .maybeSingle();
  if (!round) return null;
  const { data: cup } = await admin.from('tournaments').select('id, name, type, league_id').eq('id', round.tournament_id).maybeSingle();
  if (!cup || cup.league_id !== leagueId) return null;

  const currentGw = opts.fplStatus?.currentGw ?? 1;
  const legs = round.is_two_leg ? [round.start_gameweek, round.end_gameweek] : [round.start_gameweek];
  // Default to the latest leg that has started.
  const leg: 1 | 2 = opts.leg === 2 && round.is_two_leg ? 2 : opts.leg === 1 ? 1 : round.is_two_leg && currentGw >= round.end_gameweek ? 2 : 1;
  const gw = legs[leg - 1];

  const [{ data: weekRows }, { data: allRows }, managers, { data: teamRows }] = await Promise.all([
    admin.from('matchups').select(MATCHUP_SELECT).eq('league_id', leagueId).eq('gameweek', gw),
    admin.from('matchups').select(MATCHUP_SELECT).eq('league_id', leagueId).order('gameweek', { ascending: true }),
    loadManagers(admin, leagueId),
    admin.from('teams').select('id, team_name, crest_config').in('id', [tie.team_a_id, tie.team_b_id]),
  ]);
  const rows = (weekRows ?? []) as MatchupRow[];
  const team = (id: string): TeamLite => {
    const t = (teamRows ?? []).find((x) => x.id === id);
    return { id, name: t?.team_name ?? 'Unknown', crest: t?.crest_config ?? null, manager: managers[id] ?? null, color: clubColour(t?.crest_config ?? null) };
  };
  const A = team(tie.team_a_id);
  const B = team(tie.team_b_id);
  const sa = sideOf(rows, A.id);
  const sb = sideOf(rows, B.id);
  const status: Matchup['status'] = sa.status === 'completed' && sb.status === 'completed' ? 'completed'
    : sa.status === 'live' || sb.status === 'live' ? 'live' : 'scheduled';

  const synthetic = {
    id: tie.id,
    league_id: leagueId,
    gameweek: gw,
    team_a_id: A.id,
    team_b_id: B.id,
    score_a: sa.score,
    score_b: sb.score,
    lineup_a: sa.lineup,
    lineup_b: sb.lineup,
    status,
    created_at: new Date(0).toISOString(),
    team_a: { id: A.id, team_name: A.name, crest_config: A.crest },
    team_b: { id: B.id, team_name: B.name, crest_config: B.crest },
  } as unknown as MatchupRow;

  const ctx = await loadMatchupContext(admin, gw, { currentGw, isFinished: opts.fplStatus?.isFinished ?? false }, managers);
  const view = await loadMatchupView(admin, synthetic, ctx);

  // Aggregate across the legs played so far; the leg on screen uses the view's live score.
  let aggregate: CupTieProps['aggregate'] = null;
  if (round.is_two_leg && currentGw >= round.start_gameweek) {
    const other = leg === 1 ? 2 : 1;
    const otherPlayed = legs[other - 1] <= currentGw;
    const otherA = otherPlayed ? Number(other === 1 ? tie.team_a_score_leg1 : tie.team_a_score_leg2) : 0;
    const otherB = otherPlayed ? Number(other === 1 ? tie.team_b_score_leg1 : tie.team_b_score_leg2) : 0;
    aggregate = { a: view.a.score + otherA, b: view.b.score + otherB };
  }

  let decidedLine: string | null = null;
  if (tie.status === 'completed' && tie.decided_by && tie.decided_by !== 'score') {
    const total = aggregate ? aggregate.a : view.a.score;
    if (tie.decided_by === 'best_performer') {
      const best = (sv: MatchupView['a']) => [...sv.starters].sort((x, y) => y.points - x.points)[0];
      const ba = best(view.a), bb = best(view.b);
      decidedLine = ba && bb
        ? `Level at ${fmt2(total)}. Through on best performer: ${ba.name} ${fmt1(ba.points)} v ${bb.name} ${fmt1(bb.points)}.`
        : `Level at ${fmt2(total)}. Through on best performer.`;
    } else {
      decidedLine = `Level at ${fmt2(total)}. Through on ${round.drawn_at ? 'league position' : 'seeding'}.`;
    }
  }

  const names = { [A.id]: A.name, [B.id]: B.name };
  const h2h = view.state === 'live' ? null : await loadHeadToHead(admin, {
    leagueId, season: ctx.currentSeason, gw, state: view.state, a: A.id, b: B.id, myTeamId, names,
    rows: (allRows ?? []) as MatchupRow[],
    isThisMeeting: (r) => r.competition === cup.type && r.season === ctx.currentSeason && r.stage === round.name,
  });

  const kicks = Object.values(ctx.fixtureMap).map((f) => f.kickoffTime).filter(Boolean).sort() as string[];
  const fpl = opts.fplStatus;
  const deadline = view.state === 'upcoming' && fpl && fpl.nextGw === gw ? fpl.nextDeadline : null;

  return {
    leagueId,
    myTeamId,
    cup: { id: cup.id, name: cup.name, kind: KIND[cup.type as TournamentType] },
    round: { name: round.name, twoLeg: round.is_two_leg, legs },
    leg,
    view,
    teams: { a: A, b: B },
    current: { id: tie.id, a: A, b: B, scoreA: view.a.score, scoreB: view.b.score, state: view.state, view },
    aggregate,
    winnerId: tie.status === 'completed' ? tie.winner_id : null,
    decidedLine,
    h2h,
    window: { first: kicks[0] ?? null, last: kicks[kicks.length - 1] ?? null },
    deadline,
  };
}
