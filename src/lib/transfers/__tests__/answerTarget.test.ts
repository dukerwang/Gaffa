import { describe, it, expect } from 'vitest';
import { canAnswerTarget, playersAnswering, type AnswerablePlayer } from '../answerTarget';

const ME = 'team-mine';
const THEM = 'team-theirs';

const named = (playerId: string, teamId = THEM) => ({
  team_id: teamId,
  target_kind: 'player' as const,
  player_id: playerId,
  position: null,
});

const profile = (position: string, teamId = THEM) => ({
  team_id: teamId,
  target_kind: 'profile' as const,
  player_id: null,
  position,
});

const squad: AnswerablePlayer[] = [
  { id: 'p-cb', primary_position: 'CB', secondary_positions: ['LB'], status: 'active' },
  { id: 'p-st', primary_position: 'ST', secondary_positions: [], status: 'active' },
  { id: 'p-gk', primary_position: 'GK', secondary_positions: null, status: 'active' },
  { id: 'p-kid', primary_position: 'AM', secondary_positions: [], status: 'taxi' },
  { id: 'p-hurt', primary_position: 'RW', secondary_positions: [], status: 'ir' },
  { id: 'p-gone', primary_position: 'DM', secondary_positions: [], status: 'loan_out' },
];

describe('playersAnswering', () => {
  it('answers a named target with that player when I hold him', () => {
    expect(playersAnswering(named('p-st'), ME, squad).map((p) => p.id)).toEqual(['p-st']);
  });

  it('answers nothing when the named player is not mine', () => {
    expect(playersAnswering(named('p-elsewhere'), ME, squad)).toEqual([]);
  });

  it('answers a profile on the primary position', () => {
    expect(playersAnswering(profile('ST'), ME, squad).map((p) => p.id)).toEqual(['p-st']);
  });

  it('answers a profile on a secondary position too', () => {
    // The whole point of the 12-position taxonomy: a CB who also plays LB is
    // exactly the player a left-back profile hopes to shake loose.
    expect(playersAnswering(profile('LB'), ME, squad).map((p) => p.id)).toEqual(['p-cb']);
  });

  it('counts academy and injured players — both are tradeable', () => {
    expect(playersAnswering(profile('AM'), ME, squad).map((p) => p.id)).toEqual(['p-kid']);
    expect(playersAnswering(profile('RW'), ME, squad).map((p) => p.id)).toEqual(['p-hurt']);
  });

  it('does not count a player already out on loan', () => {
    expect(playersAnswering(profile('DM'), ME, squad)).toEqual([]);
    expect(playersAnswering(named('p-gone'), ME, squad)).toEqual([]);
  });

  it('never answers my own target', () => {
    expect(playersAnswering(named('p-st', ME), ME, squad)).toEqual([]);
    expect(playersAnswering(profile('ST', ME), ME, squad)).toEqual([]);
  });

  it('answers nothing for a position outside the taxonomy', () => {
    expect(playersAnswering(profile('MID'), ME, squad)).toEqual([]);
    expect(playersAnswering(profile(''), ME, squad)).toEqual([]);
  });

  it('answers nothing on a malformed named target', () => {
    expect(playersAnswering({ ...named('x'), player_id: null }, ME, squad)).toEqual([]);
  });
});

describe('canAnswerTarget', () => {
  it('is exactly "there is at least one answering player"', () => {
    expect(canAnswerTarget(profile('CB'), ME, squad)).toBe(true);
    expect(canAnswerTarget(profile('LWB'), ME, squad)).toBe(false);
    expect(canAnswerTarget(named('p-gk'), ME, squad)).toBe(true);
  });

  it('holds for an empty squad', () => {
    expect(canAnswerTarget(profile('CB'), ME, [])).toBe(false);
  });
});
