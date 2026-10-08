'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Player, PlayerOwnership } from '@/types';
import type { CrestConfig } from '@/components/crest/types';
import { getPlayerDisplayName, playerInitial } from '@/lib/players/displayName';
import { portraitUrl, withVersion } from '@/lib/players/photo';
import { useParams } from 'next/navigation';
import CrestBadge from '@/components/crest/CrestBadge';
import SquadPeekButton from '@/components/teams/SquadPeekButton';
import { clubBadgePath, clubColor, clubColor2 } from '@/lib/clubs/registry';
import {
  type CardBack,
  type CardGamelogEntry,
  fetchBack,
  fetchFront,
  getCachedBack,
  getCachedFront,
  getOwnershipFor,
  isImageReady,
  markImageReady,
  primeFront,
} from '@/lib/players/cardCache';
import { appearances, seasonFigures, type SeasonFigure } from '@/lib/players/cardSeason';
import styles from './PremiumPlayerCard.module.css';

const POS_LONG: Record<string, string> = {
  GK: 'Goalkeeper', CB: 'Centre-Back', LB: 'Left-Back', RB: 'Right-Back',
  LWB: 'Left Wing-Back', RWB: 'Right Wing-Back',
  DM: 'Defensive Mid', CM: 'Central Mid',
  AM: 'Attacking Mid', LW: 'Left Winger', RW: 'Right Winger', ST: 'Striker',
};

export const POS_CSS_VAR: Record<string, string> = {
  GK: 'var(--color-pos-gk)',
  CB: 'var(--color-pos-cb)',
  LB: 'var(--color-pos-fb)', RB: 'var(--color-pos-fb)',
  LWB: 'var(--color-pos-wb)', RWB: 'var(--color-pos-wb)',
  DM: 'var(--color-pos-dm)',
  CM: 'var(--color-pos-cm)',
  AM: 'var(--color-pos-am)',
  LW: 'var(--color-pos-lw)', RW: 'var(--color-pos-rw)',
  ST: 'var(--color-pos-st)',
};

/** Season-level figures the card shows when it isn't showing the player's live row. */
export interface CardSeasonView {
  total_points: number | null;
  ppg: number | null;
  overall_rank: number | null;
  position_ranks: { position: string; rank: number }[] | null;
}

interface Props {
  player: Player;
  /**
   * Owner crest data. `undefined` means "not known yet" and triggers a
   * background lookup; `null` means "known free agent" and does not.
   */
  ownership?: PlayerOwnership | null;
  /**
   * Render from the props only, with no network enrichment. The auth carousel
   * uses it: its data is complete and a fetch would only cause a late repaint.
   */
  staticOnly?: boolean;
  /** Opens the card scored at this slot (e.g. the slot an auto-sub filled). */
  focusPosition?: string | null;
  /** Controlled slot. Omitted, the card keeps its own. */
  slot?: string;
  onSlotChange?: (slot: string) => void;
  /**
   * The season's game log, for the figures down the window and for totals at a
   * secondary slot. `undefined`: the card fetches the current season itself.
   * `null`: still loading.
   */
  back?: CardBack | null;
  /** Points, PPG and ranks for an archived season. Omitted: the live row. */
  seasonView?: CardSeasonView | null;
  /** Shown as a button above the card; for surfaces that render it inline. */
  onOpen?: () => void;
  /** Hears the resolved player and ownership, for a shell that shows them too. */
  onResolve?: (player: Player, ownership: PlayerOwnership | null) => void;
}

interface Snapshot {
  player: Player;
  ownership: PlayerOwnership | null | undefined;
}

/**
 * The best data available synchronously, in priority order: whatever a previous
 * open cached, then the props. Never returns null, so the card always has
 * something complete enough to paint on its very first frame.
 */
