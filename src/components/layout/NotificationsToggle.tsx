'use client';

import { useEffect, useState } from 'react';
import { getPushAvailability, subscribeToPush, unsubscribeFromPush, type PushAvailability } from '@/lib/push/subscribe';
import { Switch } from '@/components/ui/Switch';
import styles from './NotificationsToggle.module.css';

export default function NotificationsToggle() {
  const [state, setState] = useState<PushAvailability | 'loading'>('loading');

  useEffect(() => {
    getPushAvailability().then(setState);
  }, []);

  async function handleToggle() {
    if (state === 'subscribed') {
      setState('loading');
      await unsubscribeFromPush();
      setState('unsubscribed');
      return;
    }
    if (state === 'unsubscribed') {
      setState('loading');
      try {
        await subscribeToPush();
        setState('subscribed');
      } catch {
        setState('unsubscribed');
      }
    }
  }

  if (state === 'unsupported') return null;

  if (state === 'needs-install') {
    return <div className={styles.hint}>Add Gaffa to your Home Screen to enable notifications.</div>;
  }

  const isOn = state === 'subscribed';

  return (
    <div className={styles.row}>
      <span className={styles.label}>Push notifications</span>
      <Switch
        size="sm"
        checked={isOn}
        ariaLabel="Push notifications"
        disabled={state === 'loading'}
        onChange={() => void handleToggle()}
      />
    </div>
  );
}
