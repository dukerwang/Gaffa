import { describe, expect, it } from 'vitest';
import type { CardGamelogEntry } from '../cardCache';
import {
  latestPlayedGameweek,
  matchweekSeries,
  seasonFigures,
  seasonOptions,
  seasonSummary,
} from '../cardSeason';

function played(
  gameweek: number,
  points: number,
  rating: number,
  stats: Record<string, unknown>,
): CardGamelogEntry {
  return {
    gameweek,
    fantasy_points: points,
    match_rating: rating,
    stats: { minutes_played: 90, ...stats } as CardGamelogEntry['stats'],
  };
}

const LOG: CardGamelogEntry[] = [
  { gameweek: 6, fantasy_points: 0, match_rating: null, stats: null, isUpcoming: true, projected_points: 14.6 },
  played(5, 34.3, 8.85, { minutes_played: 84, goals: 1, expected_goals: 0.6, expected_assists: 0.1 }),
  { gameweek: 4, fantasy_points: 0, match_rating: null, stats: { minutes_played: 0 }, isDNP: true },
  played(3, 13.72, 7.48, { goals: 0, assists: 1, clean_sheet: true, expected_goals: 0.2, expected_assists: 0.3 }),
  played(3, 34.26, 8.86, { goals: 1, clean_sheet: false }),
  played(1, 26.93, 8.41, { minutes_played: 27, assists: 2 }),
];

describe('seasonSummary', () => {
  it('counts appearances only, and averages the ratings they carry', () => {
    expect(seasonSummary(LOG)).toEqual({
      appearances: 4,
      minutes: 84 + 90 + 90 + 27,
      goals: 2,
      assists: 3,
      averageRating: Math.round(((8.85 + 7.48 + 8.86 + 8.41) / 4) * 100) / 100,
    });
  });
});

describe('seasonFigures', () => {
  it('gives attackers goals, assists, xGI and minutes', () => {
    expect(seasonFigures('RW', LOG).map((f) => [f.label, f.value])).toEqual([
      ['Goals', '2'],
      ['Assists', '3'],
      ['xGI', '1.20'],
      ['Minutes', '291'],
    ]);
  });

  it('leads defenders with clean sheets, counting the boolean flag', () => {
    expect(seasonFigures('LWB', LOG)[0]).toEqual({ value: '1', label: 'Clean Sheets' });
  });

  it('gives keepers saves and goals conceded', () => {
    expect(seasonFigures('GK', LOG).map((f) => f.label)).toEqual(['Clean Sheets', 'Saves', 'Conceded', 'Minutes']);
  });
});

describe('matchweekSeries', () => {
  it('folds a double gameweek, keeps gaps, and marks the projection', () => {
    const series = matchweekSeries(LOG, 6);
    expect(series).toHaveLength(6);
    expect(series[2]).toMatchObject({ gameweek: 3, played: true, rating: 8.86 });
    expect(series[2].points).toBeCloseTo(47.98);
    expect(series[1]).toMatchObject({ gameweek: 2, played: false, upcoming: false });
    expect(series[3]).toMatchObject({ gameweek: 4, played: false });
    expect(series[5]).toMatchObject({ gameweek: 6, upcoming: true, projected: 14.6 });
  });
});

describe('latestPlayedGameweek', () => {
  it('ignores the upcoming fixture', () => {
    expect(latestPlayedGameweek(LOG)).toBe(5);
    expect(latestPlayedGameweek([])).toBeNull();
  });
});

describe('seasonOptions', () => {
  it('puts the loaded season first and dedupes the archive', () => {
    expect(
      seasonOptions({
        season: '2026-27',
        history: [
          { season: '2025-26' } as never,
          { season: '2026-27' } as never,
          { season: '2024-25' } as never,
        ],
      }),
    ).toEqual(['2026-27', '2025-26', '2024-25']);
  });
});
