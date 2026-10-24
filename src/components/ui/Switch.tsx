'use client';

import React, { useId } from 'react';
import styles from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label. Omit only when a neighbouring element labels it, and pass ariaLabel. */
  label?: React.ReactNode;
  /** One line of sentence-case help under the label. */
  description?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Gaffa UI Primitive: Switch
 *
 * An on/off setting that takes effect immediately (notifications, autodraft).
 * For a choice that waits on a Save button, use Checkbox.
 *
 * The thumb stretches toward its destination while pressed, the way an iOS
 * switch does, so the press reads before the release commits it.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  ariaLabel,
  disabled = false,
  size = 'md',
  className,
}: SwitchProps) {
  const id = useId();
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={description ? `${id}-desc` : undefined}
      disabled={disabled}
      className={[styles.track, styles[`size_${size}`]].join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );

  if (!label) return <span className={className}>{control}</span>;

  return (
    <div className={[styles.row, disabled ? styles.rowDisabled : '', className].filter(Boolean).join(' ')}>
      <span className={styles.text}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {description && (
          <span id={`${id}-desc`} className={styles.description}>
            {description}
          </span>
        )}
      </span>
      {control}
    </div>
  );
}

export default Switch;
