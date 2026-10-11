import { describe, expect, it } from 'vitest';
import {
  availability,
  caretakerScore,
  pickCaretakerLineup,
  planSquadMoves,
  type CaretakerEntry,
  type CaretakerPlayer,
} from '../plan';
import type { GranularPosition, RosterStatus } from '@/types';

const SEASON = '2026-27';
const GW = 8;

function player(id: string, pos: GranularPosition, over: Partial<CaretakerPlayer> = {}): CaretakerPlayer {
  return {
    id,
    primary_position: pos,
    secondary_positions: [],
    pl_team_id: 1,
    ppg: 4,
    fpl_status: 'a',
    fpl_chance_next_round: null,
    projected_points: null,
    projected_season: null,
    projected_gameweek: null,
    ...over,
  };
}

function entry(p: CaretakerPlayer, status: RosterStatus = 'bench'): CaretakerEntry {
  return { id: `e-${p.id}`, status, player: p };
}

/** 18 players that can fill a 4-3-3 and a full bench. */
function squad(): CaretakerEntry[] {
  const positions: GranularPosition[] = [
    'GK', 'GK', 'CB', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST', 'CB', 'CM', 'LW',
  ];
  return positions.map((pos, i) => entry(player(`p${i}`, pos)));
}

describe('availability', () => {
  it("uses FPL's percentage when it publishes one", () => {
    expect(availability(player('a', 'ST', { fpl_status: 'd', fpl_chance_next_round: 75 }))).toBe(0.75);
  });
  it('treats injured, suspended and unavailable players as out', () => {
    for (const s of ['i', 's', 'u', 'n']) expect(availability(player('a', 'ST', { fpl_status: s }))).toBe(0);
  });
  it('treats an unflagged player as fit', () => {
    expect(availability(player('a', 'ST'))).toBe(1);
  });
});

describe('caretakerScore', () => {
  it("uses this gameweek's projection when one is stamped for it", () => {
    const p = player('a', 'ST', { projected_points: 9.5, projected_season: SEASON, projected_gameweek: GW, ppg: 2 });
    expect(caretakerScore(p, SEASON, GW)).toBe(9.5);
  });
  it("ignores a projection stamped for another gameweek and falls back to ppg × availability", () => {
    const p = player('a', 'ST', { projected_points: 9.5, projected_season: SEASON, projected_gameweek: GW - 1, ppg: 6, fpl_status: 'd', fpl_chance_next_round: 50 });
    expect(caretakerScore(p, SEASON, GW)).toBe(3);
  });
});

describe('pickCaretakerLineup', () => {
  it('fills eleven starters and a four-man bench', () => {
    const lineup = pickCaretakerLineup(squad(), SEASON, GW)!;
    expect(lineup.starters).toHaveLength(11);
    expect(lineup.bench.map((b) => b.slot)).toEqual(['DEF', 'MID', 'ATT', 'FLEX']);
    const ids = [...lineup.starters, ...lineup.bench].map((s) => s.player_id);
    expect(new Set(ids).size).toBe(15);
  });

  it('starts the higher-scoring player and leaves out an injured one', () => {
    const entries = squad();
    // Two strikers compete for the ST slot; the better one starts.
    entries.find((e) => e.player.id === 'p13')!.player.ppg = 9;
    entries.find((e) => e.player.id === 'p14')!.player.ppg = 1;
    // The best winger is injured.
    Object.assign(entries.find((e) => e.player.id === 'p11')!.player, { ppg: 12, fpl_status: 'i' });
    const lineup = pickCaretakerLineup(entries, SEASON, GW)!;
    const starters = lineup.starters.map((s) => s.player_id);
    expect(starters).toContain('p13');
    expect(starters).not.toContain('p11');
  });

  it('never picks a player on IR, in the academy, out on loan or held', () => {
    const entries = squad();
    entries.push(entry(player('star-ir', 'ST', { ppg: 20 }), 'ir'));
    entries.push(entry(player('star-held', 'ST', { ppg: 20 }), 'held'));
    entries.push(entry(player('star-taxi', 'ST', { ppg: 20 }), 'taxi'));
    entries.push(entry(player('star-loan', 'ST', { ppg: 20 }), 'loan_out'));
    const ids = [...pickCaretakerLineup(entries, SEASON, GW)!.starters, ...pickCaretakerLineup(entries, SEASON, GW)!.bench].map((s) => s.player_id);
    expect(ids.some((id) => id.startsWith('star-'))).toBe(false);
  });

  it('returns null when the squad cannot field a side', () => {
    expect(pickCaretakerLineup(squad().slice(0, 8), SEASON, GW)).toBeNull();
  });
});

