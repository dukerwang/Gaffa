import { Skeleton } from '@/components/ui/Skeleton';
import styles from '../market.module.css';
import nav from '@/components/transfers/TransfersSubNav.module.css';
import s from '@/components/skeletons/pageSkeleton.module.css';

const TABS = ['Market', 'Auctions', 'Listings', 'Free Agency', 'Deals'];
const STATS = ['Club Balance', 'Lots live', 'Offers to answer', 'On the board'];

/**
 * The Transfer Market on its way: the section tabs, the title and the figure
 * labels as they will read, shapes for the figures and the lots. The tabs are
 * drawn, not linked, for the second it shows. (Option A of the /kit
 * prototype, approved 2026-10-23.)
 */
export default function Loading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading the Transfer Market">
      <nav className={nav.nav} aria-hidden="true">
        {TABS.map((t, i) => (
          <span key={t} className={`${nav.item} ${i === 0 ? nav.itemActive : ''}`}>
            {t}
          </span>
        ))}
      </nav>

      <header className={styles.header}>
        <div className={s.stack}>
          <Skeleton width={230} height={12} />
          <h1 className={styles.title}>Transfer Market</h1>
        </div>
        <div className={styles.stats}>
          {STATS.map((label) => (
            <div key={label} className={styles.stat}>
              <Skeleton width={48} height={20} />
              <div className={`g-label-quiet ${styles.statLabel}`}>{label}</div>
            </div>
          ))}
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.sect}>
            <h2 className={styles.sectTitle}>Closing Now</h2>
            <Skeleton width={180} height={12} />
          </div>
          <div className={styles.closingGrid}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${s.box} ${s.pad} ${s.stack}`}>
                <div className={s.row}>
                  <Skeleton width={36} height={16} />
                  <Skeleton width="55%" height={16} />
                </div>
                <Skeleton width="70%" height={11} />
                <Skeleton height={34} />
              </div>
            ))}
          </div>

          <div className={`${styles.sect} ${styles.sectSpaced}`}>
            <h2 className={styles.sectTitle}>On the Listings Board</h2>
            <Skeleton width={200} height={12} />
          </div>
          <div className={s.box}>
            <div className={s.boxRow}>
              <Skeleton width={74} height={86} />
              <div className={`${s.stack} ${s.grow}`}>
                <Skeleton width="45%" height={18} />
                <Skeleton width="60%" height={11} />
              </div>
            </div>
          </div>
        </main>

        <aside className={styles.rail}>
          <div className={s.pad}>
            <Skeleton width="50%" height={16} />
          </div>
          <div className={s.pad}>
            <Skeleton shape="text" lines={4} />
          </div>
        </aside>
      </div>
    </div>
  );
}
