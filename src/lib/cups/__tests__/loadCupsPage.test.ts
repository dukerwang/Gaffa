import { describe, it, expect } from 'vitest';
import { createFakeSupabase, type Tables } from '@/test/supabaseFake';
import { fplState, loadCupsPage } from '../loadCupsPage';

const events = [
  { id: 8, deadline_time: '2026-10-23T17:30:00Z', is_current: true, finished: false },
  { id: 16, deadline_time: '2026-12-19T11:00:00Z' },
];

function tables(): Tables {
  const tie = (id: string, round_id: string, pos: number, a: string | null, b: string | null, extra = {}) => ({
    id, round_id, bracket_position: pos, team_a_id: a, team_b_id: b,
    team_a_score_leg1: 0, team_b_score_leg1: 0, team_a_score_leg2: 0, team_b_score_leg2: 0,
    winner_id: null, decided_by: null, next_matchup_id: null, status: 'pending', ...extra,
  });
  return {
    leagues: [{ id: 'L', name: 'Matchday Militia', prize_config: { league_cup_winner: 30 } }],
    teams: [
      { id: 'xabi', league_id: 'L', team_name: 'Not Too Xabi', crest_config: { primaryColor: '#4338CA', secondaryColor: '#FBBF24' }, user_id: 'u1' },
      { id: 'spurs', league_id: 'L', team_name: 'tottenyang FC', crest_config: null, user_id: null },
      { id: 'chelsz', league_id: 'L', team_name: 'ChelsZ FC', crest_config: null, user_id: 'u3' },
    ],
    tournaments: [
      { id: 'lc-old', league_id: 'L', type: 'secondary_cup', name: 'League Cup', status: 'completed', season: '2025-26', created_at: '2025-08-01' },
      { id: 'lc', league_id: 'L', type: 'secondary_cup', name: 'League Cup', status: 'active', season: '2026-27', created_at: '2026-08-05' },
    ],
    tournament_rounds: [
      { id: 'qf', tournament_id: 'lc', name: 'Quarter-Final', round_number: 1, start_gameweek: 16, end_gameweek: 16, is_two_leg: false, drawn_at: null },
      { id: 'old', tournament_id: 'lc-old', name: 'Final', round_number: 1, start_gameweek: 31, end_gameweek: 31, is_two_leg: false, drawn_at: null },
    ],
    tournament_matchups: [
      tie('t0', 'qf', 0, 'chelsz', null, { status: 'completed', winner_id: 'chelsz' }),
      tie('t1', 'qf', 1, 'xabi', 'spurs'),
    ],
  };
}

describe('loadCupsPage', () => {
  it('sends a viewer without a club in the league to the dashboard', async () => {
    const admin = createFakeSupabase(tables());
    expect(await loadCupsPage(admin as any, { leagueId: 'L', userId: 'stranger', selectedCupId: null, events })).toEqual({ kind: 'redirect', to: '/dashboard' });
  });

  it('is not found for an unknown league', async () => {
    const admin = createFakeSupabase(tables());
    expect((await loadCupsPage(admin as any, { leagueId: 'nope', userId: 'u1', selectedCupId: null, events })).kind).toBe('notFound');
  });

  it('builds this season’s cups for the viewer, ignoring last season’s', async () => {
    const admin = createFakeSupabase(tables());
    const res = await loadCupsPage(admin as any, { leagueId: 'L', userId: 'u1', selectedCupId: null, events });
    if (res.kind !== 'ok') throw new Error(res.kind);
    expect(res.live).toBe(false);
    expect(res.model.selected?.id).toBe('lc');
    expect(res.model.shelf[1].status).toBe('QF · MW16');
    expect(res.model.rounds[0].when).toBe('Sat 19 Dec');
    expect(res.model.rounds[0].prize).toEqual({ winner: 30, runnerUp: 10 });
    expect(res.model.club).toEqual({ primary: '#4338CA', secondary: '#FBBF24' });
  });

  it('reads live scores from the league matchups while a cup matchweek is live', async () => {
    const t = tables();
    t.matchups = [
      { league_id: 'L', gameweek: 16, team_a_id: 'xabi', team_b_id: 'chelsz', score_a: 33.1, score_b: 12 },
      { league_id: 'L', gameweek: 16, team_a_id: 'spurs', team_b_id: null, score_a: 20.5, score_b: 0 },
    ];
    const admin = createFakeSupabase(t);
    const live = [{ id: 16, deadline_time: '2026-12-19T11:00:00Z', is_current: true, finished: false }];
    const res = await loadCupsPage(admin as any, { leagueId: 'L', userId: 'u1', selectedCupId: null, events: live });
    if (res.kind !== 'ok') throw new Error(res.kind);
    expect(res.live).toBe(true);
    const mine = res.model.rounds[0].ties.find((x) => x.mine)!;
    expect([mine.a.score, mine.b.score]).toEqual([33.1, 20.5]);
  });
});

describe('fplState', () => {
  it('falls back to the latest passed deadline', () => {
    expect(fplState([{ id: 7, deadline_time: '2026-10-01T00:00:00Z', finished: true }, { id: 8, deadline_time: '2099-01-01T00:00:00Z' }])).toEqual({ currentGw: 7, finished: true });
  });
});
