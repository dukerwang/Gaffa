'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import styles from './error.module.css';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Unhandled route error:', error);
  }, [error]);

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Icon name="alert" size={28} />
        </div>
        <h1 className={styles.title}>Something Went Wrong</h1>
        <p className={styles.description}>
          An unexpected error occurred while loading this view. You can retry the request or return to the dashboard.
        </p>
        <div className={styles.actions}>
          <Button onClick={reset} variant="primary">
            Try Again
          </Button>
          <Button href="/dashboard" variant="secondary">
            Return to Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
