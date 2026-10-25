import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase, type Tables } from '@/test/supabaseFake';

// Lineups and per-player scoring aren't under test here: every club scores
// its league matchup's score_a, and no club has a best performer, so a level
// tie goes to position.
vi.mock('@/lib/lineups/carryForward', () => ({ getEffectiveLineupForTeam: async () => null }));
vi.mock('@/lib/scoring/matchups', () => ({ loadReferenceStats: async () => ({}) }));
vi.mock('@/lib/notifications/createNotification', () => ({ createNotification: vi.fn(async () => {}) }));

import { executeAdvanceTournament } from '../advanceTournament';

const LEAGUE = 'L';
const SEASON = '2026-27';
const CLUBS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']; // c1 top of the table

/**
 * A stand-in for apply_cup_draw over the fake's tables, with the same entrant
 * check and bye handling, so the advance → draw → advance loop runs end to end.
 */
function applyCupDraw(store: Tables) {
  return ({ p_round_id, p_ties }: { p_round_id: string; p_ties: { position: number; a: string; b: string | null }[] }) => {
    const round = store.tournament_rounds.find((r) => r.id === p_round_id)!;
    if (round.drawn_at) return false;
    const prev = store.tournament_rounds.find((r) => r.tournament_id === round.tournament_id && r.round_number === round.round_number - 1);
    const ties = store.tournament_matchups.filter((m) => m.round_id === p_round_id);
    let entrants: string[];
    if (prev) {
      const prevTies = store.tournament_matchups.filter((m) => m.round_id === prev.id);
      if (prevTies.some((t) => t.status !== 'completed')) return false;
      entrants = prevTies.map((t) => t.winner_id).filter(Boolean);
    } else {
      entrants = ties.flatMap((t) => [t.team_a_id, t.team_b_id]).filter(Boolean);
    }
    const given = p_ties.flatMap((t) => [t.a, t.b]).filter(Boolean) as string[];
    if (given.sort().join() !== [...entrants].sort().join() || p_ties.length !== ties.length) return false;
    for (const t of p_ties) {
      const tie = ties.find((m) => m.bracket_position === t.position)!;
      Object.assign(tie, t.b
        ? { team_a_id: t.a, team_b_id: t.b, status: 'active', winner_id: null }
        : { team_a_id: t.a, team_b_id: null, status: 'completed', winner_id: t.a });
      if (!t.b && tie.next_matchup_id) {
        const next = store.tournament_matchups.find((m) => m.id === tie.next_matchup_id)!;
        next[t.position % 2 === 0 ? 'team_a_id' : 'team_b_id'] = t.a;
        if (next.team_a_id && next.team_b_id) next.status = 'active';
      }
    }
    round.drawn_at = new Date().toISOString();
    return true;
  };
}

const tie = (id: string, round_id: string, pos: number, a: string | null, b: string | null, extra: Record<string, unknown> = {}) => ({
  id, round_id, bracket_position: pos, team_a_id: a, team_b_id: b,
  team_a_score_leg1: 0, team_b_score_leg1: 0, team_a_score_leg2: 0, team_b_score_leg2: 0,
  winner_id: null, decided_by: null, next_matchup_id: null, status: 'pending', ...extra,
});

/** Each club's league score per matchweek: by default the better-placed club scores more. */
function leagueRows(scores: (club: string, gw: number) => number) {
  const rows = [];
  for (let gw = 16; gw <= 38; gw++) {
    for (const c of CLUBS) rows.push({ id: `m-${c}-${gw}`, league_id: LEAGUE, gameweek: gw, team_a_id: c, team_b_id: null, score_a: scores(c, gw), score_b: 0, lineup_a: null, lineup_b: null });
  }
  return rows;
}

