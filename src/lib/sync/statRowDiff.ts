/**
 * Decides whether a freshly computed `player_stats` row differs from the one
 * already stored, so the live sync can skip rewriting rows that haven't moved.
 *
 * The sync runs every five minutes for the whole gameweek and used to rewrite
 * every player's row on every tick, whether or not anything had happened.
 * Postgres writes a new tuple (and WAL) for an upsert even when the values are
 * identical, which exhausted Supabase's disk IO budget. Comparing first turns
 * an idle tick into zero writes.
 *
 * The comparison has to agree with what Postgres would store, or an unchanged
 * row reads as changed forever (wasted writes) or a changed row reads as
 * unchanged (a stale score). Two columns need care:
 *   - `fantasy_points` is numeric(7,2) and `match_rating` is numeric(5,2), so
 *     the computed value is rounded to two places the way Postgres rounds.
 *   - `stats` and `perf` are jsonb, which drops `undefined`, turns NaN into
 *     null and ignores key order, so both sides are normalised through JSON.
 */

export interface StatRowFields {
  stats: unknown;
  fantasy_points: number | string | null;
  match_rating: number | string | null;
  perf: unknown;
}

/** Postgres numeric rounding: half away from zero, to two decimal places. */
export function round2(value: number): number {
  const sign = value < 0 ? -1 : 1;
  // The epsilon absorbs binary error such as 3.455 * 100 = 345.49999999999994.
  return (sign * Math.round(Math.abs(value) * 100 + 1e-9)) / 100;
}

function sameNumeric(next: number | string | null, stored: number | string | null): boolean {
  if (next == null || stored == null) return next == null && stored == null;
  const a = Number(next);
  const b = Number(stored);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b);
  return round2(a) === round2(b);
}

/** What jsonb would hold: JSON round trip, with absent and null alike. */
function normalise(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) ?? null;
}

function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  if (aKeys.length !== Object.keys(bo).length) return false;
  return aKeys.every((key) => key in bo && sameJson(ao[key], bo[key]));
}

export function sameStatRow(stored: StatRowFields, next: StatRowFields): boolean {
  return (
    sameNumeric(next.fantasy_points, stored.fantasy_points) &&
    sameNumeric(next.match_rating, stored.match_rating) &&
    sameJson(normalise(next.stats), normalise(stored.stats)) &&
    sameJson(normalise(next.perf), normalise(stored.perf))
  );
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
