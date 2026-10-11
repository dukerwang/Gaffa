import { describe, expect, it } from 'vitest';
import { canBidInStatus, canJoinWithNewClub, isAwaitingDraft } from '../status';

describe('isAwaitingDraft', () => {
  it('covers a new league and a redraft league between seasons', () => {
    expect(isAwaitingDraft('setup')).toBe(true);
    expect(isAwaitingDraft('pre_draft')).toBe(true);
  });
  it('excludes a league that is drafting, playing or in its offseason', () => {
    for (const s of ['drafting', 'active', 'offseason', 'completed', null]) expect(isAwaitingDraft(s)).toBe(false);
  });
});

describe('canJoinWithNewClub', () => {
  it('lets anyone found a club before a league first drafts', () => {
    expect(canJoinWithNewClub({ status: 'setup', is_dynasty: true })).toBe(true);
    expect(canJoinWithNewClub({ status: 'setup', is_dynasty: false })).toBe(true);
  });
  it('lets a newcomer found a club between redraft seasons', () => {
    expect(canJoinWithNewClub({ status: 'pre_draft', is_dynasty: false })).toBe(true);
  });
  it('closes once a league is drafting or playing', () => {
    expect(canJoinWithNewClub({ status: 'drafting', is_dynasty: false })).toBe(false);
    expect(canJoinWithNewClub({ status: 'active', is_dynasty: false })).toBe(false);
    expect(canJoinWithNewClub({ status: 'active', is_dynasty: true })).toBe(false);
    expect(canJoinWithNewClub({ status: 'offseason', is_dynasty: true })).toBe(false);
  });
});

describe('canBidInStatus', () => {
  it('opens free agents only once squads exist', () => {
    expect(canBidInStatus('active')).toBe(true);
    expect(canBidInStatus('offseason')).toBe(true);
    for (const s of ['setup', 'drafting', 'pre_draft']) expect(canBidInStatus(s)).toBe(false);
  });
});
