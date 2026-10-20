import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** A short name for what is missing. Sentence case; omit for a one-line message. */
  title?: string;
  /** The explanation, or the whole message when there is no title. */
  children?: ReactNode;
  /** A link or button that gets the reader out of the empty state. */
  action?: ReactNode;
  /** `page` fills a region on its own; `compact` sits inside a panel or card. */
  size?: 'page' | 'compact';
  className?: string;
}

/**
 * The one empty state. The Gaffa mark stands in for the missing content, so a
 * page with nothing on it still reads as Gaffa rather than as a blank.
 */
export default function EmptyState({ title, children, action, size = 'page', className }: EmptyStateProps) {
  const rootClass = [styles.root, size === 'compact' ? styles.compact : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={rootClass}>
      <Icon name="gaffa" size={size === 'compact' ? 28 : 44} className={styles.mark} aria-hidden="true" />
      {title && <div className={styles.title}>{title}</div>}
      {children && <div className={styles.text}>{children}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
