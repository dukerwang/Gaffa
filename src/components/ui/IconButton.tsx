'use client';

import React from 'react';
import { Tooltip } from './Tooltip';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: it becomes the accessible name and the tooltip. Title Case. */
  label: string;
  icon: React.ReactNode;
  variant?: 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Set false when a visible label already sits beside the button. */
  tooltip?: boolean;
}

/**
 * Gaffa UI Primitive: IconButton
 *
 * A square, icon-only button. It always has a name: `label` is both the
 * aria-label and, on pointer and keyboard devices, the tooltip.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, variant = 'ghost', size = 'md', tooltip = true, className, type = 'button', ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={[styles.button, styles[`variant_${variant}`], styles[`size_${size}`], className]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {icon}
      </button>
    );
    return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
  },
);

IconButton.displayName = 'IconButton';

export default IconButton;
