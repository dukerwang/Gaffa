/**
 * The commissioner removing a manager: in a league that has drafted, the club
 * passes to the Caretaker. Refused before the draft, for the commissioner's
 * own club, and for a club the Caretaker already runs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, createFakeServerClient, type FakeClient, type Tables } from '@/test/supabaseFake';
import { LEAGUE_ID, MY_TEAM_ID, OTHER_USER_ID, RIVAL_TEAM_ID, USER_ID, leagueFixture } from '@/test/leagueFixture';

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

function setup(status: string, commissionerId = USER_ID): Tables {
  const tables = leagueFixture();
  Object.assign(tables.leagues[0], { status, commissioner_id: commissionerId, name: 'Test League' });
  tables.notifications = [];
  tables.users = [];
  admin = createFakeSupabase(tables, {
    rpc: {
      hand_club_to_caretaker_rpc: ({ p_team_id }) => {
        const team = tables.teams.find((t) => t.id === p_team_id)!;
        team.user_id = null;
        team.caretaker_since = '2026-10-07T00:00:00Z';
        return { already_caretaker: false };
      },
    },
  });
  state.admin = admin;
  return tables;
}

async function remove(teamId: string) {
  const res = await POST({} as any, { params: Promise.resolve({ leagueId: LEAGUE_ID, teamId }) });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  state.user = { id: USER_ID };
});

describe('remove manager', () => {
  it("hands a rival's club to the Caretaker in an active league", async () => {
    const tables = setup('active');
    const res = await remove(RIVAL_TEAM_ID);
    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(tables.teams.find((t) => t.id === RIVAL_TEAM_ID)!.user_id).toBeNull();
    expect(tables.notifications.map((n) => n.user_id)).toEqual([OTHER_USER_ID]);
  });

  it('is commissioner-only', async () => {
    const tables = setup('active', OTHER_USER_ID);
    const res = await remove(RIVAL_TEAM_ID);
    expect(res.status).toBe(403);
    expect(tables.teams.find((t) => t.id === RIVAL_TEAM_ID)!.user_id).toBe(OTHER_USER_ID);
  });

  it('is refused before the draft', async () => {
    setup('setup');
    const res = await remove(RIVAL_TEAM_ID);
    expect(res.status).toBe(400);
    expect(admin.__rpcCalls).toEqual([]);
  });

  it("refuses the commissioner's own club", async () => {
    setup('active');
    const res = await remove(MY_TEAM_ID);
    expect(res.status).toBe(400);
    expect(admin.__rpcCalls).toEqual([]);
  });

  it('refuses a club the Caretaker already runs', async () => {
    const tables = setup('active');
    Object.assign(tables.teams.find((t) => t.id === RIVAL_TEAM_ID)!, { user_id: null, caretaker_since: '2026-10-01T00:00:00Z' });
    const res = await remove(RIVAL_TEAM_ID);
    expect(res.status).toBe(409);
    expect(admin.__rpcCalls).toEqual([]);
  });
});
