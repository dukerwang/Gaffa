/**
 * Handing the commissioner role to another manager.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, createFakeServerClient, type FakeClient, type Tables } from '@/test/supabaseFake';
import { LEAGUE_ID, OTHER_USER_ID, USER_ID, leagueFixture } from '@/test/leagueFixture';

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

function setup(commissionerId = USER_ID): Tables {
  const tables = leagueFixture();
  Object.assign(tables.leagues[0], { status: 'active', commissioner_id: commissionerId, name: 'Test League' });
  tables.notifications = [];
  tables.users = [];
  admin = createFakeSupabase(tables, {});
  state.admin = admin;
  return tables;
}

async function transfer(userId: string | undefined) {
  const req = { json: async () => ({ userId }) } as any;
  const res = await POST(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  state.user = { id: USER_ID };
});

describe('transfer commissioner', () => {
  it('hands the role to a manager in the league', async () => {
    const tables = setup();
    const res = await transfer(OTHER_USER_ID);
    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(tables.leagues[0].commissioner_id).toBe(OTHER_USER_ID);
    expect(tables.notifications.map((n) => n.user_id)).toEqual([OTHER_USER_ID]);
  });

  it('is commissioner-only', async () => {
    const tables = setup(OTHER_USER_ID);
    const res = await transfer(USER_ID);
    expect(res.status).toBe(403);
    expect(tables.leagues[0].commissioner_id).toBe(OTHER_USER_ID);
  });

  it('refuses someone without a club in the league', async () => {
    const tables = setup();
    const res = await transfer('user-stranger');
    expect(res.status).toBe(400);
    expect(tables.leagues[0].commissioner_id).toBe(USER_ID);
  });

  it('needs a manager to hand the role to', async () => {
    setup();
    const res = await transfer(undefined);
    expect(res.status).toBe(400);
  });
});
