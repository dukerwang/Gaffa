'use client';

/**
 * src/lib/players/cardCache.ts
 *
 * Module-level caches for the premium player card. These live outside React so
 * they survive route changes and modal unmounts — reopening a player you have
 * already seen costs nothing and paints synchronously.
 *
 * Three things are cached:
 *   - front payloads (identity/stats/ranks/crest) per player+league
 *   - back payloads (game log, career history) per player+league
 *   - which image URLs have already decoded, so a warm photo renders with no
 *     fade-in at all
 *
 * In-flight requests are deduped, so hovering a row and then clicking it does
 * not issue the same fetch twice.
 */

import type { PerfGroup } from '@/lib/scoring/perfBand';
import { portraitSources, withVersion } from '@/lib/players/photo';
import type { Player, PlayerOwnership, PlayerSeasonArchive } from '@/types';

export interface CardGamelogEntry {
  gameweek: number;
  fantasy_points: number;
  match_rating: number | null;
  stats: { minutes_played?: number; goals?: number; assists?: number } | null;
  opponent?: string;
  result?: string;
  date?: string;
  isDNP?: boolean;
  isUpcoming?: boolean;
  projected_points?: number | null;
  by_position?: Record<string, { fantasy_points: number; match_rating: number | null }>;
  /** The match's performance block, banded server-side. Bands only — see the
   *  header of src/lib/scoring/perfBand.ts for why no score travels here.
   *  This is the PRIMARY slot's block; `perf_by_position` carries the rest. */
  perf?: PerfGroup[];
  /** The same block under each eligible slot, so the position chips move the
   *  breakdown and not just the points. See GamelogEntry in cardData.ts. */
  perf_by_position?: Record<string, PerfGroup[]>;
}

export interface CardFront {
  player: Player;
  /** `undefined` means unresolved; `null` means known free agent. */
  ownership: PlayerOwnership | null | undefined;
}

export interface CardBack {
  gamelog: CardGamelogEntry[];
  /** The season block — same groups, banded against season-scope cuts. */
  seasonPerf?: PerfGroup[];
  history: PlayerSeasonArchive[];
  /**
   * Which season the game log describes. Resolved server-side by
   * resolveCardSeason — a league that has rolled over before FPL kicks off
   * still shows last season — so the card must label what it was given rather
   * than assume the current one.
   */
  season?: string | null;
}

/**
 * Owner crests for a whole league, seeded once per league navigation by
 * LeagueOwnershipSeed. Holding it here rather than threading a map through
 * every page is what makes the crest present on the first frame everywhere,
 * not just on the pages that remembered to pass it.
 */
const ownershipByLeague = new Map<string, Record<string, PlayerOwnership>>();

export function primeLeagueOwnership(
  leagueId: string,
  map: Record<string, PlayerOwnership>,
): void {
  ownershipByLeague.set(leagueId, map);
}

/**
 * `undefined` — this league's roster map hasn't been seeded, so the answer is
 * genuinely unknown and worth a lookup. `null` — seeded, and this player is a
 * free agent. Outside a league there is no crest to show, so that reads null.
 */
export function getOwnershipFor(
  playerId: string,
  leagueId?: string | null,
): PlayerOwnership | null | undefined {
  if (!leagueId) return null;
  const map = ownershipByLeague.get(leagueId);
  if (!map) return undefined;
  return map[playerId] ?? null;
}

const frontCache = new Map<string, CardFront>();
const backCache = new Map<string, CardBack>();
const frontInflight = new Map<string, Promise<CardFront | null>>();
const backInflight = new Map<string, Promise<CardBack | null>>();

/**
 * How many back payloads to hold. Fronts are small and worth keeping for the
 * session; a back carries a whole game log with a per-match breakdown under
 * every eligible slot, so an unbounded map grows without limit over a long
 * draft or a browse through the player index.
 */
const BACK_CACHE_LIMIT = 50;

