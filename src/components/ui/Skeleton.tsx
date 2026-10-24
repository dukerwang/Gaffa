import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** 'text' sizes to a line of type; 'circle' for a crest; 'block' for anything else. */
  shape?: 'text' | 'block' | 'circle';
  /** For 'text': this many lines, the last one shorter, as a paragraph ends. */
  lines?: number;
  className?: string;
}

/**
 * Gaffa UI Primitive: Skeleton
 *
 * The shape of content that is on its way. Build skeletons in the layout of
 * the real thing (a fixture row is a crest, a name, a score), so nothing jumps
 * when it arrives. The sheen is a transformed highlight rather than a moving
 * background, so it stays on the compositor while the page is busy loading.
 */
export function Skeleton({ width, height, shape = 'block', lines = 1, className }: SkeletonProps) {
  if (shape === 'text' && lines > 1) {
    return (
      <span className={[styles.stack, className].filter(Boolean).join(' ')} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={[styles.bone, styles.text].join(' ')}
            style={{ width: i === lines - 1 ? '62%' : width ?? '100%' }}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={[styles.bone, styles[shape], className].filter(Boolean).join(' ')}
      style={{ width, height }}
    />
  );
}

export default Skeleton;
