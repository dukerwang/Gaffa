'use client';

import React, { useEffect } from 'react';
import NavigationLink from './NavigationLink';
import { useSlidingIndicator } from './internal/useSlidingIndicator';
import styles from './Tabs.module.css';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** A small figure after the label, e.g. the number of open bids. */
  count?: number;
  /** Something new behind this tab that has no figure, e.g. an unread lobby. */
  unread?: boolean;
  disabled?: boolean;
  /** Link mode: every item has one, and the tabs become a nav of links. */
  href?: string;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  /** Required for button tabs; unused when the items are links. */
  onChange?: (value: T) => void;
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
 *
 * Link mode: when every item has an `href`, the tabs render as a <nav> of
 * links with aria-current on the active one, for sections that are routes
 * (Heritage, Cups). Links keep the browser's own Tab order and middle-click.
 * The underline travels only while the nav stays mounted across the route
 * change, i.e. when it lives in a layout or the route changes a search param.
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
  const links = items.length > 0 && items.every((i) => i.href !== undefined);

  // A row of links that scrolls on a phone opens with the current page in view,
  // so Trophy Cabinets isn't chosen but off the right edge. Scrolls the row only.
  useEffect(() => {
    const row = containerRef.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!links || !row || !current) return;
    const right = current.offsetLeft + current.offsetWidth;
    if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth + 16;
  }, [links, value, containerRef]);

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
    onChange?.(next.value);
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-indicator-key="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  const inner = (item: TabItem<T>) => (
    <>
      <span>{item.label}</span>
      {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
      {item.unread && (
        <>
          <span className={styles.unread} aria-hidden="true" />
          <span className="sr-only">, new</span>
        </>
      )}
    </>
  );

  const indicatorEl = (
    <span
      aria-hidden="true"
      className={styles.indicator}
      data-ready={indicator.ready || undefined}
      style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
    />
  );

  const listClass = [styles.list, className].filter(Boolean).join(' ');

  if (links) {
    return (
      <nav ref={containerRef} aria-label={ariaLabel} className={listClass}>
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <NavigationLink
              key={item.value}
              href={item.href!}
              aria-current={selected ? 'page' : undefined}
              data-indicator-key={item.value}
              className={styles.tab}
            >
              {inner(item)}
            </NavigationLink>
          );
        })}
        {indicatorEl}
      </nav>
    );
  }

  return (
    <div ref={containerRef} role="tablist" aria-label={ariaLabel} className={listClass}>
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
            onClick={() => onChange?.(item.value)}
            onKeyDown={(e) => move(e, item.value)}
          >
            {inner(item)}
          </button>
        );
      })}
      {indicatorEl}
    </div>
  );
}

export default Tabs;
