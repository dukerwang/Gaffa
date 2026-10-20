'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPosition, type Placement } from './internal/useAnchoredPosition';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** Short, Title Case or a fragment. A tooltip is a name, not a paragraph. */
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: Extract<Placement, 'top' | 'bottom'>;
  /** Wait before the first tooltip appears. Later ones in the same sweep skip it. */
  delay?: number;
  disabled?: boolean;
}

/**
 * Module-level, so every tooltip on the page shares one "warm" state: once one
 * has shown, moving to the next within WARM_MS opens it instantly and without
 * a transition. A toolbar of icon buttons then reads as one control.
 */
const WARM_MS = 600;
let lastHiddenAt = 0;
let openCount = 0;

/**
 * Gaffa UI Primitive: Tooltip
 *
 * Names an icon-only control for a mouse or keyboard user. Never put
 * information here that a touch user needs: touch never opens it.
 */
export function Tooltip({ content, children, placement = 'top', delay = 450, disabled = false }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const position = useAnchoredPosition(anchor, floating, open, placement, 8);

  const show = () => {
    if (disabled) return;
    window.clearTimeout(timer.current);
    const warm = openCount > 0 || Date.now() - lastHiddenAt < WARM_MS;
    if (warm) {
      setInstant(true);
      setOpen(true);
      return;
    }
    timer.current = window.setTimeout(() => {
      setInstant(false);
      setOpen(true);
    }, delay);
  };

  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    openCount += 1;
    return () => {
      openCount -= 1;
      lastHiddenAt = Date.now();
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <span
        ref={setAnchor}
        className={styles.anchor}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
        onPointerLeave={hide}
        // A press commits the action; the label has done its job.
        onPointerDown={hide}
        onFocus={(e) => e.target.matches(':focus-visible') && show()}
        onBlur={hide}
      >
        {children}
      </span>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={setFloating}
            id={id}
            role="tooltip"
            data-side={position?.side ?? placement}
            data-instant={instant || undefined}
            className={styles.tooltip}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? undefined : 'hidden',
              ['--tooltip-origin' as string]: position?.origin ?? 'center',
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

export default Tooltip;
