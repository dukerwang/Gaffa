import { describe, it, expect } from 'vitest';
import {
  deriveRosterCapacity,
  MIN_ACTIVE_ROSTER,
  UNCOUNTED_ROSTER_STATUSES,
} from '../capacity';
import type { RosterStatus } from '@/types';

/** Builds a status list: n of each named status. */
function statuses(spec: Partial<Record<RosterStatus, number>>): RosterStatus[] {
  const out: RosterStatus[] = [];
  for (const [status, n] of Object.entries(spec)) {
    for (let i = 0; i < (n ?? 0); i++) out.push(status as RosterStatus);
  }
  return out;
}

describe('deriveRosterCapacity', () => {
  it('counts active and bench toward the cap, and nothing else', () => {
    const cap = deriveRosterCapacity({
      statuses: statuses({ active: 11, bench: 4, ir: 2, taxi: 3, loan_in: 2 }),
      rosterSize: 22,
    });
    expect(cap.active).toBe(15);
    expect(cap.ir).toBe(2);
    expect(cap.academy).toBe(3);
    expect(cap.loanedIn).toBe(2);
  });

  it('excludes exactly the three uncounted statuses', () => {
    expect([...UNCOUNTED_ROSTER_STATUSES].sort()).toEqual(['ir', 'loan_in', 'taxi']);
  });

  /**
   * The divergence this module exists to end: `auctions/route.ts` counted
   * loan-ins toward the cap while `auctions/bid/route.ts` did not, so the list
   * could refuse a bid the bid route would have taken.
   */
  it('does not charge a manager for a loaned-in player', () => {
    const withLoans = deriveRosterCapacity({
      statuses: statuses({ bench: 22, loan_in: 2 }),
      rosterSize: 22,
    });
    expect(withLoans.active).toBe(22);
    expect(withLoans.isOver).toBe(false);
  });

  it('adds one slot per loan-out that used its buyback', () => {
    const cap = deriveRosterCapacity({
      statuses: statuses({ bench: 23 }),
      rosterSize: 22,
      buybackSlots: 2,
    });
    expect(cap.limit).toBe(24);
    expect(cap.baseLimit).toBe(22);
    expect(cap.buybackSlots).toBe(2);
    expect(cap.open).toBe(1);
    expect(cap.isFull).toBe(false);
  });

  it('is full at the limit and reports no open slots', () => {
    const cap = deriveRosterCapacity({ statuses: statuses({ bench: 22 }), rosterSize: 22 });
    expect(cap.isFull).toBe(true);
    expect(cap.isOver).toBe(false);
    expect(cap.open).toBe(0);
  });

  /** A buyback expiring or a loan returning can land a roster over the cap. */
  it('reports over-cap without going negative on open slots', () => {
    const cap = deriveRosterCapacity({ statuses: statuses({ bench: 24 }), rosterSize: 22 });
    expect(cap.isOver).toBe(true);
    expect(cap.isFull).toBe(true);
    expect(cap.open).toBe(0);
  });

  it('flags the trade floor at and below 15', () => {
    expect(deriveRosterCapacity({ statuses: statuses({ bench: 16 }), rosterSize: 22 }).atFloor).toBe(false);
    expect(deriveRosterCapacity({ statuses: statuses({ bench: 15 }), rosterSize: 22 }).atFloor).toBe(true);
    expect(deriveRosterCapacity({ statuses: statuses({ bench: 14 }), rosterSize: 22 }).atFloor).toBe(true);
    expect(MIN_ACTIVE_ROSTER).toBe(15);
  });

  it('falls back to the documented defaults when a league omits its settings', () => {
    const cap = deriveRosterCapacity({ statuses: [], rosterSize: null });
    expect(cap.limit).toBe(20);
    expect(cap.irLimit).toBe(2);
    expect(cap.academyLimit).toBe(3);
  });
});
