'use client';

import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Popover } from './Popover';
import type { Placement } from './internal/useAnchoredPosition';
import optionStyles from './Select.module.css';
import styles from './Menu.module.css';

export type MenuEntry =
  | {
      label: string;
      onSelect: () => void;
      icon?: React.ReactNode;
      /** Destructive: red ink, and listed last by convention. */
      danger?: boolean;
      disabled?: boolean;
      /** A keyboard hint shown at the right, e.g. "R". */
      shortcut?: string;
    }
  | 'separator';

export interface MenuProps {
  items: MenuEntry[];
  /** The trigger's accessible name; also its tooltip or its visible text. Title Case. */
  label: string;
  /** 'icon' is a ••• button with a tooltip; 'button' shows the label with a chevron. */
  trigger?: 'icon' | 'button';
  placement?: Placement;
}

/**
 * Gaffa UI Primitive: Menu
 *
 * A short list of actions on one object: a player row's List, Loan, Release.
 * Not for navigation and not for a choice that stays selected (Select).
 *
 * Focus moves into the menu on open and follows ArrowUp / ArrowDown / Home /
 * End; Escape closes it and returns focus to the trigger.
 */
export function Menu({ items, label, trigger = 'icon', placement = 'bottom-end' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const focusItem = (which: 'first' | 'last' | 1 | -1) => {
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    if (!nodes.length) return;
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      which === 'first'
        ? 0
        : which === 'last'
          ? nodes.length - 1
          : (current + which + nodes.length) % nodes.length;
    nodes[next].focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, 'first' | 'last' | 1 | -1> = {
      ArrowDown: 1,
      ArrowUp: -1,
      Home: 'first',
      End: 'last',
    };
    if (e.key in map) {
      e.preventDefault();
      focusItem(map[e.key]);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const triggerProps = {
    ref: triggerRef,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    onClick: () => setOpen((o) => !o),
  };

  return (
    <>
      {trigger === 'icon' ? (
        <IconButton {...triggerProps} label={label} icon={<Icon name="more" size={18} strokeWidth={2.5} />} />
      ) : (
        <Button
          {...triggerProps}
          variant="secondary"
          tailIcon={
            <span className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}>
              <Icon name="chevron-down" size={15} strokeWidth={2} />
            </span>
          }
        >
          {label}
        </Button>
      )}

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={triggerRef.current}
        placement={placement}
        role="menu"
        aria-label={label}
        className={styles.menu}
        onKeyDown={onKey}
        onMount={(el) => {
          menuRef.current = el;
          el.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
        }}
      >
        {items.map((entry, i) =>
          entry === 'separator' ? (
            <div key={`sep-${i}`} role="separator" className={styles.separator} />
          ) : (
            <button
              key={entry.label}
              type="button"
              role="menuitem"
              disabled={entry.disabled}
              className={[optionStyles.option, styles.item, entry.danger ? styles.danger : ''].join(' ')}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                entry.onSelect();
              }}
            >
              {entry.icon && <span className={styles.icon}>{entry.icon}</span>}
              <span className={styles.label}>{entry.label}</span>
              {entry.shortcut && <kbd className={styles.shortcut}>{entry.shortcut}</kbd>}
            </button>
          ),
        )}
      </Popover>
    </>
  );
}

export default Menu;
