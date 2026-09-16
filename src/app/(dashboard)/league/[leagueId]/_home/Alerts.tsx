'use client';

import { useEffect, useState } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import type { AttentionItem } from '@/lib/home/buildHomeModel';
import styles from './home.module.css';

/**
 * What needs you, soonest first.
 *
 * The strip mixes chores (an offer to answer) with EXPOSURES — a fit player
 * on IR blocking every bid, a doubtful starter. The exposures are the half
 * the old page never did: it could tell you your lineup was unset, but never
 * why you would want to change it.
 *
 * Items are DISMISSIBLE, and the key is `id + text` rather than `id` alone.
 * That distinction is the whole design: dismissing "Outbid on Wirtz at €46m"
 * hides that fact, but if someone raises to €52m the text changes, the key
 * changes, and it comes back. So dismissal silences a thing you have read,
 * never a thing that has since moved — which is what makes it safe to offer
 * on items that carry a real deadline.
 *
 * Dismissals live in localStorage, per league. They are a reading aid, not
 * state anyone else can see, so there is nothing here worth a round trip.
 */
export default function Alerts({ items, leagueId }: { items: AttentionItem[]; leagueId: string }) {
  const storageKey = `gaffa:home:dismissed:${leagueId}`;
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // localStorage is a browser API with no server value, so the first read
    // has to happen after mount. Rendering the server's list until it lands
    // is the point: hiding first and revealing after flashes the strip away.
    /* eslint-disable react-hooks/set-state-in-effect -- reading a client-only store on mount */
    try {
      const raw = window.localStorage.getItem(storageKey);
      setDismissed(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setDismissed([]);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [storageKey]);

  const keyOf = (i: AttentionItem) => `${i.id}|${i.text}`;

  function dismiss(item: AttentionItem) {
    const next = [...new Set([...dismissed, keyOf(item)])];
    setDismissed(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* a full or blocked store is not worth failing a render over */
    }
  }

  function restore() {
    setDismissed([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* as above */
    }
  }

  // Until localStorage has been read, render the server's list unfiltered.
  // Hiding first and revealing after would flash the strip away on every load.
  const visible = ready ? items.filter((i) => !dismissed.includes(keyOf(i))) : items;
  const hiddenCount = items.length - visible.length;

  // Nothing to act on and nothing dismissed: the band has no job, so it goes.
  if (visible.length === 0 && hiddenCount === 0) return null;

  return (
    <section className={styles.alerts} aria-label="Alerts">
      <div className={styles.alertsHd}>
        {/* The count is the instrument: a tile you read before the word. */}
        <span className={styles.countTile} aria-hidden="true">
          {visible.length}
        </span>
        <div>
          <h2 className={styles.alertsT}>Alerts</h2>
          <div className={styles.alertsSub}>
            {visible.length === 0
              ? 'All dismissed. Anything that changes comes back on its own.'
              : visible.length === 1
                ? 'One thing needs you'
                : `${visible.length} things, soonest first`}
          </div>
        </div>
        {hiddenCount > 0 && (
          <button type="button" className={styles.alertsRestore} onClick={restore}>
            Show {hiddenCount} Dismissed
          </button>
        )}
      </div>

      {visible.length > 0 && (
        <div className={styles.alertsList}>
          {visible.map((item) => (
            <div key={item.id} className={item.tone === 'warn' ? styles.alertWarn : styles.alert}>
              <span className={item.tone === 'warn' ? styles.tagWarn : styles.tagPlain}>{item.tag}</span>
              <span className={styles.alertText}>{item.text}</span>
              <span className={item.tone === 'warn' ? styles.alertWhen : styles.alertWhenCalm}>
                {item.when}
              </span>
              <NavigationLink href={item.href} className={styles.btn}>
                {item.action}
              </NavigationLink>
              <button
                type="button"
                className={styles.alertDismiss}
                onClick={() => dismiss(item)}
                aria-label={`Dismiss: ${item.text}`}
                title="Dismiss"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
