'use client';

import React from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leadIcon?: React.ReactNode;
  tailIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export type ButtonProps = BaseButtonProps &
  (
    | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string; disabled?: boolean } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)
  );

/**
 * Gaffa UI Primitive: Button
 *
 * Unified button control replacing ad-hoc .btn classes across Gaffa.
 * - Archivo Narrow typography
 * - Emil Kowalski active press feedback (--press-scale: 0.97)
 * - Automatic loading spinner slot preserving layout width
 * - Polymorphic support (renders NavigationLink when href is passed)
 * - Buttons must be Title Case (Decision 2026-09-09)
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leadIcon,
      tailIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const classNames = [
      styles.button,
      styles[`variant_${variant}`],
      styles[`size_${size}`],
      fullWidth ? styles.fullWidth : '',
      loading ? styles.loading : '',
      disabled ? styles.disabled : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const content = (
      <>
        <span className={styles.contentWrapper}>
          {leadIcon}
          <span>{children}</span>
          {tailIcon}
        </span>
        {loading && (
          <span className={styles.spinnerSlot} aria-hidden="true">
            <span className={styles.spinner} />
          </span>
        )}
      </>
    );

    if ('href' in props && props.href) {
      const { href, onClick, ...anchorProps } = props;
      if (disabled) {
        return (
          <span
            ref={ref as React.Ref<HTMLSpanElement>}
            className={classNames}
            aria-disabled="true"
            {...(anchorProps as React.HTMLAttributes<HTMLSpanElement>)}
          >
            {content}
          </span>
        );
      }
      return (
        <NavigationLink
          href={href}
          onClick={onClick}
          className={classNames}
          {...(anchorProps as any)}
        >
          {content}
        </NavigationLink>
      );
    }

    const { type = 'button', ...buttonProps } = props as React.ButtonHTMLAttributes<HTMLButtonElement>;

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        className={classNames}
        disabled={disabled || loading}
        {...buttonProps}
      >
        {content}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
