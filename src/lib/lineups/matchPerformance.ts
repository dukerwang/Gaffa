/** What one player did in one match: the numbers the Lineup Builder shows on a played match's pitch. */
export interface MatchPerformance {
  /** Gaffa's 0-10 match rating. */
  rating: number | null;
  minutes: number;
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
}

/** The slice of a `player_stats` row this reads. */
export interface PerformanceRow {
  match_rating: number | string | null;
  stats: Record<string, unknown> | null;
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Null when the player didn't take the pitch: a row exists for every player, so minutes decide. */
export function performanceFromRow(row: PerformanceRow): MatchPerformance | null {
  const stats = row.stats ?? {};
  const minutes = count(stats.minutes_played);
  if (minutes <= 0) return null;
  const rating = row.match_rating === null ? null : Number(row.match_rating);
  return {
    rating: rating !== null && Number.isFinite(rating) ? rating : null,
    minutes,
    goals: count(stats.goals),
    assists: count(stats.assists),
    ownGoals: count(stats.own_goals),
    yellowCards: count(stats.yellow_cards),
    redCards: count(stats.red_cards),
  };
}

export type RatingBand = 'elite' | 'good' | 'fair' | 'belowAvg' | 'weak' | 'bad';

/**
 * The colour a rating wears. The cut-offs are the display ratings that the
 * pitch's points badges already band on (ReadOnlyFormationBoard.module.css),
 * so a 7.5 reads the same green here as a 15.8-point score does there.
 */
export function ratingBand(rating: number): RatingBand {
  if (rating >= 8.5) return 'elite';
  if (rating >= 7.5) return 'good';
  if (rating >= 6.5) return 'fair';
  if (rating >= 6.0) return 'belowAvg';
  if (rating >= 5.5) return 'weak';
  return 'bad';
}

/** "7.4", always one decimal so a column of ratings lines up. */
export const formatRating = (rating: number): string => rating.toFixed(1);
