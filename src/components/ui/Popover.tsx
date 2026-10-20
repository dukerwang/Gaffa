'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPosition, type Placement } from './internal/useAnchoredPosition';
import { usePresence } from './internal/usePresence';
import styles from './Popover.module.css';

export interface PopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  open: boolean;
  onClose: () => void;
  /** The element the popover grows out of. Clicks on it never count as "outside". */
  anchor: HTMLElement | null;
  placement?: Placement;
  /** At least as wide as the anchor, for a listbox under a field. */
  matchAnchorWidth?: boolean;
  /** Return focus to the anchor on Escape. On by default. */
  restoreFocus?: boolean;
  children: React.ReactNode;
  /** Receives the floating element once it mounts, e.g. to focus a list inside it. */
  onMount?: (el: HTMLDivElement) => void;
}

/** Exit is shorter than entry: the system is responding, not presenting. */
const EXIT_MS = 120;

/**
 * Gaffa UI Primitive: Popover
 *
 * The floating surface under Select and Menu, exported for one-off panels
 * (a filter, a quick explainer). It scales in from the trigger, not from its
 * own centre, flips above the trigger near the bottom of the screen, and
 * closes on Escape or a press anywhere else.
 *
 * Escape is caught on the window in the capture phase and stopped there, so
 * a popover open inside a ResponsiveModal closes itself without also closing
 * the modal beneath it.
 */
export function Popover({
  open,
  onClose,
  anchor,
  placement = 'bottom-start',
  matchAnchorWidth = false,
  restoreFocus = true,
  children,
  className,
  style,
  onMount,
  ...rest
}: PopoverProps) {
  const { mounted, state } = usePresence(open, EXIT_MS);
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  const position = useAnchoredPosition(anchor, floating, mounted, placement);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  useEffect(() => {
    if (floating) onMountRef.current?.(floating);
  }, [floating]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onCloseRef.current();
      if (restoreFocus) anchor?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (floating?.contains(target) || anchor?.contains(target)) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open, anchor, floating, restoreFocus]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={setFloating}
      data-state={state}
      data-side={position?.side ?? 'bottom'}
      className={[styles.popover, className].filter(Boolean).join(' ')}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        minWidth: matchAnchorWidth && position ? position.anchorWidth : undefined,
        // Unplaced, it is still invisible through the closed state's opacity.
        // Not visibility: hidden, which would refuse the focus a listbox needs
        // on its first frame.
        ['--popover-origin' as string]: position?.origin ?? 'top left',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}

export default Popover;
