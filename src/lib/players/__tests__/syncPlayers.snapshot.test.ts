/**
 * The player sync's snapshot of the `players` table.
 *
 * Matching an FPL element to a stored player happens entirely in memory,
 * against one read of every row. Rows are never deleted — departed and
 * relegated players stay, inactive — so the table only grows, and it held 975
 * rows in September 2026 against PostgREST's silent 1,000-row cap.
 *
 * A player missing from the snapshot matches nothing and is queued as a brand
 * new insert. In production that insert fails on `players_fpl_id_key`, because
 * only snapshot rows have their fpl_id released first, and the failure aborts
 * the sync — this run and every run after it.
 */

import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/supabaseFake';

vi.mock('@/lib/departures/detect', () => ({
  recordDepartures: vi.fn(async () => []),
  midseasonDecideBy: vi.fn(() => null),
}));
vi.mock('@/lib/season/currentSeason', () => ({
  getCurrentFplSeason: vi.fn(async () => '2026-27'),
}));

import { syncPlayersFromFpl } from '../syncPlayers';

const COUNT = 1_050;
const code = (i: number) => 500_000 + i;

function storedPlayers() {
  return Array.from({ length: COUNT }, (_, i) => ({
    id: `player-${String(i).padStart(4, '0')}`,
    fpl_id: i + 1,
    is_active: true,
    primary_position: 'CM',
    secondary_positions: [],
    market_value: 12,
    name: `Given${i} Family${i}`,
    web_name: `Family${i}`,
    full_name: null,
    pl_team: 'Everton',
    date_of_birth: '1998-01-01',
    photo_url: `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code(i)}.png`,
    pl_team_changed_at: null,
  }));
}

function bootstrap() {
  return {
    teams: [{ id: 1, name: 'Everton' }],
    elements: Array.from({ length: COUNT }, (_, i) => ({
      id: i + 1,
      first_name: `Given${i}`,
      second_name: `Family${i}`,
      web_name: `Family${i}`,
      element_type: 3,
      team: 1,
      photo: `${code(i)}.jpg`,
      status: 'a',
      news: '',
    })),
  };
}

function stubFpl() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => bootstrap() })));
}

describe('syncing past 1,000 stored players', () => {
  it('matches every stored player instead of inserting the unread ones again', async () => {
    stubFpl();
    const admin = createFakeSupabase({ players: storedPlayers(), leagues: [] });

    const result = await syncPlayersFromFpl(admin as any);

    expect(result.error).toBeUndefined();
    const inserted = admin.__writes.filter((w) => w.table === 'players' && w.op === 'insert').flatMap((w) => w.rows);
    expect(inserted).toHaveLength(0);
    expect(admin.__tables.players).toHaveLength(COUNT);
    expect(admin.__tables.players.every((p) => p.market_value === 12)).toBe(true);
  });

  it('aborts without writing a player when the snapshot read fails', async () => {
    stubFpl();
    const admin = createFakeSupabase({ players: storedPlayers(), leagues: [] });
    const from = admin.from.bind(admin);
    let snapshotRead = true;
    admin.from = ((table: string) => {
      if (table === 'players' && snapshotRead) {
        snapshotRead = false;
        return {
          select: () => ({
            order: () => ({ range: async () => ({ data: null, error: { message: 'statement timeout' } }) }),
          }),
        } as any;
      }
      return from(table);
    }) as typeof admin.from;

    const result = await syncPlayersFromFpl(admin as any);

    expect(result.error).toMatch(/^snapshot: statement timeout/);
    expect(admin.__writes.filter((w) => w.table === 'players')).toHaveLength(0);
  });
});
