'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fold } from '@/lib/text/fold';
import styles from './Picker.module.css';

export interface PickerOption {
  value: string;
  label: string;
  /** Extra text the search matches against, such as a club's short name. */
  keywords?: string;
  disabled?: boolean;
}

export interface PickerGroup<O extends PickerOption = PickerOption> {
  /** Shown as a sticky heading over the group. Omit for an unlabelled group. */
  label?: string;
  options: O[];
}

export interface PickerProps<O extends PickerOption = PickerOption> {
  groups: PickerGroup<O>[];
  value: string;
  onChange: (value: string, option: O) => void;
  ariaLabel: string;
  placeholder?: string;
  /** A search field over the list; matches labels and keywords, accent-insensitive. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Row content. Defaults to the label. */
  renderOption?: (option: O, state: { selected: boolean }) => ReactNode;
  /** Trigger content for the selected option. Defaults to its label. */
  renderValue?: (option: O) => ReactNode;
  /** Where to open the list when nothing is selected, such as the next match. */
  scrollToValue?: string;
  /** Popover width in px; it never narrows below the trigger. */
  popoverWidth?: number;
  /** Which trigger edge the popover lines up with. */
  align?: 'start' | 'end';
  className?: string;
}

const SHEET_QUERY = '(max-width: 640px)';
const GAP = 6;
const VIEWPORT_MARGIN = 12;

/**
 * Gaffa's select. A trigger that opens a popover list: grouped, optionally
 * searchable, with rich rows, full keyboard support, and a bottom sheet on
 * phones. The popover scales in from the trigger edge it opens from
 * (DESIGN.md § 4.A) and renders in a portal, so a modal or a clipped rail
 * never cuts it off.
 */
