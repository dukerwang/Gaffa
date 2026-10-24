'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { usePresence } from './internal/usePresence';
import styles from './ResponsiveModal.module.css';

/** The sheet layout's breakpoint; must match the media query in the CSS. */
const SHEET_QUERY = '(max-width: 640px)';
/** Long enough for the sheet to leave the screen; the desktop exit is shorter. */
const EXIT_MS = 240;
/** px per ms. A downward flick this fast dismisses regardless of distance. */
const FLICK_VELOCITY = 0.11;

/** The further past the edge, the less the sheet follows. */
function rubberband(distance: number, dimension: number, constant = 0.55) {
  return (distance * dimension * constant) / (dimension + constant * distance);
}

function resetDragStyles(panel: HTMLElement | null, scrim: HTMLElement | null) {
  if (panel) {
    panel.style.transition = '';
    panel.style.transform = '';
  }
  if (scrim) {
    scrim.style.transition = '';
    scrim.style.opacity = '';
  }
}

export interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Rendered to the left of the title (e.g. crest, icon, badge) */
  lead?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider frame (e.g. for side-by-side builder views) */
  wide?: boolean;
  /** Applies standard content padding to the body container */
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
}

/**
 * Gaffa UI Primitive: ResponsiveModal
 *
 * Universal overlay container for modals and sheets across Gaffa.
 * - Desktop (>640px): Centered floating modal, shadow XOR border (Rule 7)
 * - Mobile (<=640px): Automatically docks as a bottom drawer with drag handle,
 *   92dvh max height, and safe-area-inset-bottom
 * - Scrim dismissal requires both mousedown and click on the backdrop to avoid
 *   accidental close on text drags or native selects
 * - Respects multi-overlay hierarchy (skips Esc if SquadPeek is active)
 * - Freezes body scroll while open and restores on unmount
 * - Plays its exit instead of vanishing: stays mounted EXIT_MS after `open`
 *   turns false. On mobile the sheet follows a drag on its handle or header
 *   1:1, resists being pulled up, and closes on a pull past a quarter of its
 *   height or on a downward flick of any length.
 */
export default function ResponsiveModal({
  open,
  onClose,
  title,
  lead,
  children,
  footer,
  wide = false,
  padded = false,
  className,
  bodyClassName,
}: ResponsiveModalProps) {
  const { mounted, state } = usePresence(open, EXIT_MS);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const scrimPointerDown = useRef(false);
  const drag = useRef<{ y: number; t: number; id: number; height: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      // If a nested layer like squad peek is open, defer to it
      // The player card and squad peek open above this; Escape is theirs first.
      if (document.body.dataset.squadPeekOpen || document.body.dataset.playerCardOpen) return;
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    // Reopened mid-exit after a drag dismissal: drop the drag's inline styles.
    resetDragStyles(panelRef.current, scrimRef.current);
    panelRef.current?.focus();
  }, [open, mounted]);

  const onDragStart = (e: React.PointerEvent) => {
    if (drag.current || !window.matchMedia(SHEET_QUERY).matches) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    const panel = panelRef.current;
    if (!panel) return;
    drag.current = { y: e.clientY, t: Date.now(), id: e.pointerId, height: panel.offsetHeight };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel || e.pointerId !== d.id) return;
    const raw = e.clientY - d.y;
    // Upward: the sheet is already fully open, so resist rather than follow.
    const dy = raw >= 0 ? raw : -rubberband(-raw, d.height);
    panel.style.transform = `translateY(${dy}px)`;
    if (scrimRef.current) {
      scrimRef.current.style.transition = 'none';
      scrimRef.current.style.opacity = String(1 - Math.min(Math.max(dy, 0) / d.height, 1));
    }
  };

  const onDragEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d || !panel || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y;
    const velocity = dy / Math.max(Date.now() - d.t, 1);
    const scrim = scrimRef.current;
    if (dy > 0 && (dy > d.height * 0.25 || velocity > FLICK_VELOCITY)) {
      // Finish the throw from where the finger let go; the exit takes over.
      panel.style.transition = `transform ${EXIT_MS}ms var(--ease-drawer)`;
      panel.style.transform = 'translateY(100%)';
      if (scrim) {
        scrim.style.transition = `opacity ${EXIT_MS}ms ease`;
        scrim.style.opacity = '0';
      }
      onCloseRef.current();
      return;
    }
    panel.style.transition = 'transform 320ms var(--ease-drawer)';
    panel.style.transform = '';
    if (scrim) {
      scrim.style.transition = 'opacity 320ms ease';
      scrim.style.opacity = '';
    }
    window.setTimeout(() => {
      if (!drag.current) resetDragStyles(panelRef.current, scrimRef.current);
    }, 340);
  };

  const dragHandlers = {
    onPointerDown: onDragStart,
    onPointerMove: onDragMove,
    onPointerUp: onDragEnd,
    onPointerCancel: onDragEnd,
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={scrimRef}
      className={styles.scrim}
      data-state={state}
      onMouseDown={(e) => {
        scrimPointerDown.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (scrimPointerDown.current && e.target === e.currentTarget) {
          onCloseRef.current();
        }
        scrimPointerDown.current = false;
      }}
    >
      <div
        ref={panelRef}
        className={[
          styles.panel,
          wide ? styles.panelWide : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dragHandle} aria-hidden="true" {...dragHandlers} />
        <header className={styles.header} {...dragHandlers}>
          {lead}
          <h2 className={styles.title}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={18} strokeWidth={2} />
          </button>
        </header>

        <div
          className={[
            styles.body,
            padded ? styles.bodyPadded : '',
            bodyClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
