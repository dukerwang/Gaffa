import { describe, it, expect } from 'vitest';
import { currentProjection, buildProjectionMap } from '../currentProjection';

const GW = 4;
const SEASON = '2026-27';

describe('currentProjection', () => {
  it('returns the number when the stamp matches the round on screen', () => {
    expect(currentProjection(
      { projected_points: 12.4, projected_season: SEASON, projected_gameweek: GW },
      SEASON, GW,
    )).toBe(12.4);
  });

  /* Migration 153 left pre-existing values unstamped on purpose: nothing could
     say which gameweek they were for. */
  it('refuses an unstamped row rather than trusting the number', () => {
    expect(currentProjection(
      { projected_points: 12.4, projected_season: null, projected_gameweek: null },
      SEASON, GW,
    )).toBeNull();
  });

  it('refuses last week and next week', () => {
    const row = { projected_points: 12.4, projected_season: SEASON, projected_gameweek: 3 };
    expect(currentProjection(row, SEASON, GW)).toBeNull();
    expect(currentProjection({ ...row, projected_gameweek: 5 }, SEASON, GW)).toBeNull();
  });

  it('refuses another season even on the same gameweek number', () => {
    expect(currentProjection(
      { projected_points: 12.4, projected_season: '2025-26', projected_gameweek: GW },
      SEASON, GW,
    )).toBeNull();
  });

  /* A blank gameweek is a real projection of zero, not a missing one — the
     engine writes 0.0 when a club has no fixture. */
  it('keeps a stamped zero', () => {
    expect(currentProjection(
      { projected_points: 0, projected_season: SEASON, projected_gameweek: GW },
      SEASON, GW,
    )).toBe(0);
  });

  it('returns null when the caller does not know the round', () => {
    const row = { projected_points: 9, projected_season: SEASON, projected_gameweek: GW };
    expect(currentProjection(row, SEASON, null)).toBeNull();
    expect(currentProjection(row, null, GW)).toBeNull();
    expect(currentProjection(null, SEASON, GW)).toBeNull();
  });
});

describe('buildProjectionMap', () => {
  it('includes only rows stamped for the round', () => {
    const map = buildProjectionMap([
      { id: 'a', projected_points: 10, projected_season: SEASON, projected_gameweek: GW },
      { id: 'b', projected_points: 20, projected_season: SEASON, projected_gameweek: 3 },
      { id: 'c', projected_points: 30, projected_season: SEASON, projected_gameweek: null },
      { id: 'd', projected_points: null, projected_season: SEASON, projected_gameweek: GW },
      { id: 'e', projected_points: 0, projected_season: SEASON, projected_gameweek: GW },
    ], SEASON, GW);
    expect(map).toEqual({ a: 10, e: 0 });
  });

  it('is empty when the sync has not run for this round', () => {
    expect(buildProjectionMap([
      { id: 'a', projected_points: 10, projected_season: SEASON, projected_gameweek: 3 },
    ], SEASON, GW)).toEqual({});
  });
});