/** Insert with LRU eviction. A `Map` iterates in insertion order, so the first
 *  key is the least recently written; re-reading promotes via `touchBack`. */
function setBack(key: string, value: CardBack): void {
  backCache.delete(key);
  backCache.set(key, value);
  while (backCache.size > BACK_CACHE_LIMIT) {
    const oldest = backCache.keys().next().value;
    if (oldest === undefined) break;
    backCache.delete(oldest);
  }
}

/** URLs whose bytes are decoded and safe to paint in the same frame. */
const decodedImages = new Set<string>();

export function cacheKey(playerId: string, leagueId?: string | null): string {
  return `${playerId}|${leagueId ?? ''}`;
}

// ── Front ────────────────────────────────────────────────────────────────────

export function getCachedFront(playerId: string, leagueId?: string | null): CardFront | null {
  return frontCache.get(cacheKey(playerId, leagueId)) ?? null;
}

/**
 * Seeds the cache from data a page already had. List pages hydrate players with
 * ranks server-side, so priming here means the card never needs `/card` at all.
 * Ownership comes from the league-wide seed unless the caller overrides it.
 */
export function primeFront(
  player: Player,
  leagueId?: string | null,
  ownership?: PlayerOwnership | null,
): void {
  frontCache.set(cacheKey(player.id, leagueId), {
    player,
    ownership: ownership !== undefined ? ownership : getOwnershipFor(player.id, leagueId),
  });
}

export function fetchFront(
  playerId: string,
  leagueId?: string | null,
): Promise<CardFront | null> {
  const key = cacheKey(playerId, leagueId);
  const cached = frontCache.get(key);
  if (cached) return Promise.resolve(cached);

  const existing = frontInflight.get(key);
  if (existing) return existing;

  const query = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : '';
  const promise = fetch(`/api/players/${playerId}/card${query}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data?.player) return null;
      const front: CardFront = { player: data.player, ownership: data.ownership ?? null };
      frontCache.set(key, front);
      return front;
    })
    .catch(() => null)
    .finally(() => {
      frontInflight.delete(key);
    });

  frontInflight.set(key, promise);
  return promise;
}

// ── Back ─────────────────────────────────────────────────────────────────────

/**
 * The back is cached per season as well as per player and league, because the
 * card's season selector asks for a different one. `season` omitted means "let
 * the server resolve it" — which is not the same key as naming that same season
 * explicitly, and deliberately so: `resolveCardSeason` can move (a league that
 * rolls over before FPL kicks off), and a cached payload under a resolved-name
 * key would outlive the resolution that produced it.
 */
function backKey(playerId: string, leagueId?: string | null, season?: string | null): string {
  // v5: payload carries upcoming fixture with projected points and kickoff time.
  return `${cacheKey(playerId, leagueId)}|${season ?? ''}|v5`;
}

/** Bump to republish every archived season's cached log after a backfill. */
const ARCHIVE_LOG_VERSION = '1';

/**
 * Seasons known to be archived, learned from the `history` of any back payload
 * (the archive table only holds completed seasons). Only these are fetched in
 * the edge-cacheable shape.
 */
const archivedSeasons = new Set<string>();

export function getCachedBack(
  playerId: string,
  leagueId?: string | null,
  season?: string | null,
): CardBack | null {
  return backCache.get(backKey(playerId, leagueId, season)) ?? null;
}

export function fetchBack(
  playerId: string,
  leagueId?: string | null,
  season?: string | null,
): Promise<CardBack | null> {
  const key = backKey(playerId, leagueId, season);
  const cached = backCache.get(key);
  if (cached) {
    // Promote on read so the LRU measures use, not just insertion.
    setBack(key, cached);
    return Promise.resolve(cached);
  }

  const existing = backInflight.get(key);
  if (existing) return existing;

  const params = new URLSearchParams();
  // An archived season is cached at the edge (see the log route). Its payload
  // doesn't depend on the league, so leaving leagueId off lets every league
  // share one cached copy.
  const archived = season != null && archivedSeasons.has(season);
  if (leagueId && !archived) params.set('leagueId', leagueId);
  if (season) params.set('season', season);
  if (archived) params.set('v', ARCHIVE_LOG_VERSION);
  const query = params.size > 0 ? `?${params}` : '';
  const promise = fetch(`/api/players/${playerId}/log${query}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return null;
      // `seasonPerf` was omitted here while the server computed it on every
      // request — a full rating pass over every appearance — so the Season block
      // read `[]` and never rendered. Carry it.
      const back: CardBack = {
        gamelog: data.gamelog ?? [],
        seasonPerf: data.seasonPerf ?? [],
        history: data.history ?? [],
        season: data.season ?? null,
      };
      for (const h of back.history) if (h.season) archivedSeasons.add(h.season);
      setBack(key, back);
      return back;
    })
    .catch(() => null)
    .finally(() => {
      backInflight.delete(key);
    });

  backInflight.set(key, promise);
  return promise;
}

