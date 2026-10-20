'use client';

import React, { useEffect, useRef } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'size'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Some, not all, of a group is selected. Renders a dash. */
  indeterminate?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * Gaffa UI Primitive: Checkbox
 *
 * A native checkbox under a drawn mark, so forms, labels and screen readers
 * behave exactly as the platform does. The tick draws itself in 180ms; the
 * box fills under it.
 */
export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  label,
  description,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={[styles.root, disabled ? styles.disabled : '', className].filter(Boolean).join(' ')}
    >
      <input
        ref={ref}
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...props}
      />
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 16 16" className={styles.mark}>
          <path className={styles.tick} d="M3.5 8.5 6.5 11.5 12.5 4.5" pathLength={1} />
          <path className={styles.dash} d="M4 8h8" pathLength={1} />
        </svg>
      </span>
      {(label || description) && (
        <span className={styles.text}>
          {label && <span className={styles.label}>{label}</span>}
          {description && <span className={styles.description}>{description}</span>}
        </span>
      )}
    </label>
  );
}

export default Checkbox;
