'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import NavigationLink from '@/components/ui/NavigationLink';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import type { Player, PlayerOwnership } from '@/types';
import { type CardBack, fetchBack, getCachedBack } from '@/lib/players/cardCache';
import { seasonLabel, seasonOptions } from '@/lib/players/cardSeason';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { clubBadgePath, clubColor } from '@/lib/clubs/registry';
import PremiumPlayerCard, { POS_CSS_VAR, type CardSeasonView } from './PremiumPlayerCard';
import PlayerCardStats from './PlayerCardStats';
import PlayerCardScouting from './PlayerCardScouting';
import styles from './PlayerDetailsModal.module.css';

/**
 * The player card, opened. Ported from the approved Player Card 2.0 prototype.
 *
 * Desktop (900px and up): a dialog. The card sits on a field in the club's
 * colour on the left and never leaves the screen; Stats and Scouting change in
 * the panel beside it.
 *
 * Phone: a bottom sheet. The card leads; scroll past it and a strip with the
 * name and rank takes its place at the top, so the player is never off screen.
 *
 * One season menu in the header sets the season for the card and the panel
 * together, so nothing on screen can show two seasons at once.
 */

interface Props {
  player: Player | null;
  /** `undefined` lets the card resolve it; `null` means known free agent. */
  ownership?: PlayerOwnership | null;
  onClose: () => void;
  /** Shows a Draft Pick action. */
  onPick?: (player: Player) => void;
  /** Shows a Nominate action. */
  onNominate?: (player: Player) => void;
  /** Opens on the Stats view with this gameweek's game-log row expanded. */
  focusGameweek?: number | null;
  /** Opens the card scored at this slot. */
  focusPosition?: string | null;
}

type Tab = 'stats' | 'scout';

const DESKTOP_QUERY = '(min-width: 900px)';
/** Height of the sheet's top strip; the tab bar sticks under it. */
const CHROME_HEIGHT = 52;

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY).matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function PlayerDetailsModal(props: Props) {
  if (!props.player) return null;
  // Keyed on the player so switching subjects starts clean: tab, season, slot.
  return <PlayerCardShell key={props.player.id} {...props} player={props.player} />;
}

