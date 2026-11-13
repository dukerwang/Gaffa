import { Skeleton } from '@/components/ui/Skeleton';
import { POS_COLOR, SPINE } from '@/lib/positions/spine';
import styles from '../playersIndex.module.css';
import s from '@/components/skeletons/pageSkeleton.module.css';

/**
 * The player pool on its way, in the Cards layout it opens to. A loading file
 * can't read the URL or the remembered view, so the season and view switches
 * are drawn as their labels with nothing chosen yet. (Option A of the /kit
 * prototype, approved 2026-10-23.)
 */
export default function Loading() {
  return (
    <div className="g-panel" data-route-skeleton aria-busy="true" aria-label="Loading players">
      <div className={`g-spectrum ${styles.spectrum}`} aria-hidden>
        {SPINE.map((p) => (
          <i key={p} style={{ background: POS_COLOR[p] }} />
        ))}
      </div>

      <header className={styles.header}>
        <div className={s.stack}>
          <Skeleton width={120} height={12} />
          <h1 className={styles.title}>Players</h1>
        </div>
        <div className={styles.headRight}>
          <div>
            <Skeleton width={44} height={24} />
            <div className={`g-label-quiet ${styles.statLabel}`}>players</div>
          </div>
          <Skeleton width={160} height={30} />
          <div className={s.switchLabels} aria-hidden="true">
            <span>Cards</span>
            <span>Table</span>
            <span>Explorer</span>
          </div>
        </div>
      </header>

      <div className={styles.tools}>
        <input className={styles.input} placeholder="Search player or club…" aria-label="Search player" disabled />
        {/* The bar's own width classes, so a phone gets two a row as the page does. */}
        {[styles.fPos, styles.fClub, styles.fTeam, styles.fMins].map((w, i) => (
          <Skeleton key={i} height={44} className={`${styles.filterSelect} ${w}`} />
        ))}
        <Skeleton width={189} height={39} />
      </div>

      <div className={styles.grid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${s.box} ${s.pad} ${s.stack}`}>
            <div className={s.row}>
              <Skeleton width={54} height={64} />
              <div className={`${s.stack} ${s.grow}`}>
                <Skeleton width={70} height={16} />
                <Skeleton width="65%" height={18} />
                <Skeleton width="35%" height={10} />
              </div>
            </div>
            <Skeleton shape="text" lines={3} />
            <Skeleton width="45%" height={20} />
          </div>
        ))}
      </div>
    </div>
  );
}
