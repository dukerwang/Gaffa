import { describe, expect, it } from 'vitest';
import { gameweekInProgress, squadPlaceDelta } from '../holds';

describe('squadPlaceDelta (held players R8)', () => {
  it('is zero for a one-for-one squad trade', () => {
    expect(squadPlaceDelta(['bench'], 1)).toBe(0);
  });

  it('frees nothing for a held player going out', () => {
    expect(squadPlaceDelta(['held'], 1)).toBe(1);
  });

  it('frees nothing for academy or IR players going out', () => {
    expect(squadPlaceDelta(['taxi', 'ir'], 2)).toBe(2);
  });

  it('is negative when the trade shrinks the squad', () => {
    expect(squadPlaceDelta(['active', 'bench'], 1)).toBe(-1);
  });
});

describe('gameweekInProgress (held players R6)', () => {
  const gw = (gameweek: number, kickoff: string) => ({ gameweek, kickoff_time: kickoff });
  const fixtures = [
    gw(4, '2026-09-12T11:30:00Z'),
    gw(4, '2026-09-13T15:30:00Z'),
    gw(4, '2026-09-14T19:00:00Z'),
    gw(5, '2026-09-19T11:30:00Z'),
    gw(5, '2026-09-21T15:00:00Z'),
  ];

  it('is open before a gameweek’s first kickoff', () => {
    expect(gameweekInProgress(fixtures, new Date('2026-09-12T11:00:00Z'))).toBe(false);
  });

  it('is closed from the first kickoff', () => {
    expect(gameweekInProgress(fixtures, new Date('2026-09-12T11:30:00Z'))).toBe(true);
    expect(gameweekInProgress(fixtures, new Date('2026-09-14T18:59:00Z'))).toBe(true);
  });

  it('reopens once the last dated kickoff has passed', () => {
    expect(gameweekInProgress(fixtures, new Date('2026-09-14T19:00:00Z'))).toBe(false);
    expect(gameweekInProgress(fixtures, new Date('2026-09-17T12:00:00Z'))).toBe(false);
  });

  it('ignores postponed matches with no kickoff', () => {
    const withPostponed = [...fixtures, { gameweek: 4, kickoff_time: null }];
    expect(gameweekInProgress(withPostponed, new Date('2026-09-15T12:00:00Z'))).toBe(false);
  });

  it('is open with no fixtures at all', () => {
    expect(gameweekInProgress([], new Date('2026-09-15T12:00:00Z'))).toBe(false);
  });
});
