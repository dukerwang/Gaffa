import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '@/test/supabaseFake';

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('@/lib/notifications/createNotification', () => ({ createNotification: notify }));

import { createTournament } from '../createTournaments';

const LEAGUE = 'league-1';
const names = ['Stamford & Sons', 'Moises FC', "Pizzaking's Club", 'yang fc', "United 08' Vol.2", 'Sesko Fender'];
const teams = names.map((team_name, i) => ({ id: `t${i + 1}`, league_id: LEAGUE, team_name, user_id: `u${i + 1}`, total_points: 0 }));

const m = (gameweek: number, status: string, a: string, b: string, score_a: number, score_b: number) => ({
  league_id: LEAGUE, gameweek, status, team_a_id: a, team_b_id: b, score_a, score_b,
});

/**
 * A six-club league whose table after `gw` is t1..t6 in order (Stamford,
 * Moises, Pizzaking, yang, United, Sesko). The gameweek after it holds a live
 * result that would put Sesko top, to prove provisional scores are ignored.
 */
function leagueAt(gw: number, opts: { lastStatus?: string } = {}) {
  return {
    leagues: [{ id: LEAGUE, previous_season: '2025-26' }],
    teams,
    season_standings_archive: [],
    matchups: [
      m(gw, opts.lastStatus ?? 'completed', 't1', 't6', 160, 100),
      m(gw, opts.lastStatus ?? 'completed', 't2', 't5', 140, 100),
      m(gw, opts.lastStatus ?? 'completed', 't3', 't4', 120, 100),
      m(gw + 1, 'live', 't6', 't1', 700, 100),
    ],
    tournaments: [],
    tournament_rounds: [],
    tournament_matchups: [],
  };
}

beforeEach(() => notify.mockReset());

describe('createTournament: when a cup is drawn', () => {
  it('makes nothing before the gameweek ahead of its first round is finished', async () => {
    const admin = createFakeSupabase(leagueAt(30));
    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res.skipped).toBe(true);
    expect(res.error).toMatch(/MW31/);
    expect(admin.__writes.filter((w) => w.op === 'insert')).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('waits while the draw gameweek is still being scored', async () => {
    const admin = createFakeSupabase(leagueAt(31, { lastStatus: 'live' }));
    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res.skipped).toBe(true);
    expect(admin.__writes.filter((w) => w.op === 'insert')).toEqual([]);
  });

  it('draws the League Cup after MW15, not MW14', async () => {
    const early = createFakeSupabase(leagueAt(14));
    expect((await createTournament(early as any, LEAGUE, 'secondary_cup', 1, '2026-27')).skipped).toBe(true);

    const due = createFakeSupabase(leagueAt(15));
    expect(await createTournament(due as any, LEAGUE, 'secondary_cup', 1, '2026-27')).toMatchObject({ ok: true, byes: 2 });
  });
});

describe('createTournament: seeding and notices', () => {
  it('seeds from the finished table ignoring live scores: the top two get the byes, and each manager is told', async () => {
    const admin = createFakeSupabase(leagueAt(31));
    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res).toMatchObject({ ok: true, bracket_size: 8, byes: 2 });

    const contents = notify.mock.calls.map(([, n]) => `${n.userId}: ${n.content}`);
    expect(contents).toHaveLength(6);
    expect(contents.find((c) => c.startsWith('u1:'))).toMatch(/bye to the semi-final/);
    expect(contents.find((c) => c.startsWith('u2:'))).toMatch(/bye to the semi-final/);
    expect(contents.find((c) => c.startsWith('u3:'))).toMatch(/you play \*\*Sesko Fender\*\*/);
    expect(notify.mock.calls[0][1]).toMatchObject({ kind: 'matchdays', title: 'Champions Cup Draw' });
  });

  it('does nothing the second time', async () => {
    const admin = createFakeSupabase(leagueAt(31));
    await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    notify.mockReset();
    const again = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(again.skipped).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('createTournament: failure', () => {
  it('removes a half-built cup so it cannot pass for a drawn one', async () => {
    const admin = createFakeSupabase(leagueAt(31));
    const real = admin.from.bind(admin);
    (admin as any).from = (table: string) =>
      table === 'tournament_matchups'
        ? { insert: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'boom' } }) }) }) }
        : real(table);

    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res).toMatchObject({ ok: false });
    expect(res.error).toMatch(/boom/);
    const { data } = await real('tournaments').select('id');
    expect(data).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('skips quietly when another caller drew the cup first', async () => {
    const admin = createFakeSupabase(leagueAt(31));
    const real = admin.from.bind(admin);
    (admin as any).from = (table: string) =>
      table === 'tournaments'
        ? {
            ...real(table),
            select: real(table).select.bind(real(table)),
            insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: '23505', message: 'duplicate key' } }) }) }),
          }
        : real(table);

    const res = await createTournament(admin as any, LEAGUE, 'primary_cup', 1, '2026-27');
    expect(res).toMatchObject({ ok: true, skipped: true });
    expect(notify).not.toHaveBeenCalled();
  });
});
