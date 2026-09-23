/**
 * src/lib/players/cardSeason.ts
 *
 * Pure derivations over one season's game log, shared by the player card (the
 * figures down its photo window) and the Stats view beside it (summary, the
 * matchweek chart). Kept out of the components so both read the same numbers
 * and so they can be tested without rendering anything.
 */

import type { CardBack, CardGamelogEntry } from './cardCache';

export interface SeasonFigure {
  value: string;
  label: string;
}

export interface SeasonSummary {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  /** Mean match rating over appearances that carry one; null with none. */
  averageRating: number | null;
}

export interface MatchweekPoint {
  gameweek: number;
  /** Summed over a double gameweek. */
  points: number;
  /** The better of a double gameweek's two ratings. */
  rating: number | null;
  played: boolean;
  upcoming: boolean;
  projected: number | null;
}

const DEFENDERS = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB']);

type RawStats = Record<string, unknown>;

function stat(g: CardGamelogEntry, key: string): number {
  const v = (g.stats as RawStats | null)?.[key];
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Appearances only: no upcoming fixture, no DNP, at least one minute. */
export function appearances(log: readonly CardGamelogEntry[]): CardGamelogEntry[] {
  return log.filter((g) => !g.isUpcoming && !g.isDNP && stat(g, 'minutes_played') > 0);
}

export function seasonSummary(log: readonly CardGamelogEntry[]): SeasonSummary {
  const played = appearances(log);
  let minutes = 0;
  let goals = 0;
  let assists = 0;
  let ratingSum = 0;
  let rated = 0;
  for (const g of played) {
    minutes += stat(g, 'minutes_played');
    goals += stat(g, 'goals');
    assists += stat(g, 'assists');
    if (g.match_rating != null) {
      ratingSum += g.match_rating;
      rated += 1;
    }
  }
  return {
    appearances: played.length,
    minutes,
    goals,
    assists,
    averageRating: rated > 0 ? Math.round((ratingSum / rated) * 100) / 100 : null,
  };
}

/**
 * The four figures the card runs down its photo window, chosen by position.
 *
 * Starts are not among them: no season of `player_stats` records a start, so
 * the only way to show one would be to guess it from minutes. Minutes is the
 * honest figure for the same question.
 */
export function seasonFigures(
  position: string | null | undefined,
  log: readonly CardGamelogEntry[],
): SeasonFigure[] {
  const played = appearances(log);
  const sum = (key: string) => played.reduce((acc, g) => acc + stat(g, key), 0);
  const minutes = sum('minutes_played').toLocaleString('en-GB');
  const pos = (position ?? '').toUpperCase();

  if (pos === 'GK') {
    return [
      { value: String(sum('clean_sheet')), label: 'Clean Sheets' },
      { value: String(sum('saves')), label: 'Saves' },
      { value: String(sum('goals_conceded')), label: 'Conceded' },
      { value: minutes, label: 'Minutes' },
    ];
  }
  if (DEFENDERS.has(pos)) {
    return [
      { value: String(sum('clean_sheet')), label: 'Clean Sheets' },
      { value: String(sum('goals')), label: 'Goals' },
      { value: String(sum('assists')), label: 'Assists' },
      { value: minutes, label: 'Minutes' },
    ];
  }
  const xgi = sum('expected_goals') + sum('expected_assists');
  return [
    { value: String(sum('goals')), label: 'Goals' },
    { value: String(sum('assists')), label: 'Assists' },
    { value: xgi.toFixed(2), label: 'xGI' },
    { value: minutes, label: 'Minutes' },
  ];
}

/** Latest matchweek with a result in the log, or null before the first one. */
export function latestPlayedGameweek(log: readonly CardGamelogEntry[]): number | null {
  let latest: number | null = null;
  for (const g of log) {
    if (g.isUpcoming) continue;
    if (latest === null || g.gameweek > latest) latest = g.gameweek;
  }
  return latest;
}

/**
 * One point per matchweek from 1 to `through`, double gameweeks folded into
 * one, and the upcoming fixture (if any) marked with its projection. A week
 * with no row reads as not played rather than being skipped, so the chart's
 * gaps are the player's gaps.
 */
export function matchweekSeries(log: readonly CardGamelogEntry[], through: number): MatchweekPoint[] {
  const byWeek = new Map<number, MatchweekPoint>();
  for (const g of log) {
    if (g.isUpcoming) {
      byWeek.set(g.gameweek, {
        gameweek: g.gameweek,
        points: 0,
        rating: null,
        played: false,
        upcoming: true,
        projected: g.projected_points ?? null,
      });
      continue;
    }
    if (g.isDNP || stat(g, 'minutes_played') <= 0) continue;
    const prev = byWeek.get(g.gameweek);
    const rating = g.match_rating;
    byWeek.set(g.gameweek, {
      gameweek: g.gameweek,
      points: (prev?.played ? prev.points : 0) + Number(g.fantasy_points ?? 0),
      rating:
        prev?.played && prev.rating != null
          ? rating != null ? Math.max(prev.rating, rating) : prev.rating
          : rating,
      played: true,
      upcoming: false,
      projected: null,
    });
  }
  const out: MatchweekPoint[] = [];
  for (let gw = 1; gw <= through; gw++) {
    out.push(
      byWeek.get(gw) ?? {
        gameweek: gw,
        points: 0,
        rating: null,
        played: false,
        upcoming: false,
        projected: null,
      },
    );
  }
  return out;
}

/** Seasons the card can show, newest first: the one it loaded, then the archive. */
export function seasonOptions(back: Pick<CardBack, 'season' | 'history'> | null): string[] {
  if (!back) return [];
  const all = [back.season, ...back.history.map((h) => h.season)].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );
  return [...new Set(all)].sort().reverse();
}

/** "2025-26" → "2025/26". */
export function seasonLabel(season: string): string {
  return season.replace('-', '/');
}
