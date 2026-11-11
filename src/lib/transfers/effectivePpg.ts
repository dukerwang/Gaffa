/**
 * Effective PPG — the blended points-per-game figure the transfer UI shows
 * beside a player, used to sanity-check whether an asking price is sane.
 *
 * Lifted verbatim (behaviour-identical) out of
 * `src/app/(dashboard)/league/[leagueId]/trades/page.tsx`, where it sat as a
 * 120-line closure inside a React server component. It is business logic with
 * its own rules about reliability weighting and preseason proxies, and both the
 * hub route and the free-agents route need it, so it lives here now.
 *
 * The model, in short:
 *   - 10+ appearances this season  -> 60% last-10 form, 40% season average.
 *   - 1-9 appearances              -> blend this season against a reliability-
 *                                     weighted prior season, weighted N/10.
 *   - 0 appearances                -> prior season alone, or a market-value
 *                                     proxy for a player with no history.
 *
 * Reliability is minutes/1500 capped at 1, pulling a thin sample toward 4.0
 * rather than trusting two good cameos. The floor is 3.0 throughout: this
 * number is displayed, and a sub-3 PPG would read as noise.
 */

import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PpgSample {
  points: number;
  minutes: number;
}

/** Market-value proxy for a player with no recorded history at all. */
function proxyFromMarketValue(marketValue: number): number {
  if (marketValue >= 80) return 10.0;
  if (marketValue >= 40) return 8.0;
  if (marketValue >= 20) return 6.0;
  if (marketValue >= 10) return 4.5;
  return 3.0;
}

/** Prior-season PPG pulled toward 4.0 in proportion to how few minutes back it. */
function reliabilityAdjustedPrior(prevStats: PpgSample[]): number {
  const minutes = prevStats.reduce((sum, m) => sum + m.minutes, 0);
  const ppg = prevStats.reduce((sum, m) => sum + m.points, 0) / prevStats.length;
  const reliability = Math.min(1.0, minutes / 1500);
  return reliability * ppg + (1 - reliability) * 4.0;
}

export function calculateEffectivePpg(
  currStats: PpgSample[],
  prevStats: PpgSample[],
  marketValue: number,
): number {
  const N = currStats.length;
  let effective: number;

  if (N >= 10) {
    // Mid-season: form-weighted.
    const seasonPpg = currStats.reduce((sum, m) => sum + m.points, 0) / N;
    const recent = currStats.slice(0, 10);
    const recentPpg = recent.reduce((sum, m) => sum + m.points, 0) / recent.length;
    effective = 0.6 * recentPpg + 0.4 * seasonPpg;
  } else if (N >= 1) {
    // Early season: blend against history, trusting this season more as N grows.
    const thisSeasonPpg = currStats.reduce((sum, m) => sum + m.points, 0) / N;
    if (prevStats.length > 0) {
      const weightThis = N / 10;
      effective = weightThis * thisSeasonPpg + (1 - weightThis) * reliabilityAdjustedPrior(prevStats);
    } else {
      const weightActual = Math.min(1.0, N / 5);
      effective = weightActual * thisSeasonPpg + (1 - weightActual) * proxyFromMarketValue(marketValue);
    }
  } else {
    // Preseason / no appearances yet.
    effective = prevStats.length > 0
      ? reliabilityAdjustedPrior(prevStats)
      : proxyFromMarketValue(marketValue);
  }

  return Math.max(3.0, effective);
}

/**
 * Build player_id -> effective PPG for a set of players.
 *
 * Chunks the `in()` filter: the original inlined version passed every rostered
 * player in the league (20 clubs x 20+ players) as one PostgREST filter, which
 * builds a URL long enough to be at risk of rejection. 200 keeps it comfortable.
 *
 * DNPs (minutes <= 0) are excluded before any averaging — appearances, not
 * gameweeks, are the denominator.
 */
const ppgCache = new Map<string, { value: number; expiresAt: number }>();
const PPG_CACHE_TTL_MS = 60_000;

export function clearPpgCache(): void {
  ppgCache.clear();
}

export async function buildEffectivePpgMap(
  admin: AdminClient,
  playerIds: string[],
  currentSeason: string,
  prevSeason: string,
  marketValues: Record<string, number>,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (playerIds.length === 0) return result;

  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  const now = Date.now();
  const missingPlayerIds: string[] = [];

  for (const id of playerIds) {
    const mv = marketValues[id] ?? 0;
    const key = `${id}:${currentSeason}:${prevSeason}:${mv}`;
    if (!isTest) {
      const hit = ppgCache.get(key);
      if (hit && hit.expiresAt > now) {
        result[id] = hit.value;
        continue;
      }
    }
    missingPlayerIds.push(id);
  }

  if (missingPlayerIds.length === 0) return result;

  const groups: Record<string, { curr: PpgSample[]; prev: PpgSample[] }> = {};

  // The database does the reading (migration 188): one row per player with
  // their appearances as [points, minutes] pairs, this season's newest first.
  // The old path paged every player_stats row, `stats` JSON included, to read
  // one number from it: ~5,400 rows and 4 MB in six sequential requests.
  //
  // CHUNK only caps the id list so the request body stays small. A chunk
  // returns at most one row per player, far under PostgREST's 1,000-row cap.
  const CHUNK = 300;
  const chunks: string[][] = [];
  for (let i = 0; i < missingPlayerIds.length; i += CHUNK) {
    chunks.push(missingPlayerIds.slice(i, i + CHUNK));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      admin.rpc('effective_ppg_samples', {
        p_player_ids: chunk,
        p_season: currentSeason,
        p_prev_season: prevSeason,
      }),
    ),
  );

  for (const { data, error } of results) {
    // A failed read must not look like "no appearances": that would price
    // every player off the market-value proxy and cache it.
    if (error) throw new Error(`effective_ppg_samples failed: ${error.message}`);
    for (const row of (data ?? []) as {
      player_id: string;
      curr: [number, number][];
      prev: [number, number][];
    }[]) {
      groups[row.player_id] = {
        curr: row.curr.map(([points, minutes]) => ({ points: Number(points) || 0, minutes: Number(minutes) })),
        prev: row.prev.map(([points, minutes]) => ({ points: Number(points) || 0, minutes: Number(minutes) })),
      };
    }
  }

  for (const id of missingPlayerIds) {
    const g = groups[id] ?? { curr: [], prev: [] };
    const mv = marketValues[id] ?? 0;
    const val = calculateEffectivePpg(g.curr, g.prev, mv);
    result[id] = val;
    if (!isTest) {
      ppgCache.set(`${id}:${currentSeason}:${prevSeason}:${mv}`, {
        value: val,
        expiresAt: now + PPG_CACHE_TTL_MS,
      });
    }
  }

  return result;
}
