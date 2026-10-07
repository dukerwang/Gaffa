import { describe, expect, it } from 'vitest';
import { decideInactivityAction, type InactiveMember } from '../runInactivityCheck';

function member(over: Partial<InactiveMember> = {}): InactiveMember {
  return {
    league_id: 'l1',
    league_name: 'Test League',
    commissioner_id: 'boss',
    user_id: 'u1',
    username: 'quiet',
    team_id: 't1',
    team_name: 'Quiet FC',
    last_active_at: '2026-08-01T00:00:00Z',
    inactive_gameweeks: 5,
    gameweeks_since_warning: null,
    warned_at: null,
    reported_at: null,
    ...over,
  };
}

describe('decideInactivityAction', () => {
  it('does nothing before five full gameweeks', () => {
    expect(decideInactivityAction(member({ inactive_gameweeks: 4 }))).toBeNull();
  });

  it('warns the manager at five', () => {
    expect(decideInactivityAction(member())).toBe('warn');
  });

  it('warns first even when the absence is already longer, so nobody is reported unwarned', () => {
    expect(decideInactivityAction(member({ inactive_gameweeks: 9 }))).toBe('warn');
  });

  it('waits a full gameweek after the warning before telling the commissioner', () => {
    const warned = { warned_at: '2026-10-01T00:00:00Z' };
    expect(decideInactivityAction(member({ ...warned, inactive_gameweeks: 6, gameweeks_since_warning: 0 }))).toBeNull();
    expect(decideInactivityAction(member({ ...warned, inactive_gameweeks: 6, gameweeks_since_warning: 1 }))).toBe('report');
  });

  it('reports only once', () => {
    expect(
      decideInactivityAction(
        member({ inactive_gameweeks: 8, gameweeks_since_warning: 3, warned_at: '2026-10-01T00:00:00Z', reported_at: '2026-10-08T00:00:00Z' }),
      ),
    ).toBeNull();
  });

  it('warns an inactive commissioner but has nobody to report them to', () => {
    const commissioner = { user_id: 'boss', commissioner_id: 'boss' };
    expect(decideInactivityAction(member(commissioner))).toBe('warn');
    expect(
      decideInactivityAction(member({ ...commissioner, inactive_gameweeks: 7, gameweeks_since_warning: 2, warned_at: '2026-10-01T00:00:00Z' })),
    ).toBeNull();
  });
});
