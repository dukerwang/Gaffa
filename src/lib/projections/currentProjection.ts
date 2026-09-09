/**
 * src/lib/projections/currentProjection.ts
 *
 * Reading `players.projected_points` safely.
 *
 * The column holds one number per player, overwritten by each run of
 * `scripts/sync_projected_points.ts`, and that script is hand-run rather than
 * scheduled in `vercel.json`. So the value on a row is not necessarily for the
 * round on screen: it may be last week's, or it may predate the stamp columns
 * entirely (migration 153 deliberately left existing values unstamped, because
 * nothing could vouch for which gameweek they belonged to).
 *
 * Every surface that renders a projection reads it through here, so none of
 * them can end up showing a stale figure with confidence.
 */

export interface ProjectionSource {
  projected_points?: number | null;
  projected_season?: string | null;
  projected_gameweek?: number | null;
}

/**
 * The projection for `season`/`gameweek`, or null when this row has none.
 *
 * Null covers three genuinely different situations that all mean "do not show
 * a number": never computed, computed for another round, and computed for a
 * round in which the player's club has no fixture. The engine writes 0.0 for
 * that last case, which is a real projection of zero and is returned as 0 —
 * callers should render it as such rather than treating it as missing.
 */
export function currentProjection(
  player: ProjectionSource | null | undefined,
  season: string | null | undefined,
  gameweek: number | null | undefined,
): number | null {
  if (!player || !season || gameweek == null) return null;
  if (player.projected_points == null) return null;
  if (player.projected_season !== season) return null;
  if (player.projected_gameweek !== gameweek) return null;
  return Number(player.projected_points);
}

/**
 * Builds `playerId -> projection` for the given round, skipping every player
 * whose stamp does not match. An empty map is the correct, honest result for a
 * week nobody has run the sync for.
 */
export function buildProjectionMap<T extends ProjectionSource & { id: string }>(
  players: T[],
  season: string | null | undefined,
  gameweek: number | null | undefined,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of players) {
    const v = currentProjection(p, season, gameweek);
    if (v != null) map[p.id] = v;
  }
  return map;
}
