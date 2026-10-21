import { describe, it, expect } from 'vitest';
import { formatRating, performanceFromRow, ratingBand } from '../matchPerformance';

describe('performanceFromRow', () => {
  it('reads the numbers a match shows', () => {
    const perf = performanceFromRow({
      match_rating: '7.84',
      stats: { minutes_played: 90, goals: 1, assists: 2, own_goals: 0, yellow_cards: 1, red_cards: 0 },
    });
    expect(perf).toEqual({ rating: 7.84, minutes: 90, goals: 1, assists: 2, ownGoals: 0, yellowCards: 1, redCards: 0 });
  });

  it('returns null for a player who did not play', () => {
    expect(performanceFromRow({ match_rating: '6.00', stats: { minutes_played: 0, goals: 0 } })).toBeNull();
    expect(performanceFromRow({ match_rating: null, stats: null })).toBeNull();
  });

  it('keeps a played match with no rating', () => {
    expect(performanceFromRow({ match_rating: null, stats: { minutes_played: 12 } })?.rating).toBeNull();
  });
});

describe('ratingBand', () => {
  it('bands on the display-rating cut-offs', () => {
    expect(ratingBand(9.4)).toBe('rarest');
    expect(ratingBand(9.2)).toBe('rarer');
    expect(ratingBand(9.0)).toBe('rare');
    expect(ratingBand(8.99)).toBe('elite');
    expect(ratingBand(8.5)).toBe('elite');
    expect(ratingBand(7.5)).toBe('good');
    expect(ratingBand(6.99)).toBe('fair');
    expect(ratingBand(6.0)).toBe('belowAvg');
    expect(ratingBand(5.5)).toBe('weak');
    expect(ratingBand(4.2)).toBe('bad');
  });
});

describe('formatRating', () => {
  it('shows one decimal', () => {
    expect(formatRating(7)).toBe('7.0');
    expect(formatRating(6.56)).toBe('6.6');
  });
});
