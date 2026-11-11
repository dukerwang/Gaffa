import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '@/test/supabaseFake';

const notify = vi.fn() as any;

import { drawDueCups, drawDueCupsForLeague } from '../drawDueCups';

const LEAGUE = 'league-1';
const SEASON = '2026-27';
const teams = ['A', 'B', 'C', 'D', 'E', 'F'].map((team_name, i) => ({
  id: `t${i + 1}`, league_id: LEAGUE, team_name, user_id: `u${i + 1}`, total_points: 0,
}));

// Three ties per gameweek, completed through `through`, t1 > t2 > ... on the table.
function leagueFinished(through: number, extra: Record<string, unknown[]> = {}) {
  const matchups = [];
  for (let gw = 1; gw <= through; gw++) {
    for (const [a, b, sa, sb] of [['t1', 't6', 160, 100], ['t2', 't5', 140, 100], ['t3', 't4', 120, 100]] as const) {
      matchups.push({ league_id: LEAGUE, gameweek: gw, status: 'completed', team_a_id: a, team_b_id: b, score_a: sa, score_b: sb });
    }
  }
  return {
    leagues: [{ id: LEAGUE, status: 'active', current_season: SEASON, previous_season: '2025-26' }],
    teams,
    season_standings_archive: [],
    matchups,
    tournaments: [],
    tournament_rounds: [],
    tournament_matchups: [],
    ...extra,
  };
}

const typesOf = (admin: ReturnType<typeof createFakeSupabase>) =>
  admin.__writes.filter((w) => w.op === 'insert' && w.table === 'tournaments').flatMap((w) => [w.rows].flat().map((r: any) => r.type));

beforeEach(() => notify.mockReset());

describe('drawDueCups', () => {
  it('draws nothing at kickoff', async () => {
    const admin = createFakeSupabase(leagueFinished(0));
    expect(await drawDueCups(admin as any, notify)).toEqual([]);
    expect(typesOf(admin)).toEqual([]);
  });

  it('draws only the League Cup once MW15 is finished', async () => {
    const admin = createFakeSupabase(leagueFinished(15));
    const drawn = await drawDueCups(admin as any, notify);
    expect(drawn.map((d) => d.type)).toEqual(['secondary_cup']);
  });

  it('draws the Champions Cup and the Consolation Cup together once MW31 is finished', async () => {
    const admin = createFakeSupabase(leagueFinished(31));
    const drawn = await drawDueCupsForLeague(admin as any, LEAGUE, SEASON, notify);
    expect(drawn.map((d) => d.type).sort()).toEqual(['consolation_cup', 'primary_cup', 'secondary_cup']);
  });

  it('draws a cup once: a second run makes nothing and tells nobody again', async () => {
    const admin = createFakeSupabase(leagueFinished(15));
    await drawDueCups(admin as any, notify);
    const told = notify.mock.calls.length;
    expect(told).toBe(6);

    expect(await drawDueCups(admin as any, notify)).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(told);
  });

  it('skips a league that is not active', async () => {
    const admin = createFakeSupabase(leagueFinished(31, { leagues: [{ id: LEAGUE, status: 'offseason', current_season: SEASON }] }));
    expect(await drawDueCups(admin as any, notify)).toEqual([]);
  });
});