// ── Images ───────────────────────────────────────────────────────────────────

/**
 * Synchronous check used during render. When true the card paints the photo
 * immediately with no placeholder and no transition.
 */
export function isImageReady(url: string | null | undefined): boolean {
  return !!url && decodedImages.has(url);
}

export function markImageReady(url: string | null | undefined): void {
  if (url) decodedImages.add(url);
}

/**
 * Downloads and decodes an image, resolving true on success. Safe to call
 * repeatedly — already-decoded URLs resolve synchronously on the microtask
 * queue without touching the network.
 */
export function warmImage(url: string | null | undefined): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (decodedImages.has(url)) return Promise.resolve(true);
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const img = new window.Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      decodedImages.add(url);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Fire-and-forget warm for a batch of URLs (visible list rows, crests). */
export function warmImages(urls: (string | null | undefined)[]): void {
  for (const url of urls) void warmImage(url);
}

// ── Prefetch on intent ───────────────────────────────────────────────────────

/**
 * Called when the user signals intent (hover/focus on a row). Warms the photo
 * and the front payload so the click itself has nothing left to wait on.
 *
 * It deliberately does NOT warm the back. `fetchBack` is the FPL-backed half —
 * element-summary plus bootstrap plus fixtures, then a per-match scoring pass —
 * and hover is not a commitment. Warming it here meant dragging a cursor down a
 * 300-row stats table fired ~300 of those, each caching a large payload that
 * nothing would ever read. The back is fetched when a view that needs it is
 * actually opened.
 *
 * The URL warmed here is the one the CARD will request: `photo_url` carries the
 * 110x140 cut-out its slot is tuned to, versioned. A list row renders through
 * `Portrait`, which tries the square source first — `warmCardPhoto` and
 * `warmPortraitPhotos` are separate for that reason. Warming an unversioned URL
 * warms nothing: `decodedImages` is keyed on the exact string, so the render
 * would miss and download the bytes a second time.
 */
export function prefetchPlayerCard(
  player: { id: string; photo_url?: string | null; photo_version?: string | null },
  leagueId?: string | null,
): void {
  warmCardPhoto(player);
  if (!getCachedFront(player.id, leagueId)) {
    void fetchFront(player.id, leagueId);
  }
}

/** Warms the exact source PremiumPlayerCard paints first. */
export function warmCardPhoto(player: {
  photo_url?: string | null;
  photo_version?: string | null;
}): void {
  if (!player.photo_url) return;
  void warmImage(withVersion(player.photo_url, player.photo_version));
}

/** Warms the exact source a list row's `Portrait` paints first. */
export function warmPortraitPhotos(
  players: { photo_url?: string | null; photo_version?: string | null }[],
): void {
  for (const p of players) {
    const first = portraitSources(p.photo_url, p.photo_version)[0];
    if (first) void warmImage(first);
  }
}
