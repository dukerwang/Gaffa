import { describe, expect, it } from 'vitest';
import {
  computeFunnel,
  emailLooksLikeTest,
  isTestLeagueName,
  usernameLooksRandom,
  weekStart,
  type FunnelInput,
} from '../funnel';

const NOW = new Date('2026-11-07T12:00:00Z');
const SINCE = new Date('2026-07-01T00:00:00Z');

const user = (id: string, createdAt = '2026-08-01T00:00:00Z', looksLikeTest = false) => ({ id, createdAt, looksLikeTest });
const league = (id: string, over: Partial<FunnelInput['leagues'][number]> = {}) => ({
  id,
  name: id,
  maxTeams: 2,
  status: 'setup',
  createdAt: '2026-08-01T00:00:00Z',
  ...over,
});
const member = (leagueId: string, userId: string, joinedAt = '2026-08-02T00:00:00Z', lastActiveAt: string | null = null) => ({
  leagueId,
  userId,
  joinedAt,
  lastActiveAt,
});

describe('test detection', () => {
  it('flags test league names but not real ones', () => {
    expect(isTestLeagueName('Test League 99978')).toBe(true);
    expect(isTestLeagueName('E2E 10-Man Test (6:14:48 PM)')).toBe(true);
    expect(isTestLeagueName('Matchday Militia')).toBe(false);
    expect(isTestLeagueName('Testudo FC League')).toBe(false);
  });

  it('flags test emails but not plus-addressing', () => {
    expect(emailLooksLikeTest('qa-test@gmail.com')).toBe(true);
    expect(emailLooksLikeTest('x@example.com')).toBe(true);
    expect(emailLooksLikeTest('person+gaffa@gmail.com')).toBe(false);
    expect(emailLooksLikeTest(null)).toBe(false);
  });
});

describe('usernameLooksRandom', () => {
  it('flags long all-letter names with capitals scattered through them', () => {
    // Invented strings with the same shape as the scripted ones; no real account names belong in a test.
    expect(usernameLooksRandom('kQzMtBrXwLpVnDsHaYe')).toBe(true);
    expect(usernameLooksRandom('rTbWqKjNdFxGvCmZsLuPyHa')).toBe(true);
  });

  it('leaves ordinary handles alone', () => {
    expect(usernameLooksRandom('jordan2025')).toBe(false);
    expect(usernameLooksRandom('sam.smith0820')).toBe(false);
    expect(usernameLooksRandom('ChelseaFanForLife')).toBe(false);
    expect(usernameLooksRandom('matchdaymilitia')).toBe(false);
    expect(usernameLooksRandom(null)).toBe(false);
  });
});

describe('computeFunnel', () => {
  const input: FunnelInput = {
    users: [
      user('a'),
      user('b'),
      user('c'), // signed up, never joined anything
      user('d'), // only in a test league
      user('e', '2026-08-01T00:00:00Z', true), // test email
      user('old', '2026-05-01T00:00:00Z'), // before the window
    ],
    leagues: [
      league('full-drafted', { status: 'active' }),
      league('half-full'),
      league('Test League 1', { status: 'active' }),
    ],
    members: [
      member('full-drafted', 'a', '2026-08-02T00:00:00Z', '2026-11-06T00:00:00Z'),
      member('full-drafted', 'b', '2026-08-04T00:00:00Z', '2026-09-01T00:00:00Z'),
      member('half-full', 'a'),
      member('Test League 1', 'd'),
      member('Test League 1', 'e'),
    ],
    picks: [
      { leagueId: 'full-drafted', pickedAt: '2026-08-06T00:00:00Z' },
      { leagueId: 'full-drafted', pickedAt: '2026-08-05T00:00:00Z' },
    ],
  };
  const result = computeFunnel(input, { now: NOW, since: SINCE });

  it('leaves test accounts and test leagues out and reports how many', () => {
    expect(result.excluded).toEqual({ testLeagues: 1, testUsers: 2, likelyAutomated: 0 });
  });

  it('counts accounts stage by stage', () => {
    expect(result.accounts.map((s) => s.count)).toEqual([3, 2, 2, 2, 1]);
    expect(result.neverJoined).toBe(1);
  });

  it('gives each stage its share of the start and of the stage before', () => {
    const joined = result.accounts[1];
    expect(joined.ofStart).toBeCloseTo(2 / 3);
    expect(joined.ofPrevious).toBeCloseTo(2 / 3);
    expect(result.accounts[0].ofPrevious).toBe(1);
  });

  it('counts leagues stage by stage', () => {
    expect(result.leagues.map((s) => s.count)).toEqual([2, 1, 1, 1, 1]);
  });

  it('times a league from creation to full and from full to the last pick', () => {
    expect(result.timing.leaguesTimed).toBe(1);
    expect(result.timing.daysToFullMedian).toBe(3);
    expect(result.timing.daysFullToDraftMedian).toBe(2);
  });

  it('groups signups by week and counts the ones that never joined', () => {
    expect(result.weekly).toEqual([{ week: '2026-07-27', signups: 3, neverJoined: 1 }]);
  });

  it('starts each week on Monday', () => {
    expect(weekStart('2026-11-07T12:00:00Z')).toBe('2026-11-02'); // a Saturday
    expect(weekStart('2026-11-02T00:00:00Z')).toBe('2026-11-02');
    expect(weekStart('2026-11-08T23:59:00Z')).toBe('2026-11-02'); // a Sunday
  });

  it('sets aside likely-automated signups but never someone in a real league', () => {
    const withBots: FunnelInput = {
      ...input,
      users: [
        ...input.users,
        { ...user('bot1'), looksAutomated: true },
        { ...user('bot2'), looksAutomated: true },
        { ...user('bot-in-league'), looksAutomated: true },
      ],
      members: [...input.members, member('half-full', 'bot-in-league')],
    };
    const r = computeFunnel(withBots, { now: NOW, since: SINCE });
    expect(r.excluded.likelyAutomated).toBe(2);
    expect(r.accounts[0].count).toBe(4); // a, b, c, and the bot who is in a league
    expect(r.neverJoined).toBe(1);
  });

  it('handles an empty database', () => {
    const empty = computeFunnel({ users: [], leagues: [], members: [], picks: [] }, { now: NOW, since: SINCE });
    expect(empty.accounts.every((s) => s.count === 0 && s.ofStart === 0)).toBe(true);
    expect(empty.timing.daysToFullMedian).toBeNull();
  });
});
