'use client';

import React, { useId, useState } from 'react';
import { Icon } from './Icon';
import styles from './Disclosure.module.css';

export interface DisclosureProps {
  /** Title Case: the name of what is inside. */
  title: React.ReactNode;
  /** A figure or short status at the right of the header, e.g. "€4.2m". */
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  /** Controlled use: pass both. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Gaffa UI Primitive: Disclosure
 *
 * A section that folds away: scoring breakdowns, the fine print of a rule.
 * Height animates through grid rows (0fr → 1fr), which needs no measuring
 * and copes with content that changes while open.
 */
export function Disclosure({
  title,
  meta,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  children,
  className,
}: DisclosureProps) {
  const id = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const toggle = () => {
    if (controlled === undefined) setUncontrolled(!open);
    onOpenChange?.(!open);
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} data-open={open || undefined}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={toggle}
      >
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
        <span className={styles.chevron} aria-hidden="true">
          <Icon name="chevron-down" size={16} strokeWidth={2} />
        </span>
      </button>
      <div id={`${id}-panel`} className={styles.panel}>
        <div className={styles.inner} inert={!open || undefined}>
          <div className={styles.content}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default Disclosure;
