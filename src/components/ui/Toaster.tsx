'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { subscribeToasts, toast as toastApi, type ToastRecord } from './toast';
import styles from './Toaster.module.css';

const VISIBLE = 3;
const GAP = 10;
/** Collapsed, each toast behind the front one peeks this far above it. */
const PEEK = 10;
const SWIPE_DISTANCE = 45;
/** px per ms. A flick this fast dismisses regardless of distance. */
const SWIPE_VELOCITY = 0.11;

/**
 * Gaffa UI Primitive: Toaster
 *
 * Mount once. Renders the toasts that `toast()` pushes as a stack: collapsed
 * behind the newest, fanning out while the pointer is over it or focus is
 * inside. Swipe a toast down or sideways to dismiss it; a quick flick is
 * enough. Timers pause while the stack is expanded and while the tab is
 * hidden, so nothing expires unread.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mountedPortal, setMountedPortal] = useState(false);

  useEffect(() => subscribeToasts(setToasts), []);
  useEffect(() => setMountedPortal(true), []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Collapse once the last toast goes, or the stack reopens expanded next time.
  useEffect(() => {
    if (!toasts.length) setExpanded(false);
  }, [toasts.length]);

  const setHeight = useCallback((id: string, h: number) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  if (!mountedPortal) return null;

  const live = toasts.filter((t) => !t.dismissing);
  const frontId = live[live.length - 1]?.id;
  const frontHeight = frontId ? heights[frontId] ?? 0 : 0;
  const stackHeight = live.reduce((sum, t) => sum + (heights[t.id] ?? 0) + GAP, 0);

  return createPortal(
    <section
      aria-label="Notifications"
      aria-live="polite"
      className={styles.region}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setExpanded(true)}
      onPointerLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setExpanded(false);
      }}
    >
      <ol
        className={styles.list}
        data-expanded={expanded || undefined}
        style={{ ['--stack-height' as string]: `${stackHeight}px` }}
      >
        {toasts.map((t) => {
          // Position from the front: 0 is the newest live toast.
          const liveIndex = live.indexOf(t);
          const index = liveIndex >= 0 ? live.length - 1 - liveIndex : 0;
          const offset = live
            .slice(liveIndex + 1)
            .reduce((sum, newer) => sum + (heights[newer.id] ?? 0) + GAP, 0);
          return (
            <ToastItem
              key={t.id}
              toast={t}
              index={index}
              expandedOffset={offset}
              frontHeight={frontHeight}
              ownHeight={heights[t.id]}
              expanded={expanded}
              paused={expanded || hidden}
              onHeight={setHeight}
            />
          );
        })}
      </ol>
    </section>,
    document.body,
  );
}

interface ToastItemProps {
  toast: ToastRecord;
  index: number;
  expandedOffset: number;
  frontHeight: number;
  ownHeight: number | undefined;
  expanded: boolean;
  paused: boolean;
  onHeight: (id: string, h: number) => void;
}

function ToastItem({ toast, index, expandedOffset, frontHeight, ownHeight, expanded, paused, onHeight }: ToastItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  const [mounted, setMounted] = useState(false);
  const [swipeOut, setSwipeOut] = useState<{ x: number; y: number } | null>(null);
  const remaining = useRef(toast.duration);
  const drag = useRef<{ x: number; y: number; t: number; axis: 'x' | 'y' | null; id: number } | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Measure the natural height with the collapsed clamp removed.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const prev = el.style.height;
      el.style.height = 'auto';
      onHeight(toast.id, el.getBoundingClientRect().height);
      el.style.height = prev;
    };
    measure();
  }, [toast.id, toast.title, toast.description, toast.action, onHeight]);

  // An updated toast (same id, new content) gets a fresh clock.
  useEffect(() => {
    remaining.current = toast.duration;
  }, [toast.duration, toast.title]);

  useEffect(() => {
    if (paused || toast.dismissing || toast.duration === Infinity) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => toastApi.dismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, toast.dismissing, toast.duration, toast.id, toast.title]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (drag.current || (e.target as HTMLElement).closest('button')) return;
    drag.current = { x: e.clientX, y: e.clientY, t: Date.now(), axis: null, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || e.pointerId !== d.id) return;
    let dx = e.clientX - d.x;
    let dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (d.axis === 'x') dy = 0;
    else {
      dx = 0;
      // Upward has nowhere to go: resist instead of stopping dead.
      if (dy < 0) dy = -Math.sqrt(-dy) * 2;
    }
    el.dataset.swiping = 'true';
    el.style.setProperty('--swipe-x', `${dx}px`);
    el.style.setProperty('--swipe-y', `${dy}px`);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const distance = d.axis === 'x' ? dx : d.axis === 'y' ? dy : 0;
    const velocity = Math.abs(distance) / Math.max(Date.now() - d.t, 1);
    delete el.dataset.swiping;
    if (d.axis && (d.axis === 'x' || distance > 0) && (Math.abs(distance) >= SWIPE_DISTANCE || velocity > SWIPE_VELOCITY)) {
      setSwipeOut(d.axis === 'x' ? { x: Math.sign(dx), y: 0 } : { x: 0, y: 1 });
      toastApi.dismiss(toast.id);
      return;
    }
    el.style.setProperty('--swipe-x', '0px');
    el.style.setProperty('--swipe-y', '0px');
  };

  const front = index === 0;
  const visible = index < VISIBLE;
  const lift = expanded ? expandedOffset : index * PEEK;
  const scale = expanded ? 1 : 1 - index * 0.05;

  return (
    <li
      ref={ref}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={styles.toast}
      data-variant={toast.variant}
      data-mounted={mounted || undefined}
      data-front={front || undefined}
      data-dismissing={toast.dismissing || undefined}
      data-swipe-out={swipeOut ? (swipeOut.x ? 'x' : 'y') : undefined}
      tabIndex={0}
      aria-hidden={!visible || undefined}
      style={
        {
          '--lift': `${-lift}px`,
          '--scale': scale,
          '--swipe-dir': swipeOut?.x ?? 0,
          zIndex: 100 - index,
          opacity: visible ? undefined : 0,
          // Collapsed, a toast behind the front takes the front's height, so the
          // stack reads as one card with edges peeking out above it. Explicit
          // heights both ways, because a transition cannot run to 'auto'.
          height: ownHeight === undefined ? undefined : !expanded && !front && frontHeight ? frontHeight : ownHeight,
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className={styles.content}>
        {toast.variant !== 'neutral' && (
          <span className={styles.glyph} aria-hidden="true">
            <Icon name={toast.variant === 'success' ? 'check' : 'alert'} size={14} strokeWidth={2.5} />
          </span>
        )}
        <div className={styles.text}>
          <p className={styles.title}>{toast.title}</p>
          {toast.description && <p className={styles.description}>{toast.description}</p>}
        </div>
        {toast.action && (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              toast.action?.onClick();
              toastApi.dismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss"
          onClick={() => toastApi.dismiss(toast.id)}
        >
          <Icon name="x" size={12} strokeWidth={2.5} />
        </button>
      </div>
    </li>
  );
}

export default Toaster;