/** A 6-club league as created and repaired (migration 184): Champions Cup and Consolation Cup. */
function sixClubLeague(scores: (club: string, gw: number) => number): Tables {
  return {
    leagues: [{ id: LEAGUE, current_season: SEASON }],
    teams: CLUBS.map((id) => ({ id, league_id: LEAGUE, user_id: `u-${id}`, team_name: id.toUpperCase() })),
    league_standings: CLUBS.map((team_id, i) => ({ league_id: LEAGUE, team_id, rank: i + 1 })),
    tournaments: [
      { id: 'cc', league_id: LEAGUE, type: 'primary_cup', name: 'Champions Cup', status: 'active', season: SEASON },
      { id: 'con', league_id: LEAGUE, type: 'consolation_cup', name: 'Consolation Cup', status: 'active', season: SEASON },
    ],
    tournament_rounds: [
      { id: 'cc-qf', tournament_id: 'cc', name: 'Quarter-Final', round_number: 1, start_gameweek: 32, end_gameweek: 33, is_two_leg: true, drawn_at: null },
      { id: 'cc-sf', tournament_id: 'cc', name: 'Semi-Final', round_number: 2, start_gameweek: 34, end_gameweek: 35, is_two_leg: true, drawn_at: null },
      { id: 'cc-f', tournament_id: 'cc', name: 'Final', round_number: 3, start_gameweek: 38, end_gameweek: 38, is_two_leg: false, drawn_at: null },
      { id: 'con-sf', tournament_id: 'con', name: 'Semi-Final', round_number: 1, start_gameweek: 36, end_gameweek: 37, is_two_leg: true, drawn_at: null },
      { id: 'con-f', tournament_id: 'con', name: 'Final', round_number: 2, start_gameweek: 38, end_gameweek: 38, is_two_leg: false, drawn_at: null },
    ],
    tournament_matchups: [
      // Seeds 1 and 2 have byes; 4 v 5 and 3 v 6 play.
      tie('q0', 'cc-qf', 0, 'c1', null, { status: 'completed', winner_id: 'c1', next_matchup_id: 's0' }),
      tie('q1', 'cc-qf', 1, 'c4', 'c5', { status: 'active', next_matchup_id: 's0' }),
      tie('q2', 'cc-qf', 2, 'c2', null, { status: 'completed', winner_id: 'c2', next_matchup_id: 's1' }),
      tie('q3', 'cc-qf', 3, 'c3', 'c6', { status: 'active', next_matchup_id: 's1' }),
      tie('s0', 'cc-sf', 0, 'c1', null, { next_matchup_id: 'f0' }),
      tie('s1', 'cc-sf', 1, 'c2', null, { next_matchup_id: 'f0' }),
      tie('f0', 'cc-f', 0, null, null),
      tie('k0', 'con-sf', 0, null, null, { next_matchup_id: 'kf' }),
      tie('k1', 'con-sf', 1, null, null, { next_matchup_id: 'kf' }),
      tie('kf', 'con-f', 0, null, null),
    ],
    matchups: leagueRows(scores),
    season_cup_winners_archive: [],
    transactions: [],
  };
}

const byRank = (club: string) => 100 - CLUBS.indexOf(club) * 10;
const ties = (store: Tables, round: string) =>
  store.tournament_matchups.filter((m) => m.round_id === round).sort((a, b) => a.bracket_position - b.bracket_position);

/** Every resolve the gameweek cron would run, as the matchup processor does: each active cup, in turn. */
async function resolve(admin: any, store: Tables, gw: number) {
  // The resolve_stalled cron activates a round's ties once its first matchweek starts.
  const started = new Set(store.tournament_rounds.filter((r) => r.start_gameweek <= gw).map((r) => r.id));
  for (const m of store.tournament_matchups) {
    if (started.has(m.round_id) && m.status === 'pending' && m.team_a_id && m.team_b_id) m.status = 'active';
  }
  for (const t of store.tournaments.filter((x) => x.status === 'active')) {
    await executeAdvanceTournament(t.id, gw, admin);
  }
}

