/**
 * Joining a league. Before the draft a newcomer gets a new club; after it the
 * only way in is taking over a club the Caretaker runs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, createFakeServerClient, type FakeClient, type Tables } from '@/test/supabaseFake';
import { LEAGUE_ID, RIVAL_TEAM_ID, leagueFixture } from '@/test/leagueFixture';

const NEWCOMER = 'user-newcomer';

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

function setup(status: string, { caretaker = false } = {}): Tables {
  const tables = leagueFixture();
  Object.assign(tables.leagues[0], { status, invite_code: 'abc123', max_teams: 6, faab_budget: 250 });
  tables.league_members = tables.teams.map((t) => ({ league_id: LEAGUE_ID, user_id: t.user_id }));
  tables.users = [{ id: NEWCOMER, username: 'newcomer' }];
  if (caretaker) {
    const rival = tables.teams.find((t) => t.id === RIVAL_TEAM_ID)!;
    tables.league_members = tables.league_members.filter((m) => m.user_id !== rival.user_id);
    Object.assign(rival, { user_id: null, caretaker_since: '2026-10-01T00:00:00Z' });
  }
  admin = createFakeSupabase(tables, {
    rpc: {
      // Stands in for migration 169's claim: oldest Caretaker club, or null.
      claim_caretaker_club_rpc: ({ p_league_id, p_user_id }) => {
        const club = tables.teams.find((t) => t.league_id === p_league_id && t.user_id == null);
        if (!club) return null;
        Object.assign(club, { user_id: p_user_id, caretaker_since: null });
        tables.league_members.push({ league_id: p_league_id, user_id: p_user_id });
        return club.id;
      },
    },
  });
  state.admin = admin;
  return tables;
}

async function join() {
  const req = { json: async () => ({ inviteCode: 'ABC123', teamName: 'New FC' }) } as any;
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  state.user = { id: NEWCOMER };
});

describe('joining', () => {
  it('creates a new club before the draft', async () => {
    const tables = setup('setup');
    const res = await join();
    expect(res).toEqual({ status: 200, body: { leagueId: LEAGUE_ID } });
    expect(tables.teams.find((t) => t.user_id === NEWCOMER)?.team_name).toBe('New FC');
  });

  it('takes over the Caretaker club after the draft', async () => {
    const tables = setup('active', { caretaker: true });
    const res = await join();
    expect(res).toEqual({ status: 200, body: { leagueId: LEAGUE_ID, teamId: RIVAL_TEAM_ID, takeover: true } });
    const club = tables.teams.find((t) => t.id === RIVAL_TEAM_ID)!;
    expect(club.user_id).toBe(NEWCOMER);
    expect(club.caretaker_since).toBeNull();
    // No new club: the squad, balance and fixtures are the old club's.
    expect(tables.teams.filter((t) => t.user_id === NEWCOMER)).toHaveLength(1);
  });

  it.each(['drafting', 'active', 'offseason'])('is closed in a %s league with no Caretaker club', async (status) => {
    const tables = setup(status);
    const before = tables.teams.length;
    const res = await join();
    expect(res.status).toBe(400);
    expect(tables.teams).toHaveLength(before);
  });
});
