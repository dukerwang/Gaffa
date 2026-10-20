'use client';

import React from 'react';
import { useSlidingIndicator } from './internal/useSlidingIndicator';
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
  /**
   * 'tray': segments in a recessed tray under a raised thumb, for a filter
   * inside a panel or form. 'ink': no tray; the chosen segment is set in ink,
   * for a section head on the open page. 'underline': text with a travelling
   * rule, the quietest, for a head that already carries a lot.
   */
  variant?: 'tray' | 'ink' | 'underline';
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Gaffa UI Primitive: SegmentedControl
 *
 * Controlled view/filter toggle with accessible tablist keyboard navigation.
 * - Sofia Sans Semi Condensed typography (--font-label)
 * - ArrowLeft / ArrowRight / Home / End keyboard support
 * - One thumb that slides between segments instead of each segment fading its
 *   own background, so the eye follows the change rather than reading two
 *   separate states
 * - 'ink' draws its chosen state as a second, inverted copy of the labels
 *   clipped to the thumb. The clip slides; the text never changes colour, so
 *   a label is never caught halfway between two inks mid-transition
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'tray',
  fullWidth = false,
  ariaLabel = 'View options',
  className,
}: SegmentedControlProps<T>) {
  const { containerRef, indicator } = useSlidingIndicator<HTMLDivElement>(value);

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
      data-variant={variant}
      className={[
        styles.container,
        styles[`variant_${variant}`],
        fullWidth ? styles.fullWidth : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {variant !== 'ink' && (
        <span
          aria-hidden="true"
          className={styles.thumb}
          data-ready={indicator.ready || undefined}
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.x}px)`,
            opacity: indicator.width ? 1 : 0,
          }}
        />
      )}
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
            data-indicator-key={option.value}
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
      {variant === 'ink' && (
        <span
          aria-hidden="true"
          className={styles.inkLayer}
          data-ready={indicator.ready || undefined}
          style={{
            clipPath: indicator.width
              ? `inset(0 ${indicator.containerWidth - indicator.x - indicator.width}px 0 ${indicator.x}px round var(--r-control))`
              : 'inset(0 100% 0 0)',
          }}
        >
          {options.map((option) => (
            <span key={option.value} className={[styles.segment, styles[`size_${size}`]].join(' ')}>
              {option.icon && <span className={styles.icon}>{option.icon}</span>}
              <span>{option.label}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export default SegmentedControl;
