import { Skeleton } from '@/components/ui/Skeleton';
import styles from '../_home/home.module.css';
import s from '@/components/skeletons/pageSkeleton.module.css';

/**
 * League Home on its way. It lays out in the page's own masthead, body and
 * rail, so it holds the page's shape at every width; only the data is drawn
 * as shapes. The Alerts strip is left out because it only shows when there
 * is something to say. (Option A of the /kit prototype, approved 2026-10-23.)
 */
export default function Loading() {
  return (
    <div className={styles.page} data-route-skeleton aria-busy="true" aria-label="Loading League Home">
      <header className={styles.mast}>
        <div className={styles.mastRow}>
          <div className={styles.mastId}>
            <Skeleton width={46} height={55} />
            <div className={`${styles.mastTx} ${s.stack}`}>
              <Skeleton width={240} height={36} />
              <Skeleton width={260} height={13} />
            </div>
          </div>
          <div className={styles.figs}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${styles.fig} ${s.stack}`}>
                <Skeleton width={76} height={26} />
                <Skeleton width={96} height={11} />
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.main}>
          <section className={s.box}>
            <div className={s.boxHead}>Matchweek</div>
            {[0, 1].map((i) => (
              <div key={i} className={s.boxRow}>
                <Skeleton shape="circle" width={34} height={34} />
                <div className={`${s.stack} ${s.grow}`}>
                  <Skeleton width="45%" height={20} />
                  <Skeleton width="25%" height={10} />
                </div>
                <Skeleton width={64} height={30} />
              </div>
            ))}
            <div className={s.pad}>
              <Skeleton width="60%" height={11} />
            </div>
          </section>

          <section>
            <div className={styles.sect}>
              <Skeleton width={150} height={22} />
            </div>
            <div className={s.box}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={s.boxRow}>
                  <Skeleton width={18} height={14} />
                  <Skeleton shape="circle" width={24} height={24} />
                  <div className={s.grow}>
                    <Skeleton width="50%" height={14} />
                  </div>
                  <Skeleton width={40} height={14} />
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={styles.rail}>
          {[0, 1].map((i) => (
            <div key={i} className={s.box}>
              <div className={s.pad}>
                <Skeleton width="45%" height={16} />
              </div>
              <div className={s.pad}>
                <Skeleton shape="text" lines={3} />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
