import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Who the grant belongs to, and who runs each club, per test.
const state = vi.hoisted(() => ({
  grantUser: null as { grantId: string; userId: string } | null,
  owners: new Map<string, string | null>(),
  built: [] as string[],
}));

vi.mock('@/lib/integrations/futbolpediaGrantRoutes', async () => {
  const { NextResponse } = await import('next/server');
  return {
    grantUser: async () => state.grantUser,
    notConnected: () => NextResponse.json({ error: 'Not connected' }, { status: 401 }),
    grantErrorResponse: () => NextResponse.json({ error: 'Something went wrong' }, { status: 500 }),
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: Record<string, string> = {};
      const chain = {
        select: () => chain,
        eq: (col: string, value: string) => {
          filters[col] = value;
          return chain;
        },
        maybeSingle: async () => {
          const owner = state.owners.get(`${filters.league_id}:${filters.id}`);
          return { data: owner === undefined ? null : { user_id: owner }, error: null };
        },
      };
      return chain;
    },
  }),
}));

vi.mock('@/lib/integrations/futbolpediaContext', () => ({
  buildFutbolpediaClubContext: async (leagueId: string, teamId: string) => {
    state.built.push(`${leagueId}:${teamId}`);
    return { league_id: leagueId, club_id: teamId };
  },
}));

const { GET } = await import('@/app/api/integrations/futbolpedia/context/route');

const LEAGUE = '11111111-1111-4111-8111-111111111111';
const MINE = '22222222-2222-4222-8222-222222222222';
const THEIRS = '33333333-3333-4333-8333-333333333333';
const TOKEN = `fpg_${'a'.repeat(43)}`;

function get(teamId: string, headers: Record<string, string>) {
  return GET(new NextRequest(`http://gaffa.test/api/integrations/futbolpedia/context?leagueId=${LEAGUE}&teamId=${teamId}`, { headers }));
}

describe('GET /api/integrations/futbolpedia/context', () => {
  beforeEach(() => {
    state.grantUser = { grantId: 'g1', userId: 'manager-1' };
    state.owners = new Map([
      [`${LEAGUE}:${MINE}`, 'manager-1'],
      [`${LEAGUE}:${THEIRS}`, 'manager-2'],
    ]);
    state.built = [];
    process.env.FUTBOLPEDIA_READ_SECRET = 'shared-secret';
  });

  it('serves a club the grant’s manager runs', async () => {
    const res = await get(MINE, { authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    expect(state.built).toEqual([`${LEAGUE}:${MINE}`]);
  });

  it('refuses another manager’s club, and builds nothing', async () => {
    const res = await get(THEIRS, { authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(403);
    expect(state.built).toEqual([]);
  });

  it('refuses a Caretaker club (no manager)', async () => {
    state.owners.set(`${LEAGUE}:${THEIRS}`, null);
    expect((await get(THEIRS, { authorization: `Bearer ${TOKEN}` })).status).toBe(403);
  });

  it('refuses an unknown or revoked token', async () => {
    state.grantUser = null;
    expect((await get(MINE, { authorization: `Bearer ${TOKEN}` })).status).toBe(401);
    expect(state.built).toEqual([]);
  });

  it('a bearer token never falls back to the shared secret', async () => {
    const res = await get(THEIRS, { authorization: `Bearer ${TOKEN}`, 'x-futbolpedia-secret': 'shared-secret' });
    expect(res.status).toBe(403);
  });

  it('keeps the shared secret for Gaffa’s own chat proxy, and nothing else gets in', async () => {
    expect((await get(THEIRS, { 'x-futbolpedia-secret': 'shared-secret' })).status).toBe(200);
    expect((await get(THEIRS, { 'x-futbolpedia-secret': 'wrong' })).status).toBe(401);
    expect((await get(THEIRS, {})).status).toBe(401);
  });
});