function PlayerCardShell({
  player,
  ownership,
  onClose,
  onPick,
  onNominate,
  focusGameweek,
  focusPosition,
}: Props & { player: Player }) {
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;
  const desktop = useIsDesktop();

  const [tab, setTab] = useState<Tab>('stats');
  const [season, setSeason] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>(
    () => focusPosition?.toUpperCase() || player.primary_position || 'N/A',
  );
  const [resolved, setResolved] = useState<{ player: Player; ownership: PlayerOwnership | null }>(() => ({
    player,
    ownership: ownership ?? null,
  }));
  const onResolve = useCallback((p: Player, o: PlayerOwnership | null) => {
    setResolved((prev) => (prev.player === p && prev.ownership === o ? prev : { player: p, ownership: o }));
  }, []);

  // ── Seasons ───────────────────────────────────────────────────────────────
  // The server resolves the default season; its payload lists the archive, so
  // the season menu costs no request of its own. A past season is fetched only
  // when it's picked or hovered in the menu.
  const [currentBack, setCurrentBack] = useState<CardBack | null>(() => getCachedBack(player.id, leagueId));
  const [seasonBacks, setSeasonBacks] = useState<Record<string, CardBack>>({});

  useEffect(() => {
    let active = true;
    if (!currentBack) {
      fetchBack(player.id, leagueId).then((data) => {
        if (active && data) setCurrentBack(data);
      });
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, leagueId]);

  const currentSeason = currentBack?.season ?? null;
  const selected = season ?? currentSeason;
  const isCurrent = season == null || season === currentSeason;
  const selectedBack: CardBack | null = isCurrent
    ? currentBack
    : seasonBacks[season!] ?? getCachedBack(player.id, leagueId, season) ?? null;
  const options = seasonOptions(currentBack);

  const loadSeason = useCallback(
    (s: string) => {
      if (s === currentSeason) return;
      fetchBack(player.id, leagueId, s).then((data) => {
        if (data) setSeasonBacks((prev) => (prev[s] ? prev : { ...prev, [s]: data }));
      });
    },
    [currentSeason, player.id, leagueId],
  );

  const archiveRow = !isCurrent ? currentBack?.history.find((h) => h.season === season) ?? null : null;
  const seasonView: CardSeasonView | undefined = archiveRow
    ? {
        total_points: archiveRow.total_points != null ? Number(archiveRow.total_points) : null,
        ppg: archiveRow.ppg != null ? Number(archiveRow.ppg) : null,
        overall_rank: archiveRow.overall_rank ?? null,
        position_ranks: archiveRow.position_ranks ?? null,
      }
    : undefined;

  // ── Slot: tags pick it; a slot the selected season can't rank falls back ──
  const primary = resolved.player.primary_position || 'N/A';
  const ranks = seasonView?.position_ranks ?? resolved.player.position_ranks ?? [];
  const effectiveSlot = ranks.some((r) => r.position === slot) || slot === primary ? slot : primary;
  const slotRank = ranks.find((r) => r.position === effectiveSlot)?.rank ?? null;

  // ── Menu ──────────────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const pickSeason = (s: string) => {
    setMenuOpen(false);
    if (s === selected) return;
    setSeason(s === currentSeason ? null : s);
    loadSeason(s);
  };

  // ── Page behind: locked, and Escape defers to a layer above (squad peek) ──
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.playerCardOpen = 'true';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.body.dataset.squadPeekOpen) return;
      if (menuRef.current?.dataset.open === 'true') {
        setMenuOpen(false);
        return;
      }
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      delete document.body.dataset.playerCardOpen;
    };
  }, []);

  // A text drag that ends on the scrim must not close the card: both the press
  // and the click have to land on the scrim itself.
  const scrimDown = useRef(false);

  // ── Tabs ink ──────────────────────────────────────────────────────────────
  const tabsRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    const ink = inkRef.current;
    if (!active || !ink) return;
    ink.style.width = `${active.offsetWidth}px`;
    ink.style.transform = `translateX(${active.offsetLeft}px)`;
  }, [tab, desktop]);

  // ── Phone: compact strip once the card has scrolled under the top ────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrolledPast, setScrolledPast] = useState(false);
  useEffect(() => {
    if (desktop || !scrollRef.current || !heroRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolledPast(!entry.isIntersecting),
      { root: scrollRef.current, rootMargin: `-${CHROME_HEIGHT}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(heroRef.current);
    return () => io.disconnect();
  }, [desktop]);

  // A tab or season change on the phone keeps the tabs in view rather than
  // leaving the reader mid-way down a list that just changed under them.
  const tabbarRef = useRef<HTMLDivElement>(null);
  const keepTabsInView = () => {
    const sc = scrollRef.current;
    const bar = tabbarRef.current;
    if (!sc || !bar) return;
    const stuckAt = bar.offsetTop - CHROME_HEIGHT;
    if (sc.scrollTop > stuckAt) sc.scrollTop = stuckAt;
  };
  const pickTab = (t: Tab) => {
    setTab(t);
    if (desktop) bodyRef.current?.scrollTo({ top: 0 });
    else keepTabsInView();
  };
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── Phone: drag the top strip down to dismiss ────────────────────────────
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const onGripDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const onGripMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !sheetRef.current) return;
    const raw = e.clientY - d.y;
    // Rubber-band upward: the sheet resists rather than hitting a wall.
    d.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
    sheetRef.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onGripUp = () => {
    const d = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!d || !sheet) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    sheet.style.transition = '';
    if (d.dy > sheet.offsetHeight * 0.25 || (d.dy > 24 && velocity > 0.5)) {
      sheet.style.transform = 'translateY(100%)';
      window.setTimeout(() => onCloseRef.current(), 200);
    } else {
      sheet.style.transform = '';
    }
  };

  // ── Pieces ────────────────────────────────────────────────────────────────
  const card = (
    <PremiumPlayerCard
      player={player}
      ownership={ownership}
      slot={effectiveSlot}
      onSlotChange={setSlot}
      back={selectedBack}
      seasonView={seasonView}
      onResolve={onResolve}
    />
  );

  const tabs = (
    <div className={styles.tabs} role="tablist" ref={tabsRef}>
      <span className={styles.ink} ref={inkRef} aria-hidden="true" />
      {(['stats', 'scout'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          className={styles.tab}
          aria-selected={tab === t}
          onClick={() => pickTab(t)}
        >
          {t === 'stats' ? 'Stats' : 'Scouting'}
        </button>
      ))}
    </div>
  );

  const seasonMenu = options.length > 0 && selected && (
    <div className={styles.seasonWrap} ref={menuRef} data-open={menuOpen ? 'true' : 'false'}>
      <button
        type="button"
        className={styles.seasonBtn}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {seasonLabel(selected)}
        <Chevron />
      </button>
      <div className={styles.menu} role="menu" aria-label="Season">
        {options.map((s) => {
          const on = s === selected;
          const row = s === currentSeason ? null : currentBack?.history.find((h) => h.season === s);
          const pts = s === currentSeason ? resolved.player.total_points : row?.total_points;
          return (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              className={styles.menuItem}
              onPointerEnter={() => loadSeason(s)}
              onFocus={() => loadSeason(s)}
              onClick={() => {
                pickSeason(s);
                if (!desktop) keepTabsInView();
              }}
            >
              <i aria-hidden="true">{on ? '✓' : ''}</i>
              <b>{seasonLabel(s)}</b>
              <em>
                {pts != null ? `${Math.round(Number(pts))} pts` : ''}
                {s === currentSeason ? '' : ' · Final'}
              </em>
            </button>
          );
        })}
      </div>
    </div>
  );

  const views = (
    <>
      <div className={styles.view} hidden={tab !== 'stats'}>
        <PlayerCardStats
          back={selectedBack}
          isCurrent={isCurrent}
          slot={effectiveSlot}
          primary={primary}
          focusGameweek={focusGameweek}
        />
      </div>
      {/* Mounted on first visit only: the Scouting route is never called for a
          card nobody turned to. */}
      {tab === 'scout' && (
        <div className={styles.view}>
          <PlayerCardScouting playerId={player.id} leagueId={leagueId} season={selected} isCurrent={isCurrent} />
        </div>
      )}
    </>
  );

  const owner = resolved.ownership?.owner ?? null;
  const footer = (
    <div className={styles.foot}>
      <span className={styles.owner}>
        {owner ? (
          <>
            <CrestBadge
              config={owner.crestConfig as CrestConfig | null}
              size={20}
              teamName={owner.teamName}
              interactive={false}
            />
            <span>{owner.teamName}</span>
          </>
        ) : (
          <span className={styles.free}>Free Agent</span>
        )}
      </span>
      {leagueId && (
        <NavigationLink
          href={`/league/${leagueId}/players/${player.id}`}
          onClick={onClose}
          className={styles.ghost}
        >
          Full Profile
        </NavigationLink>
      )}
      {onPick && (
        <button type="button" className={styles.primary} onClick={() => { onPick(player); onClose(); }}>
          Draft Pick
        </button>
      )}
      {onNominate && (
        <button type="button" className={styles.primary} onClick={() => { onNominate(player); onClose(); }}>
          Nominate
        </button>
      )}
    </div>
  );

  const name = getPlayerDisplayName(resolved.player, 'full');
  const { last } = getPlayerDisplayName(resolved.player, 'split');
  const badge = clubBadgePath(resolved.player.pl_team);
  const slotVar = POS_CSS_VAR[effectiveSlot] ?? 'var(--color-accent)';
  const teamStyle = { '--team': clubColor(resolved.player.pl_team) } as React.CSSProperties;

  return (
    <div
      className={`${styles.overlay} ${desktop ? styles.overlayDesktop : styles.overlaySheet}`}
      onPointerDown={(e) => {
        scrimDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (scrimDown.current && e.target === e.currentTarget) onClose();
        scrimDown.current = false;
      }}
    >
      {desktop ? (
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={name} style={teamStyle}>
          <div className={styles.field}>{card}</div>
          <div className={styles.panel}>
            <div className={styles.head}>
              {tabs}
              {seasonMenu}
              <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <div className={styles.body} ref={bodyRef}>{views}</div>
            {footer}
          </div>
        </div>
      ) : (
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={name} style={teamStyle} ref={sheetRef}>
          <div
            className={`${styles.chrome} ${scrolledPast ? styles.chromeSolid : ''}`}
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
          >
            <span className={styles.grip} aria-hidden="true" />
            <div className={styles.mini} aria-hidden={!scrolledPast}>
              {badge && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={badge} alt="" width={22} height={22} />
              )}
              <b>{last}</b>
              {slotRank != null && (
                <i style={{ color: slotVar }}>#{slotRank} {effectiveSlot}</i>
              )}
            </div>
            <button type="button" className={`${styles.close} ${styles.closeOnField}`} onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className={styles.scroll} ref={scrollRef}>
            <div className={styles.field}>
              <div className={styles.fit} ref={heroRef}>{card}</div>
            </div>
            <div className={styles.tabbar} ref={tabbarRef}>
              {tabs}
              {seasonMenu}
            </div>
            <div className={styles.sheetBody}>{views}</div>
          </div>
          {footer}
        </div>
      )}
    </div>
  );
}
