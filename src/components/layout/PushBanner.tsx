'use client';

import { useEffect, useState } from 'react';
import {
  getPushAvailability,
  hasAccountPushSubscription,
  subscribeToPush,
} from '@/lib/push/subscribe';
import styles from './PushBanner.module.css';

const DISMISS_STORAGE_KEY = 'gaffa_push_prompt_dismissed_at';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    try {
      const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissed) {
        const dismissedAt = parseInt(dismissed, 10);
        if (!Number.isNaN(dismissedAt) && Date.now() - dismissedAt < SEVEN_DAYS_MS) {
          return;
        }
      }
    } catch {
      // ignore localStorage errors in private browsing
    }

    getPushAvailability().then(async (status) => {
      if (cancelled || status !== 'unsubscribed') return;

      const hasOtherDevice = await hasAccountPushSubscription();
      if (cancelled || hasOtherDevice) return;

      setVisible(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  async function handleTurnOn() {
    setBusy(true);
    try {
      await subscribeToPush();
      setVisible(false);
    } catch {
      // Permission denied or prompt dismissed
      handleDismiss();
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch {
      // ignore
    }
  }

  return (
    <aside className={styles.banner} aria-label="Enable live notifications">
      <div className={styles.content}>
        <span className={styles.title}>Enable live alerts</span>
        <p className={styles.description}>
          Get lock-screen notifications for outbids, closing auctions, and matchday scores.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.dismissBtn}
          onClick={handleDismiss}
          disabled={busy}
        >
          Dismiss
        </button>
        <button
          type="button"
          className={styles.turnOnBtn}
          onClick={handleTurnOn}
          disabled={busy}
        >
          {busy ? 'Enabling…' : 'Turn On'}
        </button>
      </div>
    </aside>
  );
}
