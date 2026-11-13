/**
 * Who hears what when supply appears.
 *
 * The cases that matter are the privacy one (a private target must never be
 * named to the seller) and the wording one (only a listing has a seller who
 * chose to sell, so only a listing gets the two-sided notice).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sent = vi.hoisted(() => ({ calls: [] as any[] }));

vi.mock('@/lib/notifications/createNotification', () => ({
  createNotification: async (_admin: unknown, params: unknown) => {
    sent.calls.push(params);
  },
}));

import { notifyTargetMatches } from '../notifyTargetMatches';

function row(id: string, teamId: string, visibility: string) {
  return {
    id,
    league_id: 'L',
    team_id: teamId,
    target_kind: 'player',
    player_id: 'P',
    position: null,
    role: null,
    visibility,
    open_to_sale: true,
    open_to_trade: false,
    open_to_loan: false,
    budget: null,
    note: null,
    status: 'active',
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    created_at: new Date().toISOString(),
  };
}

function fakeAdmin(targets: unknown[], teams: unknown[]) {
  const tables: Record<string, unknown[]> = { player_targets: targets, teams, roster_entries: [] };
  return {
    from(table: string) {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        gt: () => builder,
        in: () => builder,
        or: () => builder,
        then: (resolve: (r: unknown) => unknown) => Promise.resolve(resolve({ data: tables[table] ?? [], error: null })),
      };
      return builder;
    },
  } as any;
}

const TEAMS = [
  { id: 'A', team_name: 'A FC', user_id: 'ua' },
  { id: 'B', team_name: 'B FC', user_id: 'ub' },
];
const SELLER = { id: 'S', team_name: 'Seller FC', abbreviation: 'SEL' };

beforeEach(() => {
  sent.calls = [];
});

describe('notifyTargetMatches', () => {
  it('tells a private target\'s author about the player but never names it as a suitor', async () => {
    const admin = fakeAdmin([row('t1', 'A', 'private'), row('t2', 'B', 'public')], TEAMS);
    const res = await notifyTargetMatches(admin, {
      leagueId: 'L',
      player: { id: 'P', name: 'Saka' },
      seller: SELLER,
      source: 'listing',
      url: '/x',
      listingId: 'l1',
    });

    expect(sent.calls.map((c) => c.userId).sort()).toEqual(['ua', 'ub']);
    expect(res.namedSuitors.map((s) => s.teamId)).toEqual(['B']);
  });

  it('names a direct target as a suitor, since it is aimed at the seller', async () => {
    const admin = fakeAdmin([row('t1', 'A', 'direct')], TEAMS);
    const res = await notifyTargetMatches(admin, {
      leagueId: 'L', player: { id: 'P', name: 'Saka' }, seller: SELLER, source: 'listing', url: '/x',
    });
    expect(res.namedSuitors.map((s) => s.teamId)).toEqual(['A']);
  });

  it('does not call a release a listing', async () => {
    const admin = fakeAdmin([row('t1', 'A', 'public')], TEAMS);
    await notifyTargetMatches(admin, {
      leagueId: 'L', player: { id: 'P', name: 'Saka' }, seller: SELLER, source: 'release', url: '/x',
    });
    expect(sent.calls[0].content).toContain('have released');
    expect(sent.calls[0].content).not.toContain('have listed');
  });

  it('says an arrival has arrived', async () => {
    const admin = fakeAdmin([row('t1', 'A', 'public')], TEAMS);
    await notifyTargetMatches(admin, {
      leagueId: 'L', player: { id: 'P', name: 'Saka' }, seller: null, source: 'arrival', url: '/x',
    });
    expect(sent.calls[0].content).toContain('has arrived');
  });
});
