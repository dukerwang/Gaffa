'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Player, PlayerOwnership } from '@/types';
import {
  fetchBack,
  fetchFront,
  getCachedFront,
  getOwnershipFor,
  prefetchPlayerCard,
  primeFront,
  warmPortraitPhotos,
} from '@/lib/players/cardCache';

const loadModal = () => import('./PlayerDetailsModal');
const PlayerDetailsModal = dynamic(loadModal, { ssr: false });

/** Player shape the prefetch helpers take. `press` marks a pointer press. */
type PrefetchTarget = {
  id: string;
  photo_url?: string | null;
  photo_version?: string | null;
  press?: boolean;
};

/**
 * The cancel that goes with each provider's prefetch, so `playerHoverProps`
 * can wire pointer-leave even where a caller passes only `prefetchPlayer`.
 */
const cancelFor = new WeakMap<(p: PrefetchTarget) => void, (playerId: string) => void>();

export interface OpenPlayerOptions {
  /**
   * Overrides the league-wide owner map seeded by LeagueOwnershipSeed. Only
   * needed when a caller knows better than that map — `null` means known free
   * agent, which is worth stating for a draft pool.
   */
  ownership?: PlayerOwnership | null;
  /** Shows a "Draft Pick" button in the modal. */
  onPick?: (player: Player) => void;
  /** Shows a "Nominate" button in the modal. */
  onNominate?: (player: Player) => void;
  /**
   * Opens the card straight onto this gameweek's game-log row, expanded.
   *
   * For a caller that already knows WHICH match the reader is asking about —
   * a matchup pitch chip, a match report name. Without it the card opens on
   * the front with no match context and the reader has to find the row.
   */
  gameweek?: number | null;
  /**
   * Opens the card evaluated at this position slot (e.g. 'RB', 'CM', 'ST').
   * If omitted, defaults to the player's primary position.
   */
  position?: string | null;
}

interface PlayerCardContextValue {
  /** Opens the card immediately from data the caller already holds. */
  openPlayer: (player: Player, options?: OpenPlayerOptions) => void;
  /**
   * Opens the card for a player the caller only has an id for. Resolves the
   * front payload first (usually from cache, so still instant) rather than
   * flashing an empty card.
   *
   * Prefer `openPlayer` whenever the page already loaded a Player row —
   * matchup used to wait on `/api/players/:id/card` on every click for
   * that reason. `openPlayerById` is for narrative/activity text that
   * only has an id.
   */
  openPlayerById: (playerId: string, options?: OpenPlayerOptions) => void;
  /** Warms photo + payloads on hover/focus so the click has nothing to wait on. */
  prefetchPlayer: (player: PrefetchTarget) => void;
  /** Cancels a prefetch queued by `prefetchPlayer` but not yet fired. */
  cancelPrefetch: (playerId: string) => void;
  /** Seeds the cache with server-hydrated rows. Safe to call on every render. */
  primePlayers: (players: Player[]) => void;
  closePlayer: () => void;
}

const PlayerCardContext = createContext<PlayerCardContextValue | null>(null);

/**
 * `isResolving` lives in its own context, not in the value above.
 *
 * It flips twice on every cold `openPlayerById`, and the actions context is
 * consumed by the biggest tables in the app — the stats table, the pitch, the
 * draft board. Carrying a status flag in the same object re-rendered all of
 * them to animate one spinner. The actions object is now stable for the life of
 * a league; only the handful of components that read the flag re-render.
 */
const PlayerCardStatusContext = createContext<boolean>(false);

/** How many list photos to pre-decode when a page primes its rows. */
const WARM_PHOTO_COUNT = 24;

/**
 * Hover long enough to look like intent before the game log is fetched. The
 * log is the card's slow half (an FPL read and a scoring pass), and a cursor
 * crossing a table spends well under this on each row, so only a pause warms
 * it. A press, or the click itself, starts it at once.
 */
const BACK_WARM_DWELL_MS = 250;

