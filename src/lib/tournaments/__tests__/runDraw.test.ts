import { describe, it, expect, vi } from 'vitest';
import { createFakeSupabase } from '@/test/supabaseFake';
import { runDraw, type DrawRound } from '../runDraw';

const LEAGUE = 'league-1';
const CUP = { id: 'cup-lc', league_id: LEAGUE, name: 'League Cup' };
const QF = 'round-qf';
const SF: DrawRound = { id: 'round-sf', tournament_id: CUP.id, name: 'Semi-Final', round_number: 2, start_gameweek: 21, end_gameweek: 24, is_two_leg: true };

// Matchday Militia's League Cup as drawn: ChelsZ and Hayden with byes.
function militia(qfStatus: 'completed' | 'pending' = 'completed') {
  return {
    tournament_rounds: [
      { id: QF, tournament_id: CUP.id, round_number: 1, name: 'Quarter-Final' },
      { id: SF.id, tournament_id: CUP.id, round_number: 2, name: 'Semi-Final' },
    ],
    tournament_matchups: [
      { id: 'q0', round_id: QF, bracket_position: 0, team_a_id: 'chelsz', team_b_id: null, status: 'completed', winner_id: 'chelsz' },
      { id: 'q1', round_id: QF, bracket_position: 1, team_a_id: 'pizza', team_b_id: 'tea', status: qfStatus, winner_id: qfStatus === 'completed' ? 'pizza' : null },
      { id: 'q2', round_id: QF, bracket_position: 2, team_a_id: 'hayden', team_b_id: null, status: 'completed', winner_id: 'hayden' },
      { id: 'q3', round_id: QF, bracket_position: 3, team_a_id: 'xabi', team_b_id: 'spurs', status: 'completed', winner_id: 'xabi' },
      { id: 's0', round_id: SF.id, bracket_position: 0, team_a_id: null, team_b_id: null, status: 'pending', winner_id: null },
      { id: 's1', round_id: SF.id, bracket_position: 1, team_a_id: null, team_b_id: null, status: 'pending', winner_id: null },
    ],
    league_standings: [
      { league_id: LEAGUE, team_id: 'chelsz', rank: 1 },
      { league_id: LEAGUE, team_id: 'pizza', rank: 2 },
      { league_id: LEAGUE, team_id: 'spurs', rank: 3 },
      { league_id: LEAGUE, team_id: 'xabi', rank: 4 },
      { league_id: LEAGUE, team_id: 'hayden', rank: 5 },
      { league_id: LEAGUE, team_id: 'tea', rank: 6 },
    ],
    teams: [
      { id: 'chelsz', user_id: 'u-chelsz', team_name: 'ChelsZ FC' },
      { id: 'pizza', user_id: 'u-pizza', team_name: "Pizzaking's Club" },
      { id: 'hayden', user_id: null, team_name: 'Hayden FC' },
      { id: 'xabi', user_id: 'u-xabi', team_name: 'Not Too Xabi' },
    ],
  };
}

describe('runDraw', () => {
  it('waits while a tie in the round before is unfinished', async () => {
    const applyCupDraw = vi.fn();
    const admin = createFakeSupabase(militia('pending'), { rpc: { apply_cup_draw: applyCupDraw } });
    const res = await runDraw(admin as any, { tournament: CUP, round: SF, notify: vi.fn() });
    expect(res.applied).toBe(false);
    expect(applyCupDraw).not.toHaveBeenCalled();
  });

  it('draws exactly the clubs through, byes included, the higher-placed first', async () => {
    const applyCupDraw = vi.fn().mockReturnValue(true);
    const admin = createFakeSupabase(militia(), { rpc: { apply_cup_draw: applyCupDraw } });
    await runDraw(admin as any, { tournament: CUP, round: SF, notify: vi.fn() });

    const { p_round_id, p_ties } = applyCupDraw.mock.calls[0][0];
    expect(p_round_id).toBe(SF.id);
    expect(p_ties.map((t: any) => t.position)).toEqual([0, 1]);
    expect(p_ties.flatMap((t: any) => [t.a, t.b]).sort()).toEqual(['chelsz', 'hayden', 'pizza', 'xabi']);
    const rank: Record<string, number> = { chelsz: 1, pizza: 2, xabi: 4, hayden: 5 };
    for (const t of p_ties) expect(rank[t.a]).toBeLessThan(rank[t.b]);
  });

  it('tells each manager their opponent and skips a Caretaker club', async () => {
    const notify = vi.fn();
    const admin = createFakeSupabase(militia(), { rpc: { apply_cup_draw: () => true } });
    const res = await runDraw(admin as any, { tournament: CUP, round: SF, notify, random: () => 0 });
    expect(res.applied).toBe(true);
    expect(notify).toHaveBeenCalledTimes(4);
    const calls = notify.mock.calls.map((c) => c[1]);
    // Hayden FC has no manager; createNotification itself skips a null userId.
    expect(calls.filter((c) => c.userId === null)).toHaveLength(1);
    for (const c of calls) {
      expect(c.title).toBe('League Cup Draw');
      expect(c.content).toMatch(/^\*\*League Cup\*\* semi-final draw: you play \*\*.+\*\* over MW21 and MW24\.$/);
    }
  });

  it('sends nothing when the round was already drawn', async () => {
    const notify = vi.fn();
    const admin = createFakeSupabase(militia(), { rpc: { apply_cup_draw: () => false } });
    const res = await runDraw(admin as any, { tournament: CUP, round: SF, notify });
    expect(res.applied).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it('draws a Consolation first round from the clubs already placed, with a bye', async () => {
    const notify = vi.fn();
    const applyCupDraw = vi.fn().mockReturnValue(true);
    const cons = { id: 'cup-cc', league_id: LEAGUE, name: 'Consolation Cup' };
    const round: DrawRound = { id: 'round-csf', tournament_id: cons.id, name: 'Semi-Final', round_number: 1, start_gameweek: 36, end_gameweek: 37, is_two_leg: true };
    const admin = createFakeSupabase(
      {
        ...militia(),
        tournament_rounds: [{ id: round.id, tournament_id: cons.id, round_number: 1, name: 'Semi-Final' }],
        tournament_matchups: [
          { id: 'c0', round_id: round.id, bracket_position: 0, team_a_id: 'tea', team_b_id: 'pizza', status: 'pending', winner_id: null },
          { id: 'c1', round_id: round.id, bracket_position: 1, team_a_id: 'xabi', team_b_id: null, status: 'pending', winner_id: null },
        ],
      },
      { rpc: { apply_cup_draw: applyCupDraw } },
    );
    await runDraw(admin as any, { tournament: cons, round, notify });
    const { p_ties } = applyCupDraw.mock.calls[0][0];
    expect(p_ties.find((t: any) => t.b === null).a).toBe('pizza');
    const bye = notify.mock.calls.map((c) => c[1]).find((c) => c.userId === 'u-pizza');
    expect(bye.content).toBe('**Consolation Cup** semi-final draw: you have a bye to the final.');
  });
});