function buildSnapshot(
  player: Player,
  ownership: PlayerOwnership | null | undefined,
  leagueId: string | undefined,
): Snapshot {
  const cached = getCachedFront(player.id, leagueId);
  const resolvedOwnership =
    ownership !== undefined
      ? ownership
      : cached?.ownership !== undefined
        ? cached.ownership
        : getOwnershipFor(player.id, leagueId);

  if (!cached) return { player, ownership: resolvedOwnership };
  return {
    // Props win on any field they actually carry: a list page's row is at
    // least as fresh as the cache, and merging avoids flicker either way.
    player: { ...cached.player, ...stripUndefined(player) },
    ownership: resolvedOwnership,
  };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** True when the front still has holes only the server can fill. */
function frontIsIncomplete(snapshot: Snapshot, leagueId: string | undefined): boolean {
  if (snapshot.player.overall_rank === undefined) return true;
  if (snapshot.player.position_ranks === undefined) return true;
  if (leagueId && snapshot.ownership === undefined) return true;
  return false;
}

function calcAge(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function cmToFeet(cm: number): string {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn % 12);
  if (inch === 12) { ft++; inch = 0; }
  return `${ft}'${inch}"`;
}

/** FPL availability stamp; null when the player is available. */
function injuryStatus(fplStatus: string | null | undefined, fplNews: string | null | undefined) {
  if (!fplStatus || fplStatus === 'a') return null;
  const label =
    fplStatus === 'd' ? 'Doubtful'
    : fplStatus === 'i' ? 'Out'
    : fplStatus === 's' ? 'Suspended'
    : 'Unavailable';
  const news = fplNews?.trim() || null;
  return {
    label,
    news,
    doubtful: fplStatus === 'd',
    aria: news ? `${label}: ${news}` : label,
  };
}

/** Points for one game under a slot, falling back to the stored primary values. */
export function pointsAtSlot(g: CardGamelogEntry, slot: string): number {
  return g.by_position?.[slot]?.fantasy_points ?? g.fantasy_points;
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-8 8M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

export default function PremiumPlayerCard({
  player,
  ownership,
  staticOnly = false,
  focusPosition,
  slot: controlledSlot,
  onSlotChange,
  back: backProp,
  seasonView,
  onOpen,
  onResolve,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const holoRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  // ── Front: painted on the first frame, always ───────────────────────────────
  const [snapshot, setSnapshot] = useState<Snapshot>(() =>
    staticOnly ? { player, ownership: ownership ?? null } : buildSnapshot(player, ownership, leagueId),
  );

  // Deriving during render (rather than in an effect) means switching players
  // never paints one frame of the previous player's data.
  const [renderedId, setRenderedId] = useState(player.id);
  const [ownSlot, setOwnSlot] = useState<string>(
    () => focusPosition?.toUpperCase() || player.primary_position || 'N/A',
  );
  if (renderedId !== player.id) {
    setRenderedId(player.id);
    setSnapshot(staticOnly ? { player, ownership: ownership ?? null } : buildSnapshot(player, ownership, leagueId));
    setOwnSlot(player.primary_position || 'N/A');
  }

  useEffect(() => {
    if (focusPosition) setOwnSlot(focusPosition.toUpperCase());
  }, [focusPosition]);

  const resolvedPlayer = snapshot.player;
  const resolvedOwnership = snapshot.ownership ?? null;

  useEffect(() => {
    onResolve?.(resolvedPlayer, resolvedOwnership);
  }, [onResolve, resolvedPlayer, resolvedOwnership]);

  // ── Game log for the window's figures: the caller's, or the current season's ─
  const selfFetch = backProp === undefined && !staticOnly;
  const [ownBack, setOwnBack] = useState<CardBack | null>(() =>
    selfFetch ? getCachedBack(player.id, leagueId) : null,
  );
  const back = backProp !== undefined ? backProp : ownBack;

  // ── Photo: fixed slot, cascades through FPL's two cut-outs before initials,
  // instant when warm, grace-then-crossfade when cold ───────────────────────
  // `photo_url` is the 110x140 cut-out the slot is tuned to; the 500x500 one is
  // a different crop (see photo.ts) but coverage isn't nested, so trying it
  // before giving up closes real gaps. photo_version (migration 136) busts a
  // browser cache that kept PL's old bytes.
  const rawPhotoUrl = resolvedPlayer.photo_url
    ? withVersion(resolvedPlayer.photo_url, resolvedPlayer.photo_version)
    : null;
  const photoAltUrl = portraitUrl(resolvedPlayer.photo_url, resolvedPlayer.photo_version);
  const photoSources = [rawPhotoUrl, photoAltUrl].filter((u): u is string => u !== null);
  const sourcesKey = `${resolvedPlayer.id}|${photoSources.join('|')}`;

  const [photoState, setPhotoState] = useState<{ key: string; n: number; loaded: boolean }>(
    () => ({ key: sourcesKey, n: 0, loaded: isImageReady(photoSources[0] ?? null) }),
  );
  if (photoState.key !== sourcesKey) {
    setPhotoState({ key: sourcesKey, n: 0, loaded: isImageReady(photoSources[0] ?? null) });
  }
  const photoUrl = photoSources[photoState.n] ?? null;

  const advancePhoto = useCallback(() => {
    setPhotoState((s) => ({ key: s.key, n: s.n + 1, loaded: false }));
  }, []);

  // An <img> whose bytes are already cached can finish before React attaches
  // onLoad, so completeness is checked on mount. A source that 403s before the
  // handler attaches never fires onError either, so it advances here too.
  const photoRef = useCallback((node: HTMLImageElement | null) => {
    if (!node || !node.complete) return;
    if (node.naturalWidth > 0) {
      markImageReady(node.currentSrc || node.src);
      setPhotoState((s) => (s.loaded ? s : { ...s, loaded: true }));
    } else {
      setPhotoState((s) => ({ key: s.key, n: s.n + 1, loaded: false }));
    }
  }, []);

  // The placeholder waits a beat for a photo in flight, so a cache-fast paint
  // never shows one frame of the initial before the crossfade.
  const [placeholderArmed, setPlaceholderArmed] = useState(() => !photoUrl);
  useEffect(() => {
    if (!photoUrl || photoState.loaded) {
      setPlaceholderArmed(!photoUrl);
      return;
    }
    setPlaceholderArmed(false);
    const t = setTimeout(() => setPlaceholderArmed(true), 100);
    return () => clearTimeout(t);
  }, [photoUrl, photoState.loaded]);

  useEffect(() => {
    if (staticOnly) return;
    let active = true;

    // Only reach for the network when the props genuinely left a hole.
    if (frontIsIncomplete(snapshot, leagueId)) {
      fetchFront(player.id, leagueId).then((front) => {
        if (!active || !front) return;
        const merged: Snapshot = {
          player: { ...front.player, ...stripUndefined(snapshot.player) },
          ownership: snapshot.ownership !== undefined ? snapshot.ownership : front.ownership,
        };
        // Cache the filled-in version, or every reopen refetches the same thing.
        primeFront(merged.player, leagueId, merged.ownership);
        setSnapshot(merged);
      });
    } else {
      primeFront(snapshot.player, leagueId, resolvedOwnership);
    }

    if (selfFetch && !getCachedBack(player.id, leagueId)) {
      fetchBack(player.id, leagueId).then((data) => {
        if (active && data) setOwnBack(data);
      });
    }

    return () => {
      active = false;
    };
    // Keyed on the player, not the snapshot: refetching on every merge would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, leagueId, staticOnly]);

  // ── Tilt, holo and sheen. Refs and classes, not state, so a hover never
  // re-renders the card. Mouse tilts on hover as shipped; a finger tilts on a
  // sideways drag and springs back on release. ─────────────────────────────
  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const tiltTo = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card || reduceMotion.current) return;
    const rect = stage.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    card.style.transform = `rotateX(${(0.5 - py) * 12}deg) rotateY(${(px - 0.5) * 16}deg)`;
    const gx = `${(px - 0.5) * 30}%`;
    const gy = `${(py - 0.5) * 30}%`;
    const holo = holoRef.current;
    if (holo) {
      holo.style.setProperty('--mx', `${px * 100}%`);
      holo.style.setProperty('--my', `${py * 100}%`);
      holo.style.setProperty('--gx', gx);
      holo.style.setProperty('--gy', gy);
      holo.style.setProperty('--rot', `${45 + (px - 0.5) * 30}deg`);
    }
    sheenRef.current?.style.setProperty('--gx', gx);
    sheenRef.current?.style.setProperty('--gy', gy);
  }, []);

  const release = useCallback(() => {
    const stage = stageRef.current;
    if (cardRef.current) cardRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
    sheenRef.current?.style.setProperty('--gx', '0%');
    sheenRef.current?.style.setProperty('--gy', '0%');
    stage?.classList.remove(styles.live, styles.drag);
  }, []);

  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') stageRef.current?.classList.add(styles.live);
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') release();
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    stageRef.current?.classList.add(styles.live, styles.drag);
    tiltTo(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || stageRef.current?.classList.contains(styles.drag)) {
      tiltTo(e.clientX, e.clientY);
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') release();
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const teamColor = clubColor(resolvedPlayer.pl_team);
  const teamColor2 = clubColor2(resolvedPlayer.pl_team);
  const primaryPos = resolvedPlayer.primary_position || 'N/A';
  const ranks = seasonView?.position_ranks ?? resolvedPlayer.position_ranks ?? [];
  const rankOf = (pos: string) => ranks.find((r) => r.position === pos)?.rank ?? null;

  const wantedSlot = (controlledSlot ?? ownSlot) || primaryPos;
  const slot = rankOf(wantedSlot) != null || wantedSlot === primaryPos ? wantedSlot : primaryPos;
  const slotRank = rankOf(slot);
  const pickSlot = (pos: string) => {
    if (onSlotChange) onSlotChange(pos);
    else setOwnSlot(pos);
  };

  const posLong = primaryPos === 'N/A' && slot === primaryPos ? 'Unassigned Position' : (POS_LONG[slot] ?? slot);
  const posVar = POS_CSS_VAR[slot] ?? 'var(--color-accent-green)';

  // Points and PPG at the selected slot. At the primary slot the stored totals
  // stand (the live row, or the archive row for a past season) so the default
  // card never drifts; at a secondary slot they're re-scored from the log.
  let totalPts: number | null = seasonView ? seasonView.total_points : resolvedPlayer.total_points;
  let ppg: number | null = seasonView ? seasonView.ppg : resolvedPlayer.ppg;
  if (slot !== primaryPos) {
    if (back) {
      const played = appearances(back.gamelog);
      const pts = played.reduce((sum, g) => sum + pointsAtSlot(g, slot), 0);
      totalPts = pts;
      ppg = played.length > 0 ? Math.round((pts / played.length) * 100) / 100 : 0;
    } else {
      totalPts = null;
      ppg = null;
    }
  }
  const overallRank = seasonView ? seasonView.overall_rank : resolvedPlayer.overall_rank;

  const figures: SeasonFigure[] | null =
    back && appearances(back.gamelog).length > 0 ? seasonFigures(primaryPos, back.gamelog) : null;

  const photoShowing = !!photoUrl && photoState.loaded;
  const showPlaceholder = !photoShowing && placeholderArmed;

  // Resolved by club NAME, never by pl_team_id: FPL reassigns those ids every
  // season, which is how this card once rendered Spurs' badge for West Ham.
  const badgePath = clubBadgePath(resolvedPlayer.pl_team);
  const fullName = getPlayerDisplayName(resolvedPlayer, 'full');
  const { first: firstName, last: webName } = getPlayerDisplayName(resolvedPlayer, 'split');
  const injury = injuryStatus(resolvedPlayer.fpl_status, resolvedPlayer.fpl_news);
  const positions = [resolvedPlayer.primary_position, ...(resolvedPlayer.secondary_positions ?? [])]
    .filter((p): p is NonNullable<typeof p> => !!p);

  const stageVars = {
    '--team': teamColor,
    ...(teamColor2 ? { '--team2': teamColor2 } : {}),
    '--pos-color': posVar,
  } as React.CSSProperties;

  return (
    <div className={`${styles.container} g-theme-light`}>
      {onOpen && (
        <div className={styles.openRow}>
          <button type="button" className={styles.openBtn} onClick={onOpen} aria-label={`Open ${fullName}`}>
            <OpenIcon />
          </button>
        </div>
      )}

      <div
        className={styles.stage}
        ref={stageRef}
        style={stageVars}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div className={styles.shadow} />

        <div className={styles.card} ref={cardRef}>
          <div className={styles.face}>
            {/* Top bar */}
            <div className={styles.masthead}>
              <div className={styles.who}>
                {badgePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={badgePath}
                    alt={resolvedPlayer.pl_team}
                    className={styles.clubCrest}
                    width={26}
                    height={26}
                    decoding="sync"
                    fetchPriority="high"
                  />
                ) : (
                  <div className={styles.crest} style={{ background: teamColor }}>
                    {resolvedPlayer.pl_team.charAt(0)}
                  </div>
                )}
                <div className={styles.whoNames}>
                  <span className={styles.fullName}>{fullName}</span>
                  <span className={styles.clubName}>{resolvedPlayer.pl_team}</span>
                </div>
              </div>
              <div className={styles.ownerSlot}>
                {resolvedOwnership && (
                  resolvedOwnership.loanedTo ? (
                    <div
                      className={styles.loanCrests}
                      title={`On loan from ${resolvedOwnership.owner.teamName} to ${resolvedOwnership.loanedTo.teamName}`}
                    >
                      <SquadPeekButton
                        teamId={resolvedOwnership.owner.teamId}
                        teamName={resolvedOwnership.owner.teamName}
                        className={styles.loanCrestCol}
                        title={`${resolvedOwnership.owner.teamName}: view squad`}
                      >
                        <CrestBadge
                          config={resolvedOwnership.owner.crestConfig as CrestConfig | null}
                          size={20}
                          teamName={resolvedOwnership.owner.teamName}
                        />
                        <span className={styles.loanRole}>Lender</span>
                      </SquadPeekButton>
                      <span className={styles.loanArrow} aria-hidden="true">→</span>
                      <SquadPeekButton
                        teamId={resolvedOwnership.loanedTo.teamId}
                        teamName={resolvedOwnership.loanedTo.teamName}
                        className={styles.loanCrestCol}
                        title={`${resolvedOwnership.loanedTo.teamName}: view squad`}
                      >
                        <CrestBadge
                          config={resolvedOwnership.loanedTo.crestConfig as CrestConfig | null}
                          size={20}
                          teamName={resolvedOwnership.loanedTo.teamName}
                        />
                        <span className={styles.loanRole}>On Loan</span>
                      </SquadPeekButton>
                    </div>
                  ) : (
                    // "Who owns him?" and "what else have they got?" are one
                    // question asked twice; the crest answers both.
                    <SquadPeekButton
                      teamId={resolvedOwnership.owner.teamId}
                      teamName={resolvedOwnership.owner.teamName}
                      className={styles.ownerCrest}
                      title={`${resolvedOwnership.owner.teamName}: view squad`}
                    >
                      <CrestBadge
                        config={resolvedOwnership.owner.crestConfig as CrestConfig | null}
                        size={25}
                        teamName={resolvedOwnership.owner.teamName}
                      />
                    </SquadPeekButton>
                  )
                )}
              </div>
            </div>

            {/* Photo window */}
            <div className={`${styles.window} ${teamColor2 ? styles.twoTone : ''}`}>
              <div className={styles.spine}>
                <span className={styles.spineText}>{posLong}</span>
              </div>

              {injury && (
                <div
                  className={`${styles.injuryStamp} ${injury.doubtful ? styles.injuryDoubtful : styles.injuryOut}`}
                  aria-label={injury.aria}
                  tabIndex={injury.news ? 0 : undefined}
                >
                  <span className={styles.injuryDot} aria-hidden="true" />
                  <span className={styles.injuryLabel}>{injury.label}</span>
                  {injury.news && (
                    <span className={styles.injuryTip} role="tooltip">{injury.news}</span>
                  )}
                </div>
              )}

              <div className={styles.photoSlot}>
                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photoUrl}
                    ref={photoRef}
                    src={photoUrl}
                    alt={fullName}
                    className={`${styles.photo} ${photoState.n > 0 ? styles.photoAlt : ''} ${photoState.loaded ? styles.photoLoaded : ''}`}
                    width={196}
                    height={250}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      markImageReady(e.currentTarget.currentSrc || e.currentTarget.src);
                      setPhotoState((s) => (s.loaded ? s : { ...s, loaded: true }));
                    }}
                    onError={advancePhoto}
                  />
                )}
                {/* Stays mounted and fades out as the photo fades in, so the
                    window never flashes through a transparent cut-out. */}
                <div
                  className={`${styles.photoPlaceholder} ${showPlaceholder ? '' : styles.photoPlaceholderHidden}`}
                  aria-hidden="true"
                >
                  {playerInitial(resolvedPlayer)}
                </div>
              </div>

              {figures && (
                <div className={styles.figures} key={figures.map((f) => f.value).join('|')}>
                  {figures.map((f) => (
                    <div key={f.label}>
                      <span className={styles.figureValue}>{f.value}</span>
                      <span className={`${styles.figureLabel} ${f.label === 'xGI' ? styles.figureLabelAsIs : ''}`}>
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.sheen} ref={sheenRef} />
            </div>

            {/* Identity */}
            <div className={styles.identity}>
              {slotRank != null && (
                <div
                  className={styles.rankBadge}
                  style={{ '--slot': posVar } as React.CSSProperties}
                  role="img"
                  aria-label={`Ranked ${slotRank} at ${slot}`}
                >
                  <span className={styles.rankValue}>#{slotRank}</span>
                  <span className={styles.rankPos}>{slot}</span>
                </div>
              )}
              <div className={styles.names}>
                {firstName && <span className={styles.firstName}>{firstName}</span>}
                <span className={styles.lastName}>{webName}</span>
              </div>
              <div className={styles.meta}>
                {positions.length === 0 && (
                  <span className={styles.tag} style={{ '--tag': 'var(--color-text-muted)' } as React.CSSProperties}>N/A</span>
                )}
                {positions.map((pos) => {
                  const rank = rankOf(pos);
                  const tagVar = { '--tag': POS_CSS_VAR[pos] ?? 'var(--color-text-muted)' } as React.CSSProperties;
                  if (rank == null || staticOnly) {
                    return <span key={pos} className={styles.tag} style={tagVar}>{pos}</span>;
                  }
                  const on = pos === slot;
                  return (
                    <button
                      key={pos}
                      type="button"
                      className={`${styles.tag} ${styles.tagBtn} ${on ? styles.tagOn : ''}`}
                      style={tagVar}
                      aria-pressed={on}
                      aria-label={`Score as ${pos}, rank ${rank}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        pickSlot(pos);
                      }}
                    >
                      {pos}
                    </button>
                  );
                })}
                {resolvedPlayer.nationality && (
                  <><span className={styles.dot}>·</span><span>{resolvedPlayer.nationality}</span></>
                )}
                {resolvedPlayer.date_of_birth && (
                  <><span className={styles.dot}>·</span><span>Age {calcAge(resolvedPlayer.date_of_birth)}</span></>
                )}
                {resolvedPlayer.height_cm && (
                  <><span className={styles.dot}>·</span><span>{cmToFeet(resolvedPlayer.height_cm)}</span></>
                )}
              </div>
            </div>

            {/* Stats strip */}
            <div className={styles.strip}>
              <div className={styles.cell}>
                <span className={`${styles.cellValue} ${styles.gold}`}>
                  {resolvedPlayer.market_value != null ? `€${resolvedPlayer.market_value}m` : 'n/a'}
                </span>
                <span className={styles.cellLabel}>Value</span>
              </div>
              <div className={styles.cell}>
                <span className={`${styles.cellValue} ${styles.green}`}>
                  {totalPts != null ? Number(totalPts).toFixed(0) : 'n/a'}
                </span>
                <span className={styles.cellLabel}>Pts</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.cellValue}>{ppg != null ? Number(ppg).toFixed(2) : 'n/a'}</span>
                <span className={styles.cellLabel}>PPG</span>
              </div>
              <div className={styles.cell}>
                <span className={styles.cellValue}>{overallRank != null ? `#${overallRank}` : 'n/a'}</span>
                <span className={styles.cellLabel}>OVR</span>
              </div>
            </div>

            <div className={styles.holo} ref={holoRef}>
              <div className={styles.holoShimmer} />
              <div className={styles.holoGrid} />
              <div className={styles.holoGlare} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
