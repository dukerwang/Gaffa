'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ResponsiveModal.module.css';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const scrimPointerDown = useRef(false);

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

    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.scrim}
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
        <div className={styles.dragHandle} aria-hidden="true" />
        <header className={styles.header}>
          {lead}
          <h2 className={styles.title}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
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
