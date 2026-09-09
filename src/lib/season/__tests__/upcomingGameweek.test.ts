import { describe, it, expect } from 'vitest';
import { pickUpcomingGw } from '../currentGameweek';

describe('pickUpcomingGw', () => {
  /**
   * The case that sent a whole projections run to the wrong round: on
   * 2026-09-09 GW3 was over and GW4 had not kicked off, so FPL's "current"
   * event was still 3 while every lineup on the site was being set for 4.
   */
  it('returns the next round once the last one has finished', () => {
    expect(pickUpcomingGw([
      { id: 1, finished: true },
      { id: 2, finished: true },
      { id: 3, finished: true },
      { id: 4, finished: false },
      { id: 5, finished: false },
    ])).toBe(4);
  });

  /** During a live round it stays put — that round is still being scored. */
  it('stays on a round that is under way', () => {
    expect(pickUpcomingGw([
      { id: 3, finished: true },
      { id: 4, finished: false },
    ])).toBe(4);
  });

  it('returns the first round before a season starts', () => {
    expect(pickUpcomingGw([
      { id: 1, finished: false },
      { id: 2, finished: false },
    ])).toBe(1);
  });

  it('does not assume the events arrive in order', () => {
    expect(pickUpcomingGw([
      { id: 7, finished: false },
      { id: 5, finished: true },
      { id: 6, finished: false },
    ])).toBe(6);
  });

  /** A missing flag means "not finished" — better to project a round twice
      than to skip the one being played. */
  it('treats an absent finished flag as unfinished', () => {
    expect(pickUpcomingGw([{ id: 2, finished: true }, { id: 3 }])).toBe(3);
  });

  it('returns 0 when every round is done, or there are none', () => {
    expect(pickUpcomingGw([{ id: 1, finished: true }])).toBe(0);
    expect(pickUpcomingGw([])).toBe(0);
  });
});
