'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import styles from './UpdateAnnouncementModal.module.css';

interface Notification {
  id: string;
  title: string;
  content: string;
  url?: string;
  read: boolean;
  kind?: string | null;
  created_at: string;
}

/**
 * Pops once, at most, for the newest unread major product update — same
 * notification row the bell already shows, so dismissing either one clears
 * both. Mounted once in the dashboard shell rather than per-page.
 *
 * The pop-up carries the patch notes themselves, not a teaser: Duke found the
 * summary and highlights too thin (2026-09-15), and most managers never open
 * /updates. The body is read from the update row, which every authenticated
 * user may already read (the SELECT policy in migration 144), so the
 * notification payload stays title-and-summary for the bell.
 */
export default function UpdateAnnouncementModal() {
  const [notice, setNotice] = useState<Notification | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const notifications = (data.notifications ?? []) as Notification[];
        const next = notifications.find((n) => n.kind === 'product' && !n.read);
        if (next) setNotice(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const slug = notice?.url?.split('#')[1];
    if (!slug) return;
    let cancelled = false;
    createClient()
      .from('product_updates')
      .select('body')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBody(typeof data?.body === 'string' && data.body.trim() ? data.body : '');
      });
    return () => {
      cancelled = true;
    };
  }, [notice?.url]);

  if (!notice) return null;

  const dismiss = () => {
    setNotice(null);
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: notice.id }),
    }).catch(() => {});
  };

  return (
    <ResponsiveModal
      open
      title={notice.title}
      lead={
        <span className={styles.badge}>
          <Icon name="bell" size={16} strokeWidth={2} />
        </span>
      }
      onClose={dismiss}
      className={styles.panel}
      footer={
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => {
              dismiss();
              router.push('/updates');
            }}
          >
            View All Updates
          </Button>
          <Button variant="primary" onClick={dismiss}>
            Done
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {body === null ? (
          <p className={styles.loading}>Loading the update…</p>
        ) : body ? (
          <div className={styles.prose}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>
        ) : (
          <p className={styles.summary}>{notice.content}</p>
        )}
      </div>
    </ResponsiveModal>
  );
}
