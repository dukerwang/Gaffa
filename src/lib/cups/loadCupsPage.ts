/**
 * Reads for the Cups page, in the waves the old page used: the league, your
 * club, its cups and FPL's matchweeks together; then every round and tie (the
 * shelf needs all three cups, not only the one on screen); then, only while a
 * cup matchweek is live, each club's running score from its league matchup.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrestConfig } from '@/components/crest/types';
import { getBootstrapSlim, type FplEventSlim } from '@/lib/fpl/bootstrapSlim';
import { DEFAULT_PRIZE_CONFIG, type PrizeConfig } from '@/lib/offseason/prizeDistribution';
import type { TournamentType } from '@/types';
import { buildCupsModel, type CupRow, type CupsModel, type RoundRow, type TieRow } from './cupsView';

export type CupsPageResult =
  | { kind: 'notFound' }
  | { kind: 'redirect'; to: string }
  | { kind: 'ok'; leagueName: string; model: CupsModel; live: boolean };

/** FPL's current matchweek and whether it has finished; GW1 unfinished when FPL can't be read. */
export function fplState(events: FplEventSlim[], now = Date.now()): { currentGw: number; finished: boolean } {
  const current = events.find((e) => e.is_current);
  if (current) return { currentGw: current.id, finished: !!current.finished };
  let gw = 1;
  for (const e of events) if (e.deadline_time && new Date(e.deadline_time).getTime() <= now) gw = Math.max(gw, e.id);
  return { currentGw: gw, finished: !!events.find((e) => e.id === gw)?.finished };
}

export async function loadCupsPage(
  admin: SupabaseClient,
  opts: { leagueId: string; userId: string; selectedCupId: string | null; events?: FplEventSlim[] },
): Promise<CupsPageResult> {
  const { leagueId, userId } = opts;
  const [{ data: league }, { data: teams }, { data: cupsData }, events] = await Promise.all([
    admin.from('leagues').select('id, name, prize_config').eq('id', leagueId).maybeSingle(),
    admin.from('teams').select('id, team_name, crest_config, user_id').eq('league_id', leagueId),
    admin.from('tournaments').select('id, type, name, status, season, created_at').eq('league_id', leagueId).order('created_at', { ascending: false }),
    opts.events ? Promise.resolve(opts.events) : getBootstrapSlim().then((b) => b.events).catch(() => [] as FplEventSlim[]),
  ]);
  if (!league) return { kind: 'notFound' };
  const clubRows = teams ?? [];
  const mine = clubRows.find((t) => t.user_id === userId) ?? null;
  if (!mine) return { kind: 'redirect', to: '/dashboard' };

  // A league keeps last season's cups; the newest of each type is this season's.
  const seen = new Set<string>();
  const cups: CupRow[] = [];
  for (const c of cupsData ?? []) {
    if (seen.has(c.type)) continue;
    seen.add(c.type);
    cups.push({ id: c.id, type: c.type as TournamentType, name: c.name, status: c.status });
  }

  const cupIds = cups.map((c) => c.id);
  const { data: roundsData } = cupIds.length
    ? await admin.from('tournament_rounds').select('id, tournament_id, name, round_number, start_gameweek, end_gameweek, is_two_leg, drawn_at').in('tournament_id', cupIds)
    : { data: [] as RoundRow[] };
  const rounds = (roundsData ?? []) as RoundRow[];
  const roundIds = rounds.map((r) => r.id);
  const { data: tiesData } = roundIds.length
    ? await admin
      .from('tournament_matchups')
      .select('id, round_id, bracket_position, team_a_id, team_b_id, team_a_score_leg1, team_b_score_leg1, team_a_score_leg2, team_b_score_leg2, winner_id, decided_by, next_matchup_id, status')
      .in('round_id', roundIds)
      .order('bracket_position', { ascending: true })
    : { data: [] as TieRow[] };
  const ties = (tiesData ?? []) as TieRow[];

  const { currentGw, finished } = fplState(events);
  const liveRounds = rounds.filter((r) => currentGw >= r.start_gameweek && currentGw <= r.end_gameweek && !(currentGw === r.end_gameweek && finished));
  const live = liveRounds.length > 0;

  const liveScores: Record<string, number> = {};
  if (live) {
    const { data: rows } = await admin
      .from('matchups')
      .select('team_a_id, team_b_id, score_a, score_b')
      .eq('league_id', leagueId)
      .eq('gameweek', currentGw);
    for (const m of rows ?? []) {
      if (m.team_a_id) liveScores[m.team_a_id] = Number(m.score_a);
      if (m.team_b_id) liveScores[m.team_b_id] = Number(m.score_b);
    }
  }

  const prizeConfig: PrizeConfig = { ...DEFAULT_PRIZE_CONFIG, ...((league.prize_config as PrizeConfig | null) ?? {}) };
  const deadlines = Object.fromEntries(events.map((e) => [e.id, e.deadline_time]));

  const model = buildCupsModel({
    leagueId,
    myTeamId: mine.id,
    myCrest: (mine.crest_config as CrestConfig | null) ?? null,
    clubs: Object.fromEntries(clubRows.map((t) => [t.id, { id: t.id, name: t.team_name, crest: (t.crest_config as CrestConfig | null) ?? null }])),
    clubCount: clubRows.length,
    cups,
    rounds,
    ties,
    deadlines,
    currentGw,
    currentGwFinished: finished,
    liveScores,
    prizes: {
      primary_cup: { winner: prizeConfig.champions_cup_winner, runnerUp: prizeConfig.champions_cup_runner_up },
      secondary_cup: { winner: prizeConfig.league_cup_winner, runnerUp: prizeConfig.league_cup_runner_up },
      consolation_cup: { winner: prizeConfig.consolation_cup_winner, runnerUp: prizeConfig.consolation_cup_runner_up },
    },
    selectedCupId: opts.selectedCupId,
  });
  return { kind: 'ok', leagueName: league.name, model, live };
}
