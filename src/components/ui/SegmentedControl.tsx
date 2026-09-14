'use client';

import React, { useRef } from 'react';
import styles from './SegmentedControl.module.css';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Gaffa UI Primitive: SegmentedControl
 *
 * Controlled view/filter toggle with accessible tablist keyboard navigation.
 * - Archivo Narrow typography
 * - ArrowLeft / ArrowRight / Home / End keyboard support
 * - Tactile active pill with subtle elevation
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  ariaLabel = 'View options',
  className,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledOptions = options.filter((o) => !o.disabled);
    const enabledIndex = enabledOptions.findIndex((o) => o.value === options[currentIndex].value);

    let targetValue: T | null = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (enabledIndex + 1) % enabledOptions.length;
      targetValue = enabledOptions[nextIndex].value;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (enabledIndex - 1 + enabledOptions.length) % enabledOptions.length;
      targetValue = enabledOptions[prevIndex].value;
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetValue = enabledOptions[0].value;
    } else if (e.key === 'End') {
      e.preventDefault();
      targetValue = enabledOptions[enabledOptions.length - 1].value;
    }

    if (targetValue !== null) {
      onChange(targetValue);
      // Focus the newly active button
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      const targetBtn = Array.from(buttons || []).find((b) => b.getAttribute('data-value') === targetValue);
      targetBtn?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={[
        styles.container,
        fullWidth ? styles.fullWidth : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-value={option.value}
            disabled={option.disabled}
            onClick={() => !option.disabled && onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              styles.segment,
              styles[`size_${size}`],
              isSelected ? styles.active : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {option.icon && <span className={styles.icon}>{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
