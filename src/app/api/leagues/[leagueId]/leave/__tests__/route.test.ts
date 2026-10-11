/**
 * The leave route.
 *
 * Before the draft (`setup`), leaving deletes the member's club and a
 * commissioner leaving deletes the league: nothing has been played.
 *
 * After it, both deletes would cascade through published results, so a member
 * who leaves hands the club to the Caretaker (hand_club_to_caretaker_rpc) and a
 * commissioner is refused until they hand the role on. The fake does not
 * cascade, so these tests assert on the deletes and RPCs the handler issued.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, createFakeServerClient, type FakeClient, type Tables } from '@/test/supabaseFake';
import { LEAGUE_ID, MY_TEAM_ID, OTHER_USER_ID, USER_ID, leagueFixture } from '@/test/leagueFixture';
import { COMMISSIONER_LEAVE_BLOCKED_MESSAGE, DELETE_BLOCKED_MESSAGE } from '@/lib/leagues/leaveGuard';

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
  admin = createFakeSupabase(tables, {
    rpc: {
      // Stands in for migration 169: the club stays, its manager goes.
      hand_club_to_caretaker_rpc: ({ p_team_id }) => {
        const team = tables.teams.find((t) => t.id === p_team_id)!;
        const former = team.user_id;
        team.user_id = null;
        team.caretaker_since = '2026-10-07T00:00:00Z';
        tables.league_members = tables.league_members.filter((m) => m.user_id !== former);
        return { already_caretaker: false, former_user_id: former };
      },
    },
  });
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
    'hands the club to the Caretaker in a %s league and deletes nothing',
    async (status) => {
      const tables = setup(status);
      const res = await leave();
      expect(res).toEqual({ status: 200, body: { success: true, action: 'handed_to_caretaker' } });
      expect(deletes()).toEqual([]);
      const club = tables.teams.find((t) => t.id === MY_TEAM_ID);
      expect(club).toBeDefined();
      expect(club!.user_id).toBeNull();
      expect(admin.__rpcCalls).toEqual([{ name: 'hand_club_to_caretaker_rpc', args: { p_team_id: MY_TEAM_ID } }]);
    },
  );
});

describe('commissioner leaving', () => {
  it('deletes the league while it is in setup', async () => {
    const tables = setup('setup', USER_ID);
    const res = await leave();
    expect(res).toEqual({ status: 200, body: { success: true, action: 'deleted' } });
    expect(tables.leagues).toEqual([]);
  });

  it.each(['drafting', 'active', 'offseason', 'pre_draft', 'completed'])(
    'is refused in a %s league until the role is handed on',
    async (status) => {
      const tables = setup(status, USER_ID);
      const res = await leave();
      expect(res).toEqual({ status: 409, body: { error: COMMISSIONER_LEAVE_BLOCKED_MESSAGE } });
      expect(deletes()).toEqual([]);
      expect(admin.__rpcCalls).toEqual([]);
      expect(tables.leagues).toHaveLength(1);
      expect(tables.teams.find((t) => t.id === MY_TEAM_ID)!.user_id).toBe(USER_ID);
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
