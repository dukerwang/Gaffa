import { describe, expect, it } from 'vitest';
import { selectUnownedFreeAgents, computePlayerAge } from '../futbolpediaFreeAgents';
import type { FreeAgentPlayerRow } from '../futbolpediaFreeAgents';

const NOW = new Date('2026-09-18T12:00:00Z');

function player(overrides: Partial<FreeAgentPlayerRow> & Pick<FreeAgentPlayerRow, 'id'>): FreeAgentPlayerRow {
  return {
    name: overrides.name ?? 'Unknown',
    web_name: overrides.web_name ?? null,
    primary_position: overrides.primary_position ?? 'ST',
    pl_team: overrides.pl_team ?? 'Arsenal',
    market_value: overrides.market_value ?? 10,
    date_of_birth: overrides.date_of_birth ?? '1998-01-01',
    is_active: overrides.is_active ?? true,
    ...overrides,
  };
}

describe('selectUnownedFreeAgents', () => {
  const schade = player({
    id: 'schade',
    name: 'Kevin Schade',
    web_name: 'Schade',
    primary_position: 'LW',
    pl_team: 'Brentford',
    market_value: 25,
    date_of_birth: '2001-11-27',
  });
  const george = player({
    id: 'george',
    name: 'Tyrique George',
    web_name: 'George',
    primary_position: 'LW',
    pl_team: 'Chelsea',
    market_value: 8,
    date_of_birth: '2006-02-04',
  });
  const salah = player({
    id: 'salah',
    name: 'Mohamed Salah',
    web_name: 'Salah',
    primary_position: 'RW',
    pl_team: 'Liverpool',
    market_value: 55,
  });
  const retained = player({
    id: 'retained',
    name: 'Held Abroad',
    primary_position: 'CB',
    market_value: 20,
  });
  const inactive = player({
    id: 'gone',
    name: 'Left The League',
    is_active: false,
    market_value: 40,
  });

  it('treats unowned active players as FA even when live auctions and listings are empty', () => {
    const fa = selectUnownedFreeAgents({
      players: [schade, george, salah, retained, inactive],
      rosteredPlayerIds: ['salah'],
      rightsHeldPlayerIds: ['retained'],
      liveAuctionPlayerIds: [],
      now: NOW,
    });
    expect(fa.map((p) => p.name)).toEqual(['Kevin Schade', 'Tyrique George']);
    expect(fa.every((p) => p.live_auction === false)).toBe(true);
    expect(fa.find((p) => p.player_id === 'schade')?.market_value_eur_m).toBe(25);
    expect(fa.find((p) => p.player_id === 'george')?.age).toBe(20);
  });

  it('keeps a live-auction unowned player in the FA pool, flagged', () => {
    const fa = selectUnownedFreeAgents({
      players: [schade, george],
      rosteredPlayerIds: [],
      rightsHeldPlayerIds: [],
      liveAuctionPlayerIds: ['george'],
      now: NOW,
    });
    expect(fa).toHaveLength(2);
    expect(fa.find((p) => p.player_id === 'george')?.live_auction).toBe(true);
    expect(fa.find((p) => p.player_id === 'schade')?.live_auction).toBe(false);
  });

  it('is empty only when every active player is rostered or rights-held', () => {
    const fa = selectUnownedFreeAgents({
      players: [schade, george, salah],
      rosteredPlayerIds: ['schade', 'george', 'salah'],
      rightsHeldPlayerIds: [],
      liveAuctionPlayerIds: [],
      now: NOW,
    });
    expect(fa).toEqual([]);
  });

  it('does not invent players that were not in the catalogue', () => {
    const fa = selectUnownedFreeAgents({
      players: [schade],
      rosteredPlayerIds: [],
      rightsHeldPlayerIds: [],
      liveAuctionPlayerIds: [],
      now: NOW,
    });
    expect(fa.map((p) => p.name)).toEqual(['Kevin Schade']);
    expect(fa.some((p) => /george/i.test(p.name))).toBe(false);
  });
});

describe('computePlayerAge', () => {
  it('uses the birthday boundary', () => {
    expect(computePlayerAge('2001-11-27', NOW)).toBe(24);
    expect(computePlayerAge('2001-09-18', NOW)).toBe(25);
    expect(computePlayerAge(null, NOW)).toBeNull();
  });
});
