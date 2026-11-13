'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import type { WalkthroughStep } from '@/lib/walkthroughs/chapters';
import { DiagramView } from './TimingDiagrams';
import styles from './Walkthrough.module.css';

interface Props {
  steps: WalkthroughStep[];
  /** Ended by Done or the close button. */
  onExit: () => void;
  /** Shown on the first step only, to leave every walkthrough at once. */
  onSkipAll?: () => void;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  /** In a fixed or sticky header: measured against the viewport, not the page. */
  pinned: boolean;
}

const CARD_WIDTH = 348;
const SPOT_PADDING = 6;
/** Clear of the sticky top bar when a target is scrolled into place. */
const SCROLL_OFFSET = 96;
const PHONE = '(max-width: 640px)';

function sameBox(a: Box | null, b: Box) {
  return !!a && a.pinned === b.pinned && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function stepAvailable(step: WalkthroughStep, phone: boolean) {
  if ((step.desktopOnly && phone) || (step.phoneOnly && !phone)) return false;
  return !step.at || !!step.fallback || !!findTarget(step.at);
}

function isPinned(el: HTMLElement) {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const position = getComputedStyle(n).position;
    if (position === 'fixed' || position === 'sticky') return true;
  }
  return false;
}

export function findTarget(at: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${at}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/**
 * One walkthrough, drawn over the real page. It explains; it never acts. Next
 * and Back are the only controls, and the page underneath can't be clicked
 * while it's open.
 */
export default function Walkthrough({ steps, onExit, onSkipAll }: Props) {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  // Availability is read when a step is reached, not up front: a page's rows
  // can arrive after the walkthrough has started.
  const [index, setIndex] = useState(() => Math.max(0, steps.findIndex((s) => stepAvailable(s, window.matchMedia(PHONE).matches))));
  const [spot, setSpot] = useState<Box | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[Math.min(index, steps.length - 1)];
  const nextIndex = steps.findIndex((s, i) => i > index && stepAvailable(s, phone));
  const prevIndex = steps.reduce((found, s, i) => (i < index && stepAvailable(s, phone) ? i : found), -1);
  const last = nextIndex < 0;
  const targetMissing = !!step.at && !findTarget(step.at);
  const diagram = step.diagram ?? (targetMissing && step.fallback !== true ? step.fallback : undefined);

  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Bring the target into view once per step, then follow it when the page
  // reflows underneath (images, live scores) or the window resizes.
  useLayoutEffect(() => {
    if (!step.at) return;
    const first = findTarget(step.at);
    if (first) {
      // Inner scroll containers first (the lineup rail, the sub-nav), then the
      // window, with room for the sticky top bar.
      first.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = first.getBoundingClientRect();
      const fits = r.height < window.innerHeight * 0.55;
      if (r.top < SCROLL_OFFSET || r.bottom > window.innerHeight * (fits ? 0.6 : 1)) {
        window.scrollBy({ top: r.top - SCROLL_OFFSET });
      }
    }
    // The spotlight lives in page coordinates, so scrolling carries it with
    // the page and needs no measuring. Only a target in the sticky top bar is
    // measured against the viewport.
    let pinnedFor: HTMLElement | null = null;
    let pinned = false;
    let observed: HTMLElement | null = null;
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    const measure = () => {
      const el = step.at ? findTarget(step.at) : null;
      if (el) {
        if (el !== pinnedFor) {
          pinnedFor = el;
          pinned = isPinned(el);
        }
        const r = el.getBoundingClientRect();
        const dx = pinned ? 0 : window.scrollX;
        const dy = pinned ? 0 : window.scrollY;
        const next = {
          left: r.left + dx - SPOT_PADDING,
          top: r.top + dy - SPOT_PADDING,
          width: r.width + SPOT_PADDING * 2,
          height: r.height + SPOT_PADDING * 2,
          pinned,
        };
        setSpot((prev) => (sameBox(prev, next) ? prev : next));
        if (el !== observed) {
          if (observed) ro.unobserve(observed);
          ro.observe(el);
          observed = el;
        }
      } else {
        setSpot(null);
      }
    };
    // One frame for the scroll above to settle, then on every real change.
    const raf = requestAnimationFrame(measure);
    // A target can appear after the step does (rows that load late).
    const late = window.setInterval(() => { if (!observed) measure(); }, 500);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(late);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [step.at]);

  const finish = useCallback(() => onExit(), [onExit]);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const shownSpot = step.at && !targetMissing ? spot : null;
  const centred = !shownSpot;
  // Beside its target on a wide screen; on a phone, a sheet at the bottom.
  let cardStyle: CSSProperties | undefined;
  let spotStyle: CSSProperties | undefined;
  if (shownSpot) {
    const { pinned, ...box } = shownSpot;
    spotStyle = { ...box, position: pinned ? 'fixed' : 'absolute' };
    if (!phone) {
      const offsetY = pinned ? 0 : window.scrollY;
      const viewportTop = shownSpot.top - offsetY;
      const below = viewportTop + shownSpot.height + 280 < window.innerHeight;
      cardStyle = {
        position: pinned ? 'fixed' : 'absolute',
        left: Math.max(16, Math.min(shownSpot.left, window.innerWidth - CARD_WIDTH - 16)),
        top: below ? shownSpot.top + shownSpot.height + 10 : shownSpot.top - 10,
        transform: below ? undefined : 'translateY(-100%)',
      };
    }
  }
  const anchored = !!cardStyle;

  return createPortal(
    <div className={styles.root}>
      {spotStyle ? <div className={styles.spot} style={spotStyle} /> : <div className={styles.scrim} />}
      {/* The page stays visible but can't be pressed while this is open. */}
      <div className={styles.shield} />
      {(() => {
        const card = (
        <div
          key={index}
          ref={cardRef}
          className={diagram ? `${styles.card} ${styles.cardWide}` : styles.card}
          style={cardStyle}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
          tabIndex={-1}
        >
          <div className={styles.head}>
            <span className={styles.mark} aria-hidden="true"><Icon name="gaffa" size={24} /></span>
            <h2 className={styles.title}>{step.title}</h2>
            <button type="button" className={styles.close} aria-label="Close" onClick={finish}>
              <Icon name="x" size={16} strokeWidth={2} />
            </button>
          </div>
          {diagram && <div className={styles.diagram}><DiagramView diagram={diagram} /></div>}
          <p className={styles.body}>{step.body}</p>
          <div className={styles.foot}>
            <div className={styles.ticks} aria-hidden="true">
              {steps.map((s, i) => <i key={`${s.title}-${i}`} data-on={i <= index || undefined} />)}
            </div>
            {prevIndex >= 0 ? (
              <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setIndex(prevIndex)}>Back</button>
            ) : onSkipAll ? (
              <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={onSkipAll}>Skip All</button>
            ) : null}
            <button type="button" className={`${styles.btn} ${styles.go}`} onClick={() => (last ? finish() : setIndex(nextIndex))}>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
        );
        return anchored ? card : <div className={centred ? `${styles.layer} ${styles.layerCentred}` : styles.layer}>{card}</div>;
      })()}
    </div>,
    document.body,
  );
}
