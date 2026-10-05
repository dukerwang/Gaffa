/**
 * The leave route: a member leaving, or the commissioner deleting the league.
 *
 * Both are hard deletes that cascade through every table keyed on the league
 * or the team, so once the draft starts they would erase published results.
 * Only a league still in `setup` may be left or deleted. The fake does not
 * cascade, so these tests assert on the deletes the handler issued.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, createFakeServerClient, type FakeClient, type Tables } from '@/test/supabaseFake';
import { LEAGUE_ID, MY_TEAM_ID, OTHER_USER_ID, USER_ID, leagueFixture } from '@/test/leagueFixture';
import { DELETE_BLOCKED_MESSAGE, LEAVE_BLOCKED_MESSAGE } from '@/lib/leagues/leaveGuard';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  admin: null as any,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => createFakeServerClient(state.user),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => state.admin,
}));

import { POST } from '../route';

let admin: FakeClient;

function setup(status: string, commissionerId = OTHER_USER_ID): Tables {
  const tables = leagueFixture();
  Object.assign(tables.leagues[0], { status, commissioner_id: commissionerId });
  tables.league_members = [
    { league_id: LEAGUE_ID, user_id: USER_ID },
    { league_id: LEAGUE_ID, user_id: OTHER_USER_ID },
  ];
  admin = createFakeSupabase(tables, {});
  state.admin = admin;
  return tables;
}

async function leave() {
  const res = await POST({} as any, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
  return { status: res.status, body: await res.json() };
}

const deletes = () => admin.__writes.filter((w) => w.op === 'delete');

beforeEach(() => {
  state.user = { id: USER_ID };
});

describe('member leaving', () => {
  it('removes the team and membership while the league is in setup', async () => {
    const tables = setup('setup');
    const res = await leave();
    expect(res).toEqual({ status: 200, body: { success: true, action: 'left' } });
    expect(tables.teams.find((t) => t.id === MY_TEAM_ID)).toBeUndefined();
    expect(tables.league_members.map((m) => m.user_id)).toEqual([OTHER_USER_ID]);
  });

  it.each(['drafting', 'active', 'offseason', 'pre_draft', 'completed'])(
    'refuses in a %s league and deletes nothing',
    async (status) => {
      const tables = setup(status);
      const res = await leave();
      expect(res).toEqual({ status: 409, body: { error: LEAVE_BLOCKED_MESSAGE } });
      expect(deletes()).toEqual([]);
      expect(tables.teams.find((t) => t.id === MY_TEAM_ID)).toBeDefined();
    },
  );
});

describe('commissioner deleting the league', () => {
  it('deletes the league while it is in setup', async () => {
    const tables = setup('setup', USER_ID);
    const res = await leave();
    expect(res).toEqual({ status: 200, body: { success: true, action: 'deleted' } });
    expect(tables.leagues).toEqual([]);
  });

  it.each(['drafting', 'active', 'offseason', 'pre_draft', 'completed'])(
    'refuses in a %s league and deletes nothing',
    async (status) => {
      const tables = setup(status, USER_ID);
      const res = await leave();
      expect(res).toEqual({ status: 409, body: { error: DELETE_BLOCKED_MESSAGE } });
      expect(deletes()).toEqual([]);
      expect(tables.leagues).toHaveLength(1);
    },
  );

  it('refuses when the draft starts between the status read and the delete', async () => {
    const tables = setup('setup', USER_ID);
    const league = tables.leagues[0];
    // Flip the status as soon as the handler has read it, standing in for a
    // draft that starts mid-request.
    const from = admin.from.bind(admin);
    let reads = 0;
    (admin as any).from = (table: string) => {
      if (table === 'leagues' && reads++ === 1) league.status = 'drafting';
      return from(table);
    };
    const res = await leave();
    expect(res).toEqual({ status: 409, body: { error: DELETE_BLOCKED_MESSAGE } });
    expect(tables.leagues).toHaveLength(1);
  });
});

it('requires a signed-in user', async () => {
  setup('setup');
  state.user = null;
  const res = await leave();
  expect(res.status).toBe(401);
  expect(deletes()).toEqual([]);
});
