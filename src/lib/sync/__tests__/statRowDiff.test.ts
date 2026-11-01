import { describe, expect, it } from 'vitest';
import { chunk, round2, sameStatRow, type StatRowFields } from '../statRowDiff';

const base: StatRowFields = {
  stats: { minutes_played: 90, goals: 1, started: true, nested: { a: 1, b: [1, 2] } },
  fantasy_points: 7.46,
  match_rating: 7.8,
  perf: { attack: 'high', defence: null },
};

describe('round2', () => {
  it('rounds the way Postgres numeric does', () => {
    expect(round2(3.455)).toBe(3.46);
    expect(round2(3.454)).toBe(3.45);
    expect(round2(0)).toBe(0);
    expect(round2(-3.455)).toBe(-3.46);
  });
});

describe('sameStatRow', () => {
  it('treats a row as unchanged when Postgres would store the same values', () => {
    expect(
      sameStatRow(
        { ...base, fantasy_points: '7.46', match_rating: '7.80' },
        { ...base, fantasy_points: 7.4601, match_rating: 7.8 },
      ),
    ).toBe(true);
  });

  it('ignores jsonb key order and undefined values', () => {
    expect(
      sameStatRow(base, {
        ...base,
        stats: { nested: { b: [1, 2], a: 1 }, started: true, goals: 1, minutes_played: 90, extra: undefined },
      }),
    ).toBe(true);
  });

  it('reads NaN, which jsonb stores as null, as null', () => {
    expect(
      sameStatRow(
        { ...base, stats: { x: null } },
        { ...base, stats: { x: Number.NaN } },
      ),
    ).toBe(true);
  });

  it('detects a changed stat', () => {
    expect(sameStatRow(base, { ...base, stats: { ...(base.stats as object), goals: 2 } })).toBe(false);
  });

  it('detects a changed nested array', () => {
    expect(
      sameStatRow(base, {
        ...base,
        stats: { ...(base.stats as object), nested: { a: 1, b: [1, 3] } },
      }),
    ).toBe(false);
  });

  it('detects a one-hundredth change in points or rating', () => {
    expect(sameStatRow(base, { ...base, fantasy_points: 7.47 })).toBe(false);
    expect(sameStatRow(base, { ...base, match_rating: 7.81 })).toBe(false);
  });

  it('detects a changed performance block, and null against present', () => {
    expect(sameStatRow(base, { ...base, perf: { attack: 'low', defence: null } })).toBe(false);
    expect(sameStatRow({ ...base, perf: null }, { ...base, perf: { attack: 'low' } })).toBe(false);
    expect(sameStatRow({ ...base, perf: null }, { ...base, perf: undefined })).toBe(true);
  });

  it('treats null scores as equal only to null', () => {
    expect(sameStatRow({ ...base, match_rating: null }, { ...base, match_rating: null })).toBe(true);
    expect(sameStatRow({ ...base, match_rating: null }, { ...base, match_rating: 0 })).toBe(false);
  });
});

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
