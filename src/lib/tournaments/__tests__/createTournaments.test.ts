import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '@/test/supabaseFake';

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('@/lib/notifications/createNotification', () => ({ createNotification: notify }));

import { createTournament } from '../createTournaments';

const LEAGUE = 'league-1';
const names = ['Stamford & Sons', 'Moises FC', "Pizzaking's Club", 'yang fc', "United 08' Vol.2", 'Sesko Fender'];
const teams = names.map((team_name, i) => ({ id: `t${i + 1}`, league_id: LEAGUE, team_name, user_id: `u${i + 1}`, total_points: 0 }));

// Stamford, Moises, Pizzaking, yang, United, Sesko in table order.
function seed(played: number) {
  return {
    leagues: [{ id: LEAGUE, previous_season: '2025-26' }],
    teams,
    season_standings_archive: [],
    league_standings: teams.map((t, i) => ({ league_id: LEAGUE, team_id: t.id, rank: i + 1, played })),
    tournaments: [],
    tournament_rounds: [],
    tournament_matchups: [],
  };
}

beforeEach(() => notify.mockReset());

describe('createTournament seeding', () => {
  it('makes no bracket while nobody has played, even though previous_season is set', async () => {
    const admin = createFakeSupabase(seed(0));
    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res.skipped).toBe(true);
    expect(admin.__writes.filter((w) => w.op === 'insert')).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('seeds from the table: the top two get the byes, and each manager is told', async () => {
    const admin = createFakeSupabase(seed(10));
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
    const admin = createFakeSupabase(seed(10));
    await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27', { corrected: true });
    const [, first] = notify.mock.calls[0];
    expect(first.title).toBe('Champions Cup Redraw');
    expect(first.content).toMatch(/redraw/);
    expect(first.content).toMatch(/seeded from the table/);
  });
});
