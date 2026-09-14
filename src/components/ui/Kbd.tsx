'use client';

import React from 'react';
import styles from './Kbd.module.css';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Gaffa UI Primitive: Kbd
 *
 * Keyboard keycap display component.
 * Used for shortcut affordances following Gaffa's 2026-09-08 decision:
 * state affordances in infinitive purpose ("Enter to open · Esc to return")
 * or direct imperatives ("Press Enter to open").
 */
export function Kbd({ children, className, ...props }: KbdProps) {
  return (
    <kbd className={[styles.kbd, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </kbd>
  );
}

export default Kbd;
