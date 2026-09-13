'use client';

import React from 'react';
import styles from './SimpleSelect.module.css';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SimpleSelectProps<T extends string = string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
}

/**
 * Gaffa UI Primitive: SimpleSelect
 *
 * Single-value select control that renders Gaffa's styled surface and
 * automatically leverages the native OS picker on mobile devices for
 * maximum ergonomics.
 * - Archivo Narrow typography
 * - High contrast :focus-visible outline
 * - Custom arrow caret
 */
export function SimpleSelect<T extends string = string>({
  options,
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  size = 'md',
  fullWidth = false,
  ariaLabel,
  className,
  id,
}: SimpleSelectProps<T>) {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={[styles.container, fullWidth ? styles.fullWidth : '', className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.selectWrapper}>
        <select
          id={selectId}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel || label}
          onChange={(e) => onChange(e.target.value as T)}
          className={[styles.select, styles[`size_${size}`]].filter(Boolean).join(' ')}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.caret} aria-hidden="true">
          ▼
        </span>
      </div>
    </div>
  );
}

export default SimpleSelect;
