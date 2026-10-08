/**
 * Expansion draft routes. The SQL functions (start_expansion_draft_rpc,
 * expansion_pick_rpc, expansion_on_clock) are stubbed; these tests cover who
 * can do what, and when.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, createFakeServerClient, type FakeClient, type Tables } from '@/test/supabaseFake';
import { LEAGUE_ID, MY_TEAM_ID, OTHER_USER_ID, USER_ID, leagueFixture } from '@/test/leagueFixture';
import { median } from '@/lib/expansion/expansion';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  admin: null as any,
  rebuilt: 0,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => createFakeServerClient(state.user),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => state.admin,
}));
vi.mock('@/lib/expansion/expansion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/expansion/expansion')>()),
  rebuildSeasonForExpansion: vi.fn(async () => {
    state.rebuilt++;
    return { matchups: 10, tournaments: 3 };
  }),
}));

import { POST as open } from '../route';
import { POST as protect } from '../protect/route';
import { POST as pick } from '../pick/route';

const EXP_ID = 'exp-1';
const NEW_TEAM = 'team-new';
const NEW_USER = 'user-new';

let admin: FakeClient;

function setup({
  status = 'offseason',
  dynasty = true,
  commissioner = USER_ID,
  expansionStatus = null as null | 'protecting' | 'drafting',
  onClock = NEW_TEAM as string | null,
  pickResult = { success: true, complete: false, on_clock: NEW_TEAM } as Record<string, unknown>,
} = {}): Tables {
  const tables = leagueFixture();
  Object.assign(tables.leagues[0], { status, is_dynasty: dynasty, commissioner_id: commissioner, max_teams: 2, current_season: '2027-28' });
  tables.notifications = [];
  tables.users = [];
  tables.expansions = expansionStatus
    ? [{ id: EXP_ID, league_id: LEAGUE_ID, season: '2027-28', status: expansionStatus, new_clubs: 1, protect_count: 8, per_club_cap: 2, protection_deadline: null }]
    : [];
  tables.expansion_clubs = expansionStatus ? [{ expansion_id: EXP_ID, team_id: NEW_TEAM }] : [];
  tables.expansion_protections = [];
  if (expansionStatus) tables.teams.push({ id: NEW_TEAM, league_id: LEAGUE_ID, user_id: NEW_USER, team_name: 'New FC', faab_budget: 200 });
  admin = createFakeSupabase(tables, {
    rpc: {
      expansion_on_clock: () => onClock,
      expansion_pick_rpc: () => pickResult,
    },
  });
  state.admin = admin;
  return tables;
}

const req = (body: unknown = {}) => ({ json: async () => body }) as any;
const ctx = { params: Promise.resolve({ leagueId: LEAGUE_ID }) };
async function run(handler: (r: any, c: any) => Promise<Response>, body?: unknown) {
  const res = await handler(req(body), ctx);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  state.user = { id: USER_ID };
  state.rebuilt = 0;
});

describe('opening an expansion', () => {
  it('opens one in a dynasty offseason and makes room for the new clubs', async () => {
    const tables = setup();
    const res = await run(open, { newClubs: 2 });
    expect(res.status).toBe(200);
    expect(tables.expansions).toHaveLength(1);
    expect(tables.expansions[0].new_clubs).toBe(2);
    expect(tables.leagues[0].max_teams).toBe(tables.teams.length + 2);
  });

  it('is commissioner-only', async () => {
    setup({ commissioner: OTHER_USER_ID });
    expect((await run(open, { newClubs: 1 })).status).toBe(403);
  });

  it('only runs in the offseason', async () => {
    setup({ status: 'active' });
    expect((await run(open, { newClubs: 1 })).status).toBe(400);
  });

  it("isn't for redraft leagues", async () => {
    setup({ dynasty: false });
    expect((await run(open, { newClubs: 1 })).status).toBe(400);
  });

  it('refuses a second open expansion', async () => {
    setup({ expansionStatus: 'protecting' });
    expect((await run(open, { newClubs: 1 })).status).toBe(409);
  });
});

describe('protecting', () => {
  it('saves a club’s protected list', async () => {
    const tables = setup({ expansionStatus: 'protecting' });
    const mine = tables.roster_entries.filter((e) => e.team_id === MY_TEAM_ID).slice(0, 3).map((e) => e.player_id);
    const res = await run(protect, { playerIds: mine });
    expect(res).toEqual({ status: 200, body: { success: true, protected: 3 } });
    expect(tables.expansion_protections.map((p) => p.player_id).sort()).toEqual([...mine].sort());
  });

  it('refuses more than the protect count', async () => {
    const tables = setup({ expansionStatus: 'protecting' });
    tables.expansions[0].protect_count = 2;
    const mine = tables.roster_entries.filter((e) => e.team_id === MY_TEAM_ID).slice(0, 3).map((e) => e.player_id);
    expect((await run(protect, { playerIds: mine })).status).toBe(400);
  });

  it("refuses another club's player", async () => {
    setup({ expansionStatus: 'protecting' });
    expect((await run(protect, { playerIds: ['someone-else'] })).status).toBe(400);
  });

  it('is closed once picks have started', async () => {
    setup({ expansionStatus: 'drafting' });
    expect((await run(protect, { playerIds: [] })).status).toBe(409);
  });
});

describe('picking', () => {
  it('lets the club on the clock pick', async () => {
    setup({ expansionStatus: 'drafting', commissioner: OTHER_USER_ID });
    state.user = { id: NEW_USER };
    const res = await run(pick, { playerId: 'p-1' });
    expect(res.status).toBe(200);
    const call = admin.__rpcCalls.find((c) => c.name === 'expansion_pick_rpc')!;
    expect(call.args).toEqual({ p_expansion_id: EXP_ID, p_team_id: NEW_TEAM, p_player_id: 'p-1' });
  });

  it('lets the commissioner pick for the club on the clock', async () => {
    setup({ expansionStatus: 'drafting' });
    expect((await run(pick, {})).status).toBe(200);
    const call = admin.__rpcCalls.find((c) => c.name === 'expansion_pick_rpc')!;
    expect(call.args.p_player_id).toBeNull();
  });

  it("refuses anyone else", async () => {
    setup({ expansionStatus: 'drafting', commissioner: OTHER_USER_ID });
    expect((await run(pick, { playerId: 'p-1' })).status).toBe(403);
  });

  it('rebuilds the season when the last squad fills', async () => {
    setup({ expansionStatus: 'drafting', pickResult: { success: true, complete: true, on_clock: null } });
    const res = await run(pick, {});
    expect(res.body).toMatchObject({ success: true, complete: true });
    expect(state.rebuilt).toBe(1);
  });

  it('passes on a refusal from the database', async () => {
    setup({ expansionStatus: 'drafting', pickResult: { success: false, error: 'That player is protected.' } });
    expect(await run(pick, { playerId: 'p-1' })).toEqual({ status: 409, body: { error: 'That player is protected.' } });
  });
});

describe('median', () => {
  it('takes the middle balance, or the mean of the middle two rounded down', () => {
    expect(median([300, 41, 228])).toBe(228);
    expect(median([111, 303, 210, 250])).toBe(230);
    expect(median([])).toBe(0);
  });
});
