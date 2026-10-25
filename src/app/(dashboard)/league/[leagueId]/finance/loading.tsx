import { Skeleton } from '@/components/ui/Skeleton';
import styles from './finance.module.css';
import sk from '@/components/skeletons/pageSkeleton.module.css';

/**
 * The Finance Ledger on its way, in the page's own masthead and panel: the
 * summary strip, the spending breakdown and the ledger's rows, so the page
 * holds its shape at every width.
 */
export default function Loading() {
  return (
    <div className={`${styles.page} g-page`} aria-busy="true" aria-label="Loading Finance Ledger">
      <header className={styles.masthead}>
        <Skeleton width={180} height={12} />
        <div style={{ marginTop: 'var(--s2)' }}><Skeleton width={230} height={32} /></div>
        <div style={{ marginTop: 'var(--s3)' }}><Skeleton width={200} height={14} /></div>
      </header>

      <div className={`g-panel ${styles.panel}`}>
        <div className={styles.summaryStrip}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.summaryCard}>
              <Skeleton width={84} height={10} />
              <Skeleton width={96} height={25} />
            </div>
          ))}
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}><Skeleton width={150} height={18} /></div>
          <div className={styles.breakdown}>
            {[100, 86, 64, 42, 30].map((w, i) => (
              <div key={i} className={styles.breakdownRow}>
                <Skeleton width="70%" height={11} />
                <Skeleton width={`${w}%`} height={8} />
                <Skeleton width={56} height={11} />
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.ledgerHeader}>
            <div className={styles.sectionHead}><Skeleton width={110} height={18} /></div>
            <Skeleton width={190} height={32} />
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className={sk.boxRow} style={{ padding: 'var(--s3)', borderTop: i ? '1px solid var(--color-border-subtle)' : undefined }}>
              <Skeleton width={46} height={12} />
              <Skeleton width={96} height={12} />
              <div className={sk.grow}><Skeleton width="38%" height={16} /></div>
              <Skeleton width={56} height={16} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
