'use client';

import React from 'react';
import { useSlidingIndicator } from './internal/useSlidingIndicator';
import styles from './Tabs.module.css';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** A small figure after the label, e.g. the number of open bids. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Prefix for tab and panel ids, so a panel can point back with aria-labelledby. */
  idBase?: string;
  className?: string;
}

/**
 * Gaffa UI Primitive: Tabs
 *
 * Page-level navigation between views of one thing (Squad / Pitch / Retained).
 * A single 2px underline travels between tabs on an ease-in-out curve, because
 * it is something already on screen moving to a new place. For a compact
 * filter inside a section head, use SegmentedControl instead.
 *
 * Keyboard: ArrowLeft / ArrowRight / Home / End move and select (automatic
 * activation), matching SegmentedControl.
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  idBase = 'tabs',
  className,
}: TabsProps<T>) {
  const { containerRef, indicator } = useSlidingIndicator<HTMLDivElement>(value);

  const move = (e: React.KeyboardEvent, from: T) => {
    const enabled = items.filter((i) => !i.disabled);
    const index = enabled.findIndex((i) => i.value === from);
    let next: TabItem<T> | undefined;
    if (e.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.value);
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-indicator-key="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={[styles.list, className].filter(Boolean).join(' ')}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            aria-controls={`${idBase}-panel-${item.value}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            data-indicator-key={item.value}
            className={styles.tab}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => move(e, item.value)}
          >
            <span>{item.label}</span>
            {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className={styles.indicator}
        data-ready={indicator.ready || undefined}
        style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
      />
    </div>
  );
}

export default Tabs;
