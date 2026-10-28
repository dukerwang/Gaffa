import { Skeleton } from '@/components/ui/Skeleton';
import styles from './club.module.css';
import s from '@/components/skeletons/pageSkeleton.module.css';

const FIGS = ['Club Balance', 'Squad value', 'Points for', 'Squad age'];

/**
 * The club page on its way: the masthead panel in the page's own classes,
 * the four figure labels as they will read, and shapes where the club's data
 * goes. (Option A of the /kit prototype, approved 2026-10-23.)
 */
export default function Loading() {
  return (
    <div className={`${styles.shell} ${styles.page} g-page`} data-route-skeleton aria-busy="true" aria-label="Loading club">
      <header className={`${styles.masthead} g-panel`}>
        <div className={styles.mhTop}>
          <div className={styles.mhCrest}>
            <Skeleton width={68} height={82} />
          </div>
          <div className={styles.mhTitles}>
            <Skeleton width={180} height={12} />
            <Skeleton width="min(320px, 80%)" height={38} />
            <Skeleton width={220} height={14} />
          </div>
        </div>

        <nav className={styles.switcher} aria-hidden="true">
          <span className={`${styles.tbLabel} ${styles.switcherLabel}`}>Clubs</span>
          <div className={styles.switcherStrip}>
            {[132, 128, 120, 104, 96, 118].map((w, i) => (
              <Skeleton key={i} width={w} height={38} className={s.pill} />
            ))}
          </div>
        </nav>

        <div className={styles.figs}>
          {FIGS.map((label) => (
            <div key={label} className={styles.fig}>
              <div className="g-label">{label}</div>
              <Skeleton width="45%" height={25} />
              <Skeleton width="65%" height={12} />
            </div>
          ))}
        </div>
      </header>

      <section className="g-panel" style={{ marginTop: 'var(--s5)' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={s.boxRow}>
            <div className={`${s.stack} ${s.grow}`}>
              <Skeleton width="30%" height={15} />
              <Skeleton width="55%" height={11} />
            </div>
            <Skeleton width={120} height={36} />
          </div>
        ))}
      </section>
    </div>
  );
}
