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
}

const CARD_WIDTH = 348;
const SPOT_PADDING = 6;
/** Clear of the sticky top bar when a target is scrolled into place. */
const SCROLL_OFFSET = 96;
const PHONE = '(max-width: 640px)';

function sameBox(a: Box | null, b: Box) {
  return !!a && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function stepAvailable(step: WalkthroughStep, phone: boolean) {
  if ((step.desktopOnly && phone) || (step.phoneOnly && !phone)) return false;
  return !step.at || !!step.fallback || !!findTarget(step.at);
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

  // Bring the target into view once per step, then follow it. The page can
  // still reflow underneath (images, live scores), so the rect is re-read every
  // frame while a walkthrough is open.
  useLayoutEffect(() => {
    if (!step.at) return;
    const first = findTarget(step.at);
    if (first) {
      const r = first.getBoundingClientRect();
      const fits = r.height < window.innerHeight * 0.55;
      if (r.top < SCROLL_OFFSET || r.bottom > window.innerHeight * (fits ? 0.6 : 1)) {
        window.scrollBy({ top: r.top - SCROLL_OFFSET });
      }
    }
    let raf = 0;
    const follow = () => {
      const el = step.at ? findTarget(step.at) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        const next = {
          left: r.left - SPOT_PADDING,
          top: r.top - SPOT_PADDING,
          width: r.width + SPOT_PADDING * 2,
          height: r.height + SPOT_PADDING * 2,
        };
        setSpot((prev) => (sameBox(prev, next) ? prev : next));
      } else {
        setSpot(null);
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
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
  let cardStyle: CSSProperties | undefined;
  if (shownSpot && !phone) {
    const below = shownSpot.top + shownSpot.height + 280 < window.innerHeight;
    cardStyle = {
      left: Math.max(16, Math.min(shownSpot.left, window.innerWidth - CARD_WIDTH - 16)),
      top: below ? shownSpot.top + shownSpot.height + 10 : shownSpot.top - 10,
      transform: below ? undefined : 'translateY(-100%)',
    };
  }

  return createPortal(
    <div className={styles.root}>
      {shownSpot ? <div className={styles.spot} style={shownSpot} /> : <div className={styles.scrim} />}
      {/* The page stays visible but can't be pressed while this is open. */}
      <div className={styles.shield} />
      <div className={centred ? `${styles.layer} ${styles.layerCentred}` : styles.layer}>
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
      </div>
    </div>,
    document.body,
  );
}
