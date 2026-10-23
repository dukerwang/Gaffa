'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { NumberRoll } from './NumberRoll';
import styles from './MoneyStepper.module.css';

export interface MoneyStepperProps {
  /** In €m. */
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Title Case, e.g. "Your Bid". */
  label: string;
  /** One line under the figure, e.g. "Minimum €20m · Club Balance €48m". */
  hint?: React.ReactNode;
  disabled?: boolean;
  /** Span the container, the figure taking the room between − and +. For a phone sheet. */
  fullWidth?: boolean;
  /** Replaces the label's look, so the field matches the form it sits in. */
  labelClassName?: string;
  className?: string;
}

const formatMoney = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(1)}m`;
/** Wait before a held button starts repeating, then repeat faster the longer it is held. */
const REPEAT_AFTER_MS = 380;
const REPEAT_START_MS = 110;
const REPEAT_FLOOR_MS = 40;

/**
 * Gaffa UI Primitive: MoneyStepper
 *
 * The bid figure. Tap − or + to move one step; hold either to run, gathering
 * speed. Tap the figure to type an amount. ArrowUp / ArrowDown step, PageUp /
 * PageDown move ten steps, Home / End jump to the bounds.
 *
 * The figure is mono because it is live money that ticks as you change it
 * (UI_RULES 10). Hitting a bound nudges the figure sideways instead of
 * silently doing nothing.
 */
export function MoneyStepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  label,
  hint,
  disabled = false,
  fullWidth = false,
  labelClassName,
  className,
}: MoneyStepperProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [bump, setBump] = useState(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const repeat = useRef<{ timer?: number; delay: number }>({ delay: REPEAT_START_MS });

  const clamp = (n: number) => Math.min(Math.max(n, min), max);
  const roundToStep = (n: number) => Math.round(n / step) * step;

  const nudge = (delta: number) => {
    const next = clamp(roundToStep(valueRef.current + delta));
    if (next === valueRef.current) {
      setBump((b) => b + 1);
      return false;
    }
    valueRef.current = next;
    onChange(next);
    return true;
  };

  const stopRepeat = () => {
    window.clearTimeout(repeat.current.timer);
    repeat.current = { delay: REPEAT_START_MS };
  };

  const startRepeat = (delta: number) => {
    if (disabled || !nudge(delta)) return;
    const tick = () => {
      if (!nudge(delta)) return stopRepeat();
      repeat.current.delay = Math.max(REPEAT_FLOOR_MS, repeat.current.delay * 0.88);
      repeat.current.timer = window.setTimeout(tick, repeat.current.delay);
    };
    repeat.current.timer = window.setTimeout(tick, REPEAT_AFTER_MS);
  };

  useEffect(() => stopRepeat, []);

  const commit = () => {
    const parsed = parseFloat(draft.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(parsed)) onChange(clamp(roundToStep(parsed)));
    setEditing(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const actions: Record<string, () => void> = {
      ArrowUp: () => nudge(step),
      ArrowRight: () => nudge(step),
      ArrowDown: () => nudge(-step),
      ArrowLeft: () => nudge(-step),
      PageUp: () => nudge(step * 10),
      PageDown: () => nudge(-step * 10),
      Home: () => Number.isFinite(min) && onChange(min),
      End: () => Number.isFinite(max) && onChange(max),
      Enter: () => {
        setDraft(String(value));
        setEditing(true);
      },
    };
    const action = actions[e.key];
    if (action && !disabled) {
      e.preventDefault();
      action();
    }
  };

  const holdHandlers = (delta: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startRepeat(delta);
    },
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
    // A long press on Android opens a context menu, which cancels the pointer
    // and would stop the run mid-hold.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    // Keyboard and assistive tech arrive as click with no pointerdown.
    onClick: (e: React.MouseEvent) => e.detail === 0 && nudge(delta),
  });

  return (
    <div
      className={[styles.root, fullWidth ? styles.fullWidth : '', disabled ? styles.disabled : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <span id={`${id}-label`} className={labelClassName ?? styles.label}>
        {label}
      </span>
      <div className={styles.control}>
        <button
          type="button"
          className={styles.step}
          aria-label={`Decrease by ${formatMoney(step)}`}
          disabled={disabled || value <= min}
          {...holdHandlers(-step)}
        >
          <Icon name="minus" size={18} strokeWidth={2.25} />
        </button>

        {editing ? (
          <input
            autoFocus
            className={styles.input}
            // Whole millions get the number pad; a fractional step needs the point.
            inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
            pattern={Number.isInteger(step) ? '[0-9]*' : undefined}
            enterKeyHint="done"
            aria-labelledby={`${id}-label`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                e.stopPropagation();
                setEditing(false);
              }
            }}
          />
        ) : (
          <div
            role="spinbutton"
            tabIndex={disabled ? -1 : 0}
            aria-labelledby={`${id}-label`}
            aria-describedby={hint ? `${id}-hint` : undefined}
            aria-valuenow={value}
            aria-valuemin={Number.isFinite(min) ? min : undefined}
            aria-valuemax={Number.isFinite(max) ? max : undefined}
            aria-valuetext={formatMoney(value)}
            className={styles.figure}
            onKeyDown={onKey}
            onClick={() => {
              if (disabled) return;
              setDraft(String(value));
              setEditing(true);
            }}
          >
            <span key={bump} className={bump ? styles.bump : undefined}>
              <NumberRoll value={value} format={formatMoney} />
            </span>
          </div>
        )}

        <button
          type="button"
          className={styles.step}
          aria-label={`Increase by ${formatMoney(step)}`}
          disabled={disabled || value >= max}
          {...holdHandlers(step)}
        >
          <Icon name="plus" size={18} strokeWidth={2.25} />
        </button>
      </div>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}

export default MoneyStepper;
