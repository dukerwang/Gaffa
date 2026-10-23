'use client';

import React, { useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Popover } from './Popover';
import styles from './Select.module.css';

export interface SelectItem<T extends string = string> {
  value: T;
  label: string;
  /** A second, muted line. Sentence case. */
  description?: string;
  /** A crest, position badge or portrait before the label. Shown in the trigger too. */
  leading?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  items: SelectItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Shown when nothing is chosen. Title Case, e.g. "Choose Club". */
  placeholder?: string;
  /** Visible label above the field. Pass ariaLabel instead when the context names it. */
  label?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

const TYPEAHEAD_RESET_MS = 500;

/**
 * Gaffa UI Primitive: Select
 *
 * A single choice from a short list, with room for a crest or badge beside
 * each option, which a native <select> cannot draw. Behaves as the ARIA
 * listbox pattern: ArrowUp / ArrowDown / Home / End move, Enter or Space
 * chooses, typing jumps to a match, Escape closes and returns focus.
 *
 * For a long, searchable list (every player in the league) this is the wrong
 * control; it has no filter field.
 */
export function Select<T extends string = string>({
  items,
  value,
  onChange,
  placeholder = 'Choose',
  label,
  ariaLabel,
  size = 'md',
  fullWidth = false,
  disabled = false,
  className,
}: SelectProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typeahead = useRef({ text: '', at: 0 });

  const selected = items.find((i) => i.value === value) ?? null;
  const enabledIndexes = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);

  const openAt = (index?: number) => {
    const start = index ?? Math.max(0, items.findIndex((i) => i.value === value));
    setActive(items[start]?.disabled ? (enabledIndexes[0] ?? 0) : start);
    setOpen(true);
  };

  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    onChange(item.value);
    close();
  };

  const step = (delta: 1 | -1) => {
    const pos = enabledIndexes.indexOf(active);
    const next = enabledIndexes[Math.min(Math.max(pos + delta, 0), enabledIndexes.length - 1)];
    if (next !== undefined) scrollTo(next);
  };

  const scrollTo = (index: number) => {
    setActive(index);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const onListKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        return step(1);
      case 'ArrowUp':
        e.preventDefault();
        return step(-1);
      case 'Home':
        e.preventDefault();
        return scrollTo(enabledIndexes[0] ?? 0);
      case 'End':
        e.preventDefault();
        return scrollTo(enabledIndexes[enabledIndexes.length - 1] ?? 0);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return choose(active);
      case 'Tab':
        return close(false);
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at > TYPEAHEAD_RESET_MS ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const match = items.findIndex((i) => !i.disabled && i.label.toLowerCase().startsWith(t.text));
      if (match >= 0) scrollTo(match);
    }
  };

  return (
    <div className={[styles.field, fullWidth ? styles.fullWidth : '', className].filter(Boolean).join(' ')}>
      {label && (
        <span id={`${id}-label`} className={styles.fieldLabel}>
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        className={[styles.trigger, styles[`size_${size}`]].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-labelledby={label ? `${id}-label ${id}-value` : undefined}
        aria-label={label ? undefined : ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close(false) : openAt())}
        onKeyDown={(e) => {
          if (open) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openAt();
          }
        }}
      >
        <span id={`${id}-value`} className={styles.value}>
          {selected?.leading && <span className={styles.leading}>{selected.leading}</span>}
          {selected?.description ? (
            // The chosen option keeps its second line, so a picked player still
            // reads with his position and value.
            <span className={styles.valueStack}>
              <span className={styles.valueText}>{selected.label}</span>
              <span className={styles.valueDesc}>{selected.description}</span>
            </span>
          ) : (
            <span className={selected ? styles.valueText : styles.placeholder}>
              {selected?.label ?? placeholder}
            </span>
          )}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          <Icon name="chevron-down" size={16} strokeWidth={2} />
        </span>
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={triggerRef.current}
        matchAnchorWidth
        sheet
        sheetTitle={label ?? ariaLabel}
        onMount={(el) => {
          listRef.current = el;
          el.focus({ preventScroll: true });
          el.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
        }}
        id={`${id}-list`}
        role="listbox"
        tabIndex={-1}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onKeyDown={onListKey}
      >
        {items.map((item, index) => {
          const isSelected = item.value === value;
          return (
            <div
              key={item.value}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={isSelected}
              aria-disabled={item.disabled || undefined}
              data-index={index}
              data-active={index === active || undefined}
              className={styles.option}
              onPointerMove={() => !item.disabled && index !== active && setActive(index)}
              onClick={() => choose(index)}
            >
              {item.leading && <span className={styles.leading}>{item.leading}</span>}
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{item.label}</span>
                {item.description && <span className={styles.optionDesc}>{item.description}</span>}
              </span>
              <span className={styles.check} aria-hidden="true">
                {isSelected && <Icon name="check" size={16} strokeWidth={2.25} />}
              </span>
            </div>
          );
        })}
      </Popover>
    </div>
  );
}

export default Select;