export function PlayerCardProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const [player, setPlayer] = useState<Player | null>(null);
  const [ownership, setOwnership] = useState<PlayerOwnership | null | undefined>(undefined);
  const [actions, setActions] = useState<Pick<OpenPlayerOptions, 'onPick' | 'onNominate'>>({});
  /** Which game-log row to open the card onto, if the caller named one. */
  const [focusGameweek, setFocusGameweek] = useState<number | null>(null);
  /** Which position slot to evaluate the card under, if the caller named one. */
  const [focusPosition, setFocusPosition] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // Guards against a slow resolve landing after the user opened someone else.
  const requestSeq = useRef(0);
  const hoverTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const backTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const closePlayer = useCallback(() => {
    requestSeq.current += 1;
    setPlayer(null);
    setOwnership(undefined);
    setActions({});
    setFocusGameweek(null);
    setFocusPosition(null);
    setIsResolving(false);
  }, []);

  const openPlayer = useCallback(
    (next: Player, options?: OpenPlayerOptions) => {
      requestSeq.current += 1;
      // Start the game log now, alongside the card's code, instead of after the
      // card mounts. The card joins this request rather than sending its own.
      void fetchBack(next.id, leagueId);
      setPlayer(next);
      setOwnership(
        options?.ownership !== undefined
          ? options.ownership
          : getOwnershipFor(next.id, leagueId),
      );
      setActions({ onPick: options?.onPick, onNominate: options?.onNominate });
      setFocusGameweek(options?.gameweek ?? null);
      setFocusPosition(options?.position ?? null);
      setIsResolving(false);
    },
    [leagueId],
  );

  const openPlayerById = useCallback(
    (playerId: string, options?: OpenPlayerOptions) => {
      const cached = getCachedFront(playerId, leagueId);
      if (cached) {
        openPlayer(cached.player, options);
        return;
      }

      const seq = ++requestSeq.current;
      setIsResolving(true);
      void fetchBack(playerId, leagueId);
      void loadModal();
      fetchFront(playerId, leagueId).then((front) => {
        if (seq !== requestSeq.current) return;
        setIsResolving(false);
        if (!front) return;
        setPlayer(front.player);
        setOwnership(
          options?.ownership !== undefined
            ? options.ownership
            : getOwnershipFor(playerId, leagueId) ?? front.ownership,
        );
        setActions({ onPick: options?.onPick, onNominate: options?.onNominate });
        setFocusGameweek(options?.gameweek ?? null);
        setFocusPosition(options?.position ?? null);
      });
    },
    [leagueId, openPlayer],
  );

  const prefetchPlayer = useCallback(
    (target: PrefetchTarget) => {
      if (target.press) {
        // A press is a click on its way: skip the waits.
        prefetchPlayerCard(target, leagueId);
        void fetchBack(target.id, leagueId);
        void loadModal();
        return;
      }
      // A brush-past shouldn't cost a request; a deliberate hover should.
      if (!hoverTimers.current.has(target.id)) {
        const timer = setTimeout(() => {
          hoverTimers.current.delete(target.id);
          prefetchPlayerCard(target, leagueId);
          void loadModal();
        }, 80);
        hoverTimers.current.set(target.id, timer);
      }
      if (!backTimers.current.has(target.id)) {
        const timer = setTimeout(() => {
          backTimers.current.delete(target.id);
          void fetchBack(target.id, leagueId);
        }, BACK_WARM_DWELL_MS);
        backTimers.current.set(target.id, timer);
      }
    },
    [leagueId],
  );

  /**
   * Cancels a pending prefetch when the pointer leaves before the 80ms timer
   * fires. Without this the timer always fired, so sweeping a cursor down a
   * long table queued a request per row regardless of intent — the timer was
   * doing nothing but delaying them.
   */
  const cancelPrefetch = useCallback((playerId: string) => {
    for (const timers of [hoverTimers.current, backTimers.current]) {
      const timer = timers.get(playerId);
      if (timer === undefined) continue;
      clearTimeout(timer);
      timers.delete(playerId);
    }
  }, []);
  cancelFor.set(prefetchPlayer, cancelPrefetch);

  const primePlayers = useCallback(
    (players: Player[]) => {
      for (const p of players) primeFront(p, leagueId);
      // The URL warmed has to be the one the row will actually request, or the
      // warm is dead weight and the bytes get downloaded twice: `decodedImages`
      // is keyed on the exact string, and a list row renders through `Portrait`,
      // which asks for the versioned square cut-out.
      warmPortraitPhotos(players.slice(0, WARM_PHOTO_COUNT));
    },
    [leagueId],
  );

  useEffect(() => {
    const all = [hoverTimers.current, backTimers.current];
    return () => {
      for (const timers of all) {
        for (const t of timers.values()) clearTimeout(t);
        timers.clear();
      }
    };
  }, []);

  // Fetch the card's code once the page is idle, so the first card opened on a
  // page doesn't wait on it. It stays out of the page's own bundle.
  useEffect(() => {
    const load = () => void loadModal();
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 2000);
    return () => window.clearTimeout(id);
  }, []);

  const value = useMemo<PlayerCardContextValue>(
    () => ({
      openPlayer,
      openPlayerById,
      prefetchPlayer,
      cancelPrefetch,
      primePlayers,
      closePlayer,
    }),
    [openPlayer, openPlayerById, prefetchPlayer, cancelPrefetch, primePlayers, closePlayer],
  );

  return (
    <PlayerCardContext.Provider value={value}>
      <PlayerCardStatusContext.Provider value={isResolving}>
        {children}
        {/* Mounted only while a player is open. Rendering it unconditionally
            pulled the card chunk — and everything it statically imports — into
            every dashboard route whether or not a card was ever opened, which
            also made the speculative import() in prefetchPlayer a no-op. */}
        {player && (
          <PlayerDetailsModal
            player={player}
            ownership={ownership}
            onClose={closePlayer}
            onPick={actions.onPick}
            onNominate={actions.onNominate}
            focusGameweek={focusGameweek}
            focusPosition={focusPosition}
          />
        )}
      </PlayerCardStatusContext.Provider>
    </PlayerCardContext.Provider>
  );
}

export function usePlayerCard(): PlayerCardContextValue {
  const ctx = useContext(PlayerCardContext);
  if (!ctx) {
    throw new Error('usePlayerCard must be used inside a PlayerCardProvider');
  }
  return ctx;
}

/** True while `openPlayerById` is resolving a cold player. */
export function usePlayerCardResolving(): boolean {
  return useContext(PlayerCardStatusContext);
}

/**
 * Convenience props for any clickable player row/tile. Spread onto the element
 * to get prefetch-on-intent for free:
 *
 *   <tr {...playerHoverProps(prefetchPlayer, player)} onClick={...}>
 */
export function playerHoverProps(
  prefetch: (p: PrefetchTarget) => void,
  player: { id: string; photo_url?: string | null; photo_version?: string | null },
  cancel?: (playerId: string) => void,
) {
  // Without a cancel the hover delays only postpone their requests, so fall
  // back to the provider's own when the caller passes none.
  const cancelHover = cancel ?? cancelFor.get(prefetch);
  return {
    onPointerEnter: () => prefetch(player),
    onFocus: () => prefetch(player),
    onPointerDown: () => prefetch({ ...player, press: true }),
    onPointerLeave: () => cancelHover?.(player.id),
    onBlur: () => cancelHover?.(player.id),
  };
}
