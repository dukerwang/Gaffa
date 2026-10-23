'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './HoldButton.module.css';

export interface HoldButtonProps {
  /** Title Case, e.g. "Release Player". */
  children: React.ReactNode;
  onConfirm: () => void;
  /** Shown briefly once confirmed, e.g. "Released". */
  confirmedLabel?: string;
  /** How long the hold takes. Long enough to be deliberate, short enough not to annoy. */
  duration?: number;
  variant?: 'danger' | 'primary';
  /** 'sm' is Button's md height, for a footer or a row of compact actions. */
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  /** Why it is disabled, for a mouse user. */
  title?: string;
  className?: string;
}

/**
 * Gaffa UI Primitive: HoldButton
 *
 * Press and hold to confirm an action that costs something and is hard to
 * take back: releasing a player (severance), withdrawing from an auction.
 * It replaces an "Are you sure?" dialog with a gesture that cannot be
 * performed by accident and needs no second screen.
 *
 * Holding fills the button left to right on a linear clock; letting go early
 * drains it back in 200ms. Space and Enter hold it from the keyboard. A tap
 * that lets go in the first half of the clock swaps the label for "Hold to
 * Confirm" for a moment, so a manager who expected a click learns the gesture.
 */
export function HoldButton({
  children,
  onConfirm,
  confirmedLabel,
  duration = 1200,
  variant = 'danger',
  size = 'md',
  fullWidth = false,
  disabled = false,
  title,
  className,
}: HoldButtonProps) {
  const id = useId();
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [hint, setHint] = useState(false);
  const startedAt = useRef(0);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // The clock lives in JS, not on transitionend: an interrupted or throttled
  // transition can finish without ever firing the event. The fill is drawn by
  // CSS on the same duration, so the two land together.
  useEffect(() => {
    if (!holding) return;
    const t = window.setTimeout(() => {
      setHolding(false);
      setConfirmed(true);
      onConfirmRef.current();
    }, duration);
    return () => window.clearTimeout(t);
  }, [holding, duration]);

  useEffect(() => {
    if (!confirmed) return;
    const t = window.setTimeout(() => setConfirmed(false), 1600);
    return () => window.clearTimeout(t);
  }, [confirmed]);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 1400);
    return () => window.clearTimeout(t);
  }, [hint]);

  const start = () => {
    if (disabled || confirmed) return;
    startedAt.current = Date.now();
    setHint(false);
    setHolding(true);
  };
  const cancel = () => setHolding(false);
  /** Letting go on purpose, as opposed to sliding off or losing focus. */
  const release = () => {
    if (holding && Date.now() - startedAt.current < duration / 2) setHint(true);
    setHolding(false);
  };

  const label = confirmed && confirmedLabel ? confirmedLabel : children;

  return (
    <button
      type="button"
      className={[
        styles.button,
        styles[`variant_${variant}`],
        styles[`size_${size}`],
        fullWidth ? styles.fullWidth : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-holding={holding || undefined}
      data-confirmed={confirmed || undefined}
      data-hint={hint || undefined}
      disabled={disabled}
      title={title}
      aria-describedby={`${id}-hint`}
      style={{ ['--hold-ms' as string]: `${duration}ms` }}
      onPointerDown={(e) => e.button === 0 && start()}
      onPointerUp={release}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && release()}
      onBlur={cancel}
    >
      <span className={styles.base}>{label}</span>
      <span className={styles.hint} aria-hidden="true">
        Hold to Confirm
      </span>
      <span className={styles.fill} aria-hidden="true">
        {confirmed && <Icon name="check" size={15} strokeWidth={2.5} />}
        {label}
      </span>
      <span id={`${id}-hint`} className="sr-only">
        Press and hold to confirm
      </span>
    </button>
  );
}

export default HoldButton;