describe('planSquadMoves', () => {
  const unlocked = () => false;

  it('puts the longest absences on IR first, up to the free slots', () => {
    const entries = squad();
    Object.assign(entries[2].player, { fpl_status: 'i', fpl_chance_next_round: 0 });
    Object.assign(entries[3].player, { fpl_status: 'u', fpl_chance_next_round: 25 });
    Object.assign(entries[4].player, { fpl_status: 'i', fpl_chance_next_round: 0 });
    const moves = planSquadMoves({ entries, irSlots: 2, rosterLimit: 22, isIrLocked: unlocked });
    expect(moves).toEqual([
      { kind: 'to_ir', entryId: 'e-p2', playerId: 'p2' },
      { kind: 'to_ir', entryId: 'e-p4', playerId: 'p4' },
    ]);
  });

  it('leaves a doubtful player in the squad', () => {
    const entries = squad();
    Object.assign(entries[2].player, { fpl_status: 'd', fpl_chance_next_round: 50 });
    expect(planSquadMoves({ entries, irSlots: 2, rosterLimit: 22, isIrLocked: unlocked })).toEqual([]);
  });

  it('brings a fit player back from IR when there is room', () => {
    const entries = [...squad(), entry(player('back', 'ST'), 'ir')];
    expect(planSquadMoves({ entries, irSlots: 2, rosterLimit: 22, isIrLocked: unlocked })).toEqual([
      { kind: 'from_ir', entryId: 'e-back', playerId: 'back' },
    ]);
  });

  it('activates held players before anyone comes back from IR', () => {
    const entries = [...squad(), entry(player('held', 'CM'), 'held'), entry(player('back', 'ST'), 'ir')];
    // Room for one: the held player takes it, and IR waits.
    expect(planSquadMoves({ entries, irSlots: 2, rosterLimit: 19, isIrLocked: unlocked })).toEqual([
      { kind: 'activate_held', entryId: 'e-held', playerId: 'held' },
    ]);
  });

  it('keeps everyone on IR while a held player is still waiting', () => {
    const entries = [...squad(), entry(player('held', 'CM'), 'held'), entry(player('back', 'ST'), 'ir')];
    expect(planSquadMoves({ entries, irSlots: 2, rosterLimit: 18, isIrLocked: unlocked })).toEqual([]);
  });

  it('frees a squad place by moving an injured player to IR, then uses it', () => {
    const entries = [...squad(), entry(player('held', 'CM'), 'held')];
    Object.assign(entries[2].player, { fpl_status: 'i' });
    expect(planSquadMoves({ entries, irSlots: 2, rosterLimit: 18, isIrLocked: unlocked }).map((m) => m.kind)).toEqual([
      'to_ir',
      'activate_held',
    ]);
  });

  it('respects the kickoff lock', () => {
    const entries = squad();
    Object.assign(entries[2].player, { fpl_status: 'i' });
    const moves = planSquadMoves({ entries, irSlots: 2, rosterLimit: 22, isIrLocked: (p) => p.id === 'p2' });
    expect(moves).toEqual([]);
  });

  it('never moves a loaned-in player to IR', () => {
    const entries = [...squad(), entry(player('loanee', 'ST', { fpl_status: 'i' }), 'loan_in')];
    expect(planSquadMoves({ entries, irSlots: 2, rosterLimit: 22, isIrLocked: unlocked })).toEqual([]);
  });
});
