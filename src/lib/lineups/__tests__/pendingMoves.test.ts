import { describe, expect, it } from 'vitest';
import { deriveRosterCapacity } from '@/lib/roster/capacity';
import type { RosterStatus } from '@/types';
import { adjustCapacity, applyPendingMoves, pruneSettledMoves } from '../pendingMoves';

const entry = (id: string, status: RosterStatus) => ({ status, player: { id } });
const ids = (list: { player: { id: string } }[]) => list.map((e) => e.player.id);

// Mainoo on the bench, Ngumoha and Kroupi in the academy, Saliba on IR.
const server = {
  squad: [entry('mainoo', 'bench'), entry('saka', 'active')],
  taxi: [entry('ngumoha', 'taxi'), entry('kroupi', 'taxi')],
  ir: [entry('saliba', 'ir')],
};

describe('applyPendingMoves', () => {
  it('returns the server lists unchanged with no moves', () => {
    expect(applyPendingMoves(server, {})).toEqual(server);
  });

  it('moves a squad player into the academy at once', () => {
    const shown = applyPendingMoves(server, { mainoo: 'taxi' });
    expect(ids(shown.squad)).toEqual(['saka']);
    expect(ids(shown.taxi)).toEqual(['mainoo', 'ngumoha', 'kroupi']);
    expect(shown.taxi[0].status).toBe('taxi');
  });

  it('sends the academy player to the squad on a swap', () => {
    const shown = applyPendingMoves(server, { mainoo: 'taxi', ngumoha: 'bench' });
    expect(ids(shown.squad)).toEqual(['saka', 'ngumoha']);
    expect(shown.squad.find((e) => e.player.id === 'ngumoha')?.status).toBe('bench');
    expect(ids(shown.taxi)).toEqual(['mainoo', 'kroupi']);
  });

  it('keeps an active starter as active', () => {
    const shown = applyPendingMoves(server, { mainoo: 'ir' });
    expect(shown.squad.find((e) => e.player.id === 'saka')?.status).toBe('active');
    expect(ids(shown.ir)).toEqual(['mainoo', 'saliba']);
  });
});

describe('pruneSettledMoves', () => {
  it('drops moves the server now agrees with', () => {
    const refreshed = {
      squad: [entry('saka', 'active'), entry('ngumoha', 'bench')],
      taxi: [entry('mainoo', 'taxi'), entry('kroupi', 'taxi')],
      ir: [entry('saliba', 'ir')],
    };
    expect(pruneSettledMoves(refreshed, { mainoo: 'taxi', ngumoha: 'bench' })).toEqual({});
  });

  it('keeps a later move that an older refresh does not include', () => {
    const olderRefresh = {
      squad: [entry('saka', 'active')],
      taxi: [entry('mainoo', 'taxi'), entry('ngumoha', 'taxi'), entry('kroupi', 'taxi')],
      ir: [entry('saliba', 'ir')],
    };
    expect(pruneSettledMoves(olderRefresh, { mainoo: 'taxi', saliba: 'bench' })).toEqual({ saliba: 'bench' });
  });

  it('returns the same object when nothing settled', () => {
    const moves = { mainoo: 'taxi' as const };
    expect(pruneSettledMoves(server, moves)).toBe(moves);
  });
});

describe('adjustCapacity', () => {
  const capacity = deriveRosterCapacity({
    statuses: ['bench', 'active', 'taxi', 'taxi', 'ir'],
    rosterSize: 2,
    irSize: 2,
    taxiSize: 3,
  });

  it('follows a move into the academy', () => {
    const shown = applyPendingMoves(server, { mainoo: 'taxi' });
    const next = adjustCapacity(capacity, server, shown);
    expect(next).toMatchObject({ active: 1, academy: 3, open: 1, isFull: false });
  });

  it('leaves the counts alone on a swap', () => {
    const shown = applyPendingMoves(server, { mainoo: 'taxi', ngumoha: 'bench' });
    const next = adjustCapacity(capacity, server, shown);
    expect(next).toMatchObject({ active: 2, academy: 2, isFull: true });
  });

  it('raises a limit as soon as a slot is bought', () => {
    const next = adjustCapacity(capacity, server, server, { academy: 4 });
    expect(next.academyLimit).toBe(4);
    expect(next.irLimit).toBe(2);
  });
});
