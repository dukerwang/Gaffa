'use client';

import { useEffect, useState } from 'react';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { Icon } from '@/components/ui/Icon';
import type { FacilityView } from '@/lib/facilities/facilities';
import SlotStrip from './SlotStrip';
import styles from './facilities.module.css';

/**
 * Confirms one Club Facilities purchase, then shows it done in place. A
 * centred dialog on desktop and a bottom sheet on phones (ResponsiveModal).
 *
 * The Club Balance in the topbar updates on its own over Realtime when the
 * team row changes, so nothing here has to reach for it.
 */
export default function FacilityPurchaseSheet({
  leagueId,
  facility,
  balance,
  onClose,
  onPurchased,
}: {
  leagueId: string;
  /** The facility being expanded. Null closes the sheet. */
  facility: FacilityView | null;
  balance: number;
  onClose: () => void;
  /** Fired once the purchase lands, so the page can refresh its data. */
  onPurchased?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ cost: number; balance: number } | null>(null);
  // Keep the facility as it was when opened: a refresh after purchase replaces
  // the prop with the upgraded row, which would redraw the sheet mid-read.
  const [shown, setShown] = useState<FacilityView | null>(facility);

  useEffect(() => {
    if (facility) {
      setShown(facility);
      setError(null);
      setDone(null);
      setSubmitting(false);
    }
    // Only a newly opened facility resets the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facility?.key]);

  const open = facility !== null;
  const view = shown ?? facility;
  if (!view || !view.next) return null;

  const { next } = view;
  const after = balance - next.price;
  const short = after < 0;
  const title = `${view.name} Slot ${next.slots}`;

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/facilities/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility: view!.key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not complete the purchase. Try again.');
        return;
      }
      setDone({ cost: data.cost, balance: data.balance });
      onPurchased?.();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <ResponsiveModal
        open={open}
        onClose={onClose}
        title={title}
        footer={
          <div className={styles.sheetFoot}>
            <button type="button" className={`${styles.buy} ${styles.sheetConfirm}`} onClick={onClose}>
              Done
            </button>
          </div>
        }
      >
        <div className={styles.sheetBody}>
          <div className={styles.done}>
            <span className={styles.doneMark} aria-hidden>
              <Icon name="check" size={18} />
            </span>
            <p className={styles.doneText}>
              Paid €{done.cost}m. Club Balance is now €{done.balance}m.
            </p>
          </div>
          <div className={styles.doneStrip}>
            <SlotStrip facility={view} preview />
          </div>
        </div>
      </ResponsiveModal>
    );
  }

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className={styles.sheetFoot}>
          <button type="button" className={`${styles.ghost} ${styles.sheetCancel}`} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.buy} ${styles.sheetConfirm}`}
            onClick={confirm}
            disabled={submitting || short}
          >
            {submitting ? 'Buying…' : `Confirm Purchase · €${next.price}m`}
          </button>
        </div>
      }
    >
      <div className={styles.sheetBody}>
        <p className={styles.sheetSub}>
          {view.slots} slots to {next.slots}
        </p>
        <div className={styles.sheetStrip}>
          <SlotStrip facility={view} preview />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.sheetRow}>
          <span className={styles.sheetKey}>Price</span>
          <span className={styles.sheetValue}>€{next.price}m</span>
        </div>
        <div className={styles.sheetRow}>
          <span className={styles.sheetKey}>Club Balance</span>
          <span className={styles.sheetValue}>€{balance}m</span>
        </div>
        <div className={styles.sheetRow}>
          <span className={styles.sheetKey}>{short ? 'Short By' : 'After Purchase'}</span>
          <span className={`${styles.sheetValue} ${styles.sheetValueStrong}`}>
            €{Math.abs(after)}m
          </span>
        </div>

        <p className={styles.note}>
          Permanent. The slot stays with your club every season and can&rsquo;t be sold back.
        </p>
      </div>
    </ResponsiveModal>
  );
}
