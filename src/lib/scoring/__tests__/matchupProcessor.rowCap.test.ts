/**
 * The matchup processor reads rosters, stats and positions for every active
 * league in one pass, and PostgREST returns at most 1,000 rows per read.
 *
 * The roster read is the dangerous one. When a gameweek locks, `sanitize`
 * nulls any starter it cannot find in his club's roster, so a truncated read
 * strips real players out of a lineup and the reduced score is written as
 * final. In September 2026 that read returned 967 rows.
 *
 * The league below has 48 clubs of 22, so 1,056 roster rows. Read without
 * paging, the cut lands inside club 45: its first ten players survive and its
 * right winger does not. Club 44 is its opponent, fielding an identical XI
 * with identical stats, so the only way the two scores can differ is the bug.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeClient, type Tables } from '@/test/supabaseFake';

const state = vi.hoisted(() => ({ admin: null as any }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.admin }));
vi.mock('@/lib/season/currentSeason', () => ({
  getCurrentFplSeason: vi.fn(async () => '2026-27'),
  getLatestReferenceStatsSeason: vi.fn(async () => '2026-27'),
}));
vi.mock('@/lib/fixtures/lockout', () => ({ getFinishedPlTeamIds: vi.fn(async () => new Set([1])) }));
vi.mock('@/lib/lineups/carryForward', () => ({
  getEffectiveLineupForTeam: vi.fn(async () => null),
  carryForwardLineupsForGameweek: vi.fn(async () => {}),
}));
vi.mock('@/lib/email/sendEmailToUsers', () => ({ sendEmailToUsers: vi.fn(async () => {}) }));
vi.mock('@/lib/email/templates', () => ({ getMatchweekSummaryEmail: vi.fn(() => '') }));
vi.mock('@/lib/tournaments/advanceTournament', () => ({ executeAdvanceTournament: vi.fn(async () => {}) }));
vi.mock('@/lib/economy/payMeritPeriod', () => ({ payMeritPeriod: vi.fn(async () => ({ paid: false })) }));
vi.mock('@/lib/notifications/createNotification', () => ({ createNotification: vi.fn(async () => {}) }));

import { processMatchupsForGameweek } from '../matchupProcessor';

const SEASON = '2026-27';
const GW = 5;
const CLUBS = 48;
const SQUAD = 22;
const SLOTS = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'DM', 'CM', 'LW', 'ST', 'RW'] as const;

const STATS = {
  minutes_played: 90, goals: 1, assists: 1, shots_on_target: 2, key_passes: 2,
  tackles_total: 3, tackles_won: 2, saves: 2, goals_conceded: 0, penalty_saves: 0,
  yellow_cards: 0, red_cards: 0, own_goals: 0, penalties_missed: 0, clean_sheet: true,
  bps: 32, influence: 45, creativity: 30, threat: 40, ict_index: 11.5,
};

const playerId = (club: number, n: number) => `p-${club}-${String(n).padStart(2, '0')}`;

function lineup(club: number) {
  return {
    formation: '4-3-3',
    starters: SLOTS.map((slot, n) => ({ player_id: playerId(club, n), slot })),
    // No bench: a nulled starter must cost points, not be covered by a sub.
    bench: [],
  };
}

function seed(): Tables {
  const clubs = Array.from({ length: CLUBS }, (_, c) => c);
  let statId = 0;
  return {
    leagues: [{ id: 'lg', name: 'Row Cap League', status: 'active' }],
    teams: clubs.map((c) => ({ id: `t-${c}`, league_id: 'lg', user_id: `u-${c}`, team_name: `Club ${c}` })),
    players: clubs.flatMap((c) =>
      Array.from({ length: SQUAD }, (_, n) => ({
        id: playerId(c, n),
        primary_position: n < SLOTS.length ? SLOTS[n] : 'CB',
        secondary_positions: [],
        pl_team_id: 1,
      })),
    ),
    // Inserted club by club, so an unordered read truncates inside club 45.
    roster_entries: clubs.flatMap((c) =>
      Array.from({ length: SQUAD }, (_, n) => ({
        id: `re-${String(c).padStart(2, '0')}-${String(n).padStart(2, '0')}`,
        league_id: 'lg',
        team_id: `t-${c}`,
        player_id: playerId(c, n),
        status: 'active',
      })),
    ),
    matchups: Array.from({ length: CLUBS / 2 }, (_, k) => ({
      id: `m-${k}`,
      league_id: 'lg',
      gameweek: GW,
      team_a_id: `t-${2 * k}`,
      team_b_id: `t-${2 * k + 1}`,
      status: 'live',
      score_a: 0,
      score_b: 0,
      lineup_a: lineup(2 * k),
      lineup_b: lineup(2 * k + 1),
    })),
    player_stats: clubs.flatMap((c) =>
      SLOTS.map((_, n) => ({
        id: ++statId,
        player_id: playerId(c, n),
        season: SEASON,
        gameweek: GW,
        match_id: statId,
        fantasy_points: 6,
        stats: STATS,
      })),
    ),
    gameweek_sync_state: [{ season: SEASON, gameweek: GW, final_synced_at: '2026-09-29T08:15:00Z' }],
    rating_reference_stats: [],
  };
}

let admin: FakeClient;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  admin = createFakeSupabase(seed(), { rpc: { accumulate_loan_bonus_points: () => null } });
  state.admin = admin;
});

describe('locking a gameweek across more than 1,000 roster rows', () => {
  it('scores the club whose roster straddles row 1,000 the same as its identical opponent', async () => {
    expect(admin.__tables.roster_entries.length).toBeGreaterThan(1_000);

    const result = await processMatchupsForGameweek(GW, true);
    expect(result.ok).toBe(true);

    const tie = admin.__tables.matchups.find((m) => m.id === 'm-22')!; // Club 44 v Club 45
    expect(tie.status).toBe('completed');
    expect(Number(tie.score_a)).toBeGreaterThan(0);
    expect(Number(tie.score_b)).toBe(Number(tie.score_a));
  });

  it('never nulls a rostered starter in a locked lineup', async () => {
    await processMatchupsForGameweek(GW, true);

    for (const m of admin.__tables.matchups) {
      for (const side of [m.lineup_a, m.lineup_b]) {
        expect(side.starters.every((s: { player_id: string | null }) => s.player_id !== null)).toBe(true);
      }
    }
  });

  it('refuses to score from a failed read rather than locking a partial result', async () => {
    const broken = createFakeSupabase(seed(), { rpc: { accumulate_loan_bonus_points: () => null } });
    const from = broken.from.bind(broken);
    broken.from = ((table: string) => {
      const q = from(table);
      if (table !== 'roster_entries') return q;
      return {
        select: () => ({
          in: () => ({
            order: () => ({
              range: async () => ({ data: null, error: { message: 'connection reset' } }),
            }),
          }),
        }),
      } as any;
    }) as any;
    state.admin = broken;

    await expect(processMatchupsForGameweek(GW, true)).rejects.toThrow('connection reset');
    expect(broken.__tables.matchups.every((m) => m.status === 'live')).toBe(true);
  });
});
