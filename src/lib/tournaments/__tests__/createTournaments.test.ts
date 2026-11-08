import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '@/test/supabaseFake';

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('@/lib/notifications/createNotification', () => ({ createNotification: notify }));

import { announceFirstRound, createTournament } from '../createTournaments';

const LEAGUE = 'league-1';
const names = ['Stamford & Sons', 'Moises FC', "Pizzaking's Club", 'yang fc', "United 08' Vol.2", 'Sesko Fender'];
const teams = names.map((team_name, i) => ({ id: `t${i + 1}`, league_id: LEAGUE, team_name, user_id: `u${i + 1}`, total_points: 0 }));

// The table after GW7 is t1..t6 in order (Stamford, Moises, Pizzaking, yang,
// United, Sesko). A live GW8 result that would put Sesko top is in the data to
// prove provisional scores are ignored.
const m = (gameweek: number, status: string, a: string, b: string, score_a: number, score_b: number) => ({
  league_id: LEAGUE, gameweek, status, team_a_id: a, team_b_id: b, score_a, score_b,
});
function seed(opts: { finishedGw7?: boolean } = {}) {
  const gw7 = opts.finishedGw7 === false ? 'live' : 'completed';
  return {
    leagues: [{ id: LEAGUE, previous_season: '2025-26' }],
    teams,
    season_standings_archive: [],
    matchups: [
      m(7, gw7, 't1', 't6', 160, 100),
      m(7, gw7, 't2', 't5', 140, 100),
      m(7, gw7, 't3', 't4', 120, 100),
      m(8, 'live', 't6', 't1', 700, 100),
    ],
    tournaments: [],
    tournament_rounds: [],
    tournament_matchups: [],
  };
}

beforeEach(() => notify.mockReset());

describe('createTournament seeding', () => {
  it('makes no bracket until GW7 is finished, even though previous_season is set', async () => {
    const admin = createFakeSupabase(seed({ finishedGw7: false }));
    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res.skipped).toBe(true);
    expect(admin.__writes.filter((w) => w.op === 'insert')).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('seeds from the finished GW7 table, ignoring live scores: the top two get the byes, and each manager is told', async () => {
    const admin = createFakeSupabase(seed());
    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res).toMatchObject({ ok: true, bracket_size: 8, byes: 2 });

    const contents = notify.mock.calls.map(([, n]) => `${n.userId}: ${n.content}`);
    expect(contents).toHaveLength(6);
    expect(contents.find((c) => c.startsWith('u1:'))).toMatch(/bye to the semi-final/);
    expect(contents.find((c) => c.startsWith('u2:'))).toMatch(/bye to the semi-final/);
    expect(contents.find((c) => c.startsWith('u3:'))).toMatch(/you play \*\*Sesko Fender\*\*/);
    expect(notify.mock.calls[0][1]).toMatchObject({ kind: 'matchdays', title: 'Champions Cup Draw' });
  });

  it('marks a corrected bracket as a redraw', async () => {
    const admin = createFakeSupabase(seed());
    await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27', { corrected: true });
    const [, first] = notify.mock.calls[0];
    expect(first.title).toBe('Champions Cup Redraw');
    expect(first.content).toMatch(/redraw/);
  });

  it('sends nothing when silent, and announceFirstRound sends the notices later', async () => {
    const admin = createFakeSupabase(seed());
    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27', { corrected: true, silent: true });
    expect(notify).not.toHaveBeenCalled();

    await announceFirstRound(admin as any, res.tournament_id!, { corrected: true });
    expect(notify).toHaveBeenCalledTimes(6);
  });
});
