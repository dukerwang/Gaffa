/**
 * The few fields of FPL's bootstrap-static payload that per-request code needs:
 * the gameweek calendar and the season's team list. Anything that needs
 * `elements` (the ~800 player rows that make up most of the 2.4MB) reads FPL
 * directly with `cache: 'no-store'`; that is the sync routes and plPresence.
 *
 * bootstrap-static is about 2.4MB of JSON in 2026-27, and Next's Data Cache
 * refuses anything over 2MB ("items over 2MB can not be cached"). So a plain
 * `fetch(..., { next: { revalidate } })` of it caches nothing: every caller
 * downloads and parses the whole payload on every request. This keeps a slim
 * copy (a few KB) in the cache instead, refreshed every five minutes.
 *
 * Only `finished`, `is_current` and `is_next` can go stale; callers that work
 * from `deadline_time` compare it against the clock at read time. Five minutes
 * matches what most readers asked of the full fetch before it moved here.
 *
 * Outside the Next.js runtime (tsx scripts) there is no incremental cache, so
 * `unstable_cache` throws; the fallback reads FPL directly.
 */
import { unstable_cache } from 'next/cache';

const BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';

export interface FplEventSlim {
  id: number;
  deadline_time: string;
  finished?: boolean;
  is_current?: boolean;
  is_next?: boolean;
}

export interface FplTeamSlim {
  /** Seasonal id: reassigned every summer, so only valid against this payload. */
  id: number;
  /** FPL's stable club code. */
  code: number;
  name: string;
  short_name: string;
}

export interface FplBootstrapSlim {
  events: FplEventSlim[];
  teams: FplTeamSlim[];
}

async function readBootstrapSlim(): Promise<FplBootstrapSlim> {
  // no-store: the full payload is too big for the Data Cache anyway, and
  // asking only produces an error log per call.
  const res = await fetch(BOOTSTRAP_URL, { cache: 'no-store' });
  // Throwing keeps a failed read out of the cache.
  if (!res.ok) throw new Error(`FPL bootstrap-static ${res.status}`);
  const data = await res.json();
  return {
    events: ((data.events ?? []) as FplEventSlim[]).map((e) => ({
      id: e.id,
      deadline_time: e.deadline_time,
      finished: e.finished,
      is_current: e.is_current,
      is_next: e.is_next,
    })),
    teams: ((data.teams ?? []) as FplTeamSlim[]).map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      short_name: t.short_name,
    })),
  };
}

// Bump the key whenever the shape changes, or a cached entry of the old shape
// is served to code expecting the new one.
const cachedBootstrapSlim = unstable_cache(readBootstrapSlim, ['fpl-bootstrap-slim-v2'], {
  revalidate: 300,
});

/**
 * One read however many helpers ask at once. Held for a minute only: a warm
 * instance outlives many requests, and the refresh belongs to the cache.
 */
const INFLIGHT_TTL_MS = 60_000;
let inflight: Promise<FplBootstrapSlim> | null = null;
let inflightAt = 0;

export function getBootstrapSlim(): Promise<FplBootstrapSlim> {
  if (!inflight || Date.now() - inflightAt > INFLIGHT_TTL_MS) {
    inflightAt = Date.now();
    inflight = cachedBootstrapSlim()
      .catch((err: unknown) => {
        if (err instanceof Error && err.message.includes('incrementalCache missing')) {
          return readBootstrapSlim();
        }
        throw err;
      })
      .catch((err: unknown) => {
        // Don't pin a failure for the life of a warm instance.
        inflight = null;
        throw err;
      });
  }
  return inflight;
}
