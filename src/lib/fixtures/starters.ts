/**
 * Who started which match.
 *
 * FPL reports `starts` per player per gameweek, not per match, and `explain`
 * splits a gameweek into its matches with the minutes played in each. In a
 * single gameweek the two line up exactly. In a double gameweek a player with
 * one start in two matches started the one he played longer in.
 */

interface ExplainLike {
  fixture: number;
  stats: { identifier: string; value: number }[];
}

function minutesIn(ex: ExplainLike): number {
  return ex.stats.find((s) => s.identifier === 'minutes')?.value ?? 0;
}

/**
 * The fixture ids a player started this gameweek, given his gameweek `starts`
 * and his per-match `explain` entries (real fixtures only).
 */
export function startedFixtures(starts: number | undefined, explain: ExplainLike[]): Set<number> {
  const n = Math.max(0, Math.floor(starts ?? 0));
  if (n === 0 || explain.length === 0) return new Set();
  if (n >= explain.length) return new Set(explain.map((ex) => ex.fixture));
  // Longest first; on equal minutes the earlier entry, which FPL lists in kickoff order.
  const ranked = explain
    .map((ex, i) => ({ fixture: ex.fixture, minutes: minutesIn(ex), i }))
    .sort((a, b) => b.minutes - a.minutes || a.i - b.i);
  return new Set(ranked.slice(0, n).map((r) => r.fixture));
}
