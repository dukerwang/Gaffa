/**
 * Instant signings after Transfer Day (redraft). The route owns the timing and
 * the IR rule; claim_free_agent_rpc owns the race-sensitive checks and writes,
 * so it's stubbed here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, createFakeServerClient, type FakeClient } from '@/test/supabaseFake';
import { LEAGUE_ID, MY_TEAM_ID, PLAYER_ID, USER_ID, leagueFixture } from '@/test/leagueFixture';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  admin: null as any,
  locked: new Set<number>(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => createFakeServerClient(state.user),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => state.admin,
}));
vi.mock('@/lib/fixtures/lockout', () => ({
  getLockedPlTeamIds: async () => state.locked,
}));

import { POST } from '../route';

let admin: FakeClient;

function setup({ redraft = true, instantOpen = true, irHealthy = false } = {}) {
  const tables = leagueFixture();
  Object.assign(tables.leagues[0], { is_dynasty: !redraft, status: 'active' });
  const target = tables.players.find((p) => p.id === PLAYER_ID)!;
  target.pl_team_id = 7;
  tables.players.push({ id: 'drop-me', name: 'Drop Me', pl_team_id: 9, fpl_status: 'a' });
  if (irHealthy) {
    tables.roster_entries.push({ id: 'ir-1', team_id: MY_TEAM_ID, player_id: 'drop-me', status: 'ir' });
  }
  admin = createFakeSupabase(tables, {
    rpc: {
      transfer_day_window: () => [
        { next_settle_at: '2026-10-16T11:30:00Z', last_settle_at: '2026-10-09T11:30:00Z', instant_open: instantOpen, instant_gameweek: instantOpen ? 6 : null },
      ],
      claim_free_agent_rpc: () => ({ success: true, player_name: 'Target' }),
    },
  });
  state.admin = admin;
}

async function claim(body: Record<string, unknown> = { playerId: PLAYER_ID }) {
  const req = { json: async () => body } as any;
  const res = await POST(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  state.user = { id: USER_ID };
  state.locked = new Set();
});

describe('instant signing', () => {
  it('signs a free agent through the RPC after Transfer Day', async () => {
    setup();
    const res = await claim({ playerId: PLAYER_ID, dropPlayerId: 'drop-me' });
    expect(res).toEqual({ status: 200, body: { success: true, playerName: 'Target' } });
    const call = admin.__rpcCalls.find((c) => c.name === 'claim_free_agent_rpc')!;
    expect(call.args).toEqual({ p_league_id: LEAGUE_ID, p_team_id: MY_TEAM_ID, p_player_id: PLAYER_ID, p_drop_player_id: 'drop-me' });
  });

  it('is only for redraft leagues', async () => {
    setup({ redraft: false });
    expect((await claim()).status).toBe(400);
    expect(admin.__rpcCalls.some((c) => c.name === 'claim_free_agent_rpc')).toBe(false);
  });

  it('is closed before Transfer Day', async () => {
    setup({ instantOpen: false });
    expect((await claim()).status).toBe(409);
    expect(admin.__rpcCalls.some((c) => c.name === 'claim_free_agent_rpc')).toBe(false);
  });

  it("refuses a player whose club has kicked off", async () => {
    setup();
    state.locked = new Set([7]);
    const res = await claim();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/match has kicked off/);
  });

  it('refuses dropping a player whose match has kicked off', async () => {
    setup();
    state.locked = new Set([9]);
    const res = await claim({ playerId: PLAYER_ID, dropPlayerId: 'drop-me' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/can't drop Drop Me/);
  });

  it('refuses while a fit player sits on IR, the same rule as bidding', async () => {
    setup({ irHealthy: true });
    expect((await claim()).status).toBe(400);
    expect(admin.__rpcCalls.some((c) => c.name === 'claim_free_agent_rpc')).toBe(false);
  });

  it('passes on the RPC refusal', async () => {
    setup();
    (admin as any).rpc = async (name: string) =>
      name === 'transfer_day_window'
        ? { data: [{ next_settle_at: null, last_settle_at: null, instant_open: true, instant_gameweek: 6 }], error: null }
        : { data: { success: false, error: 'Target is already at a club.' }, error: null };
    const res = await claim();
    expect(res).toEqual({ status: 409, body: { error: 'Target is already at a club.' } });
  });
});