describe('a 6-club league through the Champions and Consolation Cups', () => {
  let store: Tables;
  let admin: any;
  beforeEach(() => {
    store = sixClubLeague(byRank);
    admin = createFakeSupabase(store, { rpc: { apply_cup_draw: (args) => applyCupDraw(store)(args as any) } });
  });

  it('drops both quarter-final losers into the Consolation Cup without starting it', async () => {
    await resolve(admin, store, 32);
    await resolve(admin, store, 33);
    expect(ties(store, 'cc-qf').map((t) => t.winner_id)).toEqual(['c1', 'c4', 'c2', 'c3']);
    const placed = ties(store, 'con-sf').flatMap((t) => [t.team_a_id, t.team_b_id]).filter(Boolean);
    expect(placed.sort()).toEqual(['c5', 'c6']);
    expect(ties(store, 'con-sf').every((t) => t.status === 'pending')).toBe(true);
    expect(store.tournament_rounds.find((r) => r.id === 'con-sf')!.drawn_at).toBeNull();
  });

  it('draws the Consolation Cup once the semi-final losers are in, and plays it to a winner', async () => {
    for (let gw = 32; gw <= 35; gw++) await resolve(admin, store, gw);

    const drawn = ties(store, 'con-sf');
    expect(store.tournament_rounds.find((r) => r.id === 'con-sf')!.drawn_at).not.toBeNull();
    expect(drawn.flatMap((t) => [t.team_a_id, t.team_b_id]).sort()).toEqual(['c3', 'c4', 'c5', 'c6']);
    expect(drawn.every((t) => t.status === 'active')).toBe(true);

    for (let gw = 36; gw <= 38; gw++) await resolve(admin, store, gw);
    const final = ties(store, 'con-f')[0];
    expect(final.status).toBe('completed');
    expect(final.winner_id).toBe('c3'); // the best of the four on these scores
    expect(store.tournaments.find((t) => t.id === 'con')!.status).toBe('completed');
    expect(store.tournaments.find((t) => t.id === 'cc')!.status).toBe('completed');
    expect(ties(store, 'cc-f')[0].winner_id).toBe('c1');
  });

  it('records a dead-level tie as decided on position', async () => {
    store = sixClubLeague(() => 0);
    admin = createFakeSupabase(store, { rpc: { apply_cup_draw: (args) => applyCupDraw(store)(args as any) } });
    await resolve(admin, store, 32);
    await resolve(admin, store, 33);
    const q1 = ties(store, 'cc-qf')[1];
    expect(q1).toMatchObject({ winner_id: 'c4', decided_by: 'position' });
  });
});

describe('the League Cup', () => {
  it('draws its next round once, when the last tie of the round finishes', async () => {
    const store: Tables = {
      leagues: [{ id: LEAGUE, current_season: SEASON }],
      teams: CLUBS.map((id) => ({ id, league_id: LEAGUE, user_id: `u-${id}`, team_name: id.toUpperCase() })),
      league_standings: CLUBS.map((team_id, i) => ({ league_id: LEAGUE, team_id, rank: i + 1 })),
      tournaments: [{ id: 'lc', league_id: LEAGUE, type: 'secondary_cup', name: 'League Cup', status: 'active', season: SEASON }],
      tournament_rounds: [
        { id: 'lc-qf', tournament_id: 'lc', name: 'Quarter-Final', round_number: 1, start_gameweek: 16, end_gameweek: 16, is_two_leg: false, drawn_at: null },
        { id: 'lc-sf', tournament_id: 'lc', name: 'Semi-Final', round_number: 2, start_gameweek: 21, end_gameweek: 24, is_two_leg: true, drawn_at: null },
        { id: 'lc-f', tournament_id: 'lc', name: 'Final', round_number: 3, start_gameweek: 31, end_gameweek: 31, is_two_leg: false, drawn_at: null },
      ],
      tournament_matchups: [
        tie('q0', 'lc-qf', 0, 'c1', null, { status: 'completed', winner_id: 'c1' }),
        tie('q1', 'lc-qf', 1, 'c4', 'c5', { status: 'active' }),
        tie('q2', 'lc-qf', 2, 'c2', null, { status: 'completed', winner_id: 'c2' }),
        tie('q3', 'lc-qf', 3, 'c3', 'c6', { status: 'active' }),
        tie('s0', 'lc-sf', 0, null, null),
        tie('s1', 'lc-sf', 1, null, null),
        tie('f0', 'lc-f', 0, null, null),
      ],
      matchups: leagueRows(byRank),
      season_cup_winners_archive: [],
      transactions: [],
    };
    const rpc = vi.fn((args) => applyCupDraw(store)(args as any));
    const admin = createFakeSupabase(store, { rpc: { apply_cup_draw: rpc } });

    await executeAdvanceTournament('lc', 16, admin as any);
    await executeAdvanceTournament('lc', 16, admin as any); // a second resolve path, same matchweek
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.results.map((r) => r.value)).toEqual([true, false]);
    const sf = ties(store, 'lc-sf');
    expect(sf.flatMap((t) => [t.team_a_id, t.team_b_id]).sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
    // Cup Won! only for the final: a quarter-final winner is "through".
    const { createNotification } = await import('@/lib/notifications/createNotification');
    const titles = (createNotification as any).mock.calls.map((c: any[]) => c[1].title);
    expect(titles).not.toContain('Cup Won!');
  });
});