export function Picker<O extends PickerOption = PickerOption>({
  groups,
  value,
  onChange,
  ariaLabel,
  placeholder = 'Select',
  searchable = false,
  searchPlaceholder = 'Search',
  renderOption,
  renderValue,
  scrollToValue,
  popoverWidth,
  align = 'start',
  className,
}: PickerProps<O>) {
  const id = useId();
  const listId = `${id}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number; above: boolean } | null>(null);

  const selected = useMemo(() => {
    for (const g of groups) for (const o of g.options) if (o.value === value) return o;
    return null;
  }, [groups, value]);

  const shown = useMemo(() => {
    const q = fold(query);
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => fold(`${o.label} ${o.keywords ?? ''}`).includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);
  const flat = useMemo(() => shown.flatMap((g) => g.options.filter((o) => !o.disabled)), [shown]);

  // The highlighted row. While searching, a highlight the filter hid falls to the first match, which Enter takes.
  const current =
    activeValue && flat.some((o) => o.value === activeValue) ? activeValue : query ? (flat[0]?.value ?? null) : activeValue;
  const activeId = current ? `${id}-opt-${flat.findIndex((o) => o.value === current)}` : undefined;

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, popoverWidth ?? 0), vw - VIEWPORT_MARGIN * 2);
    let left = align === 'end' ? r.right - width : r.left;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - width - VIEWPORT_MARGIN));
    const below = vh - r.bottom - GAP - VIEWPORT_MARGIN;
    const aboveRoom = r.top - GAP - VIEWPORT_MARGIN;
    // Open downward unless there's far more room above.
    const above = below < 260 && aboveRoom > below;
    const maxHeight = Math.min(420, above ? aboveRoom : below);
    setPos({ top: above ? r.top - GAP : r.bottom + GAP, left, width, maxHeight, above });
  }, [popoverWidth, align]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openPicker = useCallback(() => {
    setSheet(window.matchMedia(SHEET_QUERY).matches);
    place();
    setActiveValue(value || scrollToValue || null);
    setOpen(true);
  }, [place, value, scrollToValue]);

  // Follow the trigger while open, and close on a press outside.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return;
      place();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, place, close]);

  // On open: focus the search (or the list) and bring the active row into view.
  useLayoutEffect(() => {
    if (!open) return;
    (searchable && !sheet ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
    const el = activeValue ? listRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(activeValue)}"]`) : null;
    if (el && listRef.current) {
      const list = listRef.current;
      list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    }
    // Only on open; keyboard moves scroll themselves.
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveActive = useCallback(
    (delta: number | 'first' | 'last') => {
      if (flat.length === 0) return;
      const i = flat.findIndex((o) => o.value === current);
      const next =
        delta === 'first' ? 0 : delta === 'last' ? flat.length - 1 : Math.max(0, Math.min(flat.length - 1, (i < 0 ? -1 : i) + delta));
      const v = flat[next].value;
      setActiveValue(v);
      listRef.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(v)}"]`)?.scrollIntoView({ block: 'nearest' });
    },
    [flat, current],
  );

  const choose = useCallback(
    (o: O) => {
      if (o.disabled) return;
      onChange(o.value, o);
      close();
    },
    [onChange, close],
  );

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Home') { e.preventDefault(); moveActive('first'); }
    else if (e.key === 'End') { e.preventDefault(); moveActive('last'); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const o = flat.find((x) => x.value === current);
      if (o) choose(o);
    } else if (e.key === 'Escape') {
      // Close only the list, not a dialog the picker sits in.
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    else if (e.key === 'Tab') close(false);
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openPicker();
    }
  };


  const popover =
    open && pos
      ? createPortal(
          <>
            {sheet && <div className={styles.scrim} aria-hidden="true" />}
            <div
              ref={popRef}
              className={`${styles.pop} ${sheet ? styles.sheet : ''} ${pos.above ? styles.above : ''}`}
              style={
                sheet
                  ? undefined
                  : {
                      top: pos.above ? undefined : pos.top,
                      bottom: pos.above ? window.innerHeight - pos.top : undefined,
                      left: pos.left,
                      width: pos.width,
                      maxHeight: pos.maxHeight,
                      ['--origin' as string]: `${align === 'end' ? 'right' : 'left'} ${pos.above ? 'bottom' : 'top'}`,
                    }
              }
            >
              {sheet && (
                <div className={styles.sheetHead}>
                  <span className={styles.sheetTitle}>{ariaLabel}</span>
                  <button type="button" className={styles.sheetClose} onClick={() => close()} aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {searchable && (
                <div className={styles.searchWrap}>
                  <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    ref={searchRef}
                    className={styles.search}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onListKey}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    autoComplete="off"
                  />
                </div>
              )}
              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                tabIndex={-1}
                className={styles.list}
                onKeyDown={onListKey}
                aria-activedescendant={searchable ? undefined : activeId}
              >
                {shown.length === 0 && <div className={styles.empty}>No matches</div>}
                {shown.map((g, gi) => (
                  <div key={g.label ?? gi} role="group" aria-label={g.label}>
                    {g.label && <div className={styles.groupLabel}>{g.label}</div>}
                    {g.options.map((o) => {
                      const isSelected = o.value === value;
                      const index = flat.indexOf(o);
                      return (
                        <div
                          key={o.value}
                          id={index >= 0 ? `${id}-opt-${index}` : undefined}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={o.disabled || undefined}
                          data-value={o.value}
                          data-active={o.value === current || undefined}
                          className={styles.option}
                          onPointerMove={() => !o.disabled && setActiveValue(o.value)}
                          onClick={() => choose(o)}
                        >
                          <span className={styles.optionBody}>{renderOption ? renderOption(o, { selected: isSelected }) : o.label}</span>
                          <svg
                            className={styles.check}
                            data-on={isSelected || undefined}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${className ?? ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={selected ? `${ariaLabel}: ${selected.label}` : ariaLabel}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={onTriggerKey}
        data-open={open || undefined}
      >
        <span className={styles.value}>
          {selected ? (renderValue ? renderValue(selected) : selected.label) : <span className={styles.placeholder}>{placeholder}</span>}
        </span>
        <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {popover}
    </>
  );
}
