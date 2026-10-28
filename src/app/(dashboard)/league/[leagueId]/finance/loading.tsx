import { Skeleton } from '@/components/ui/Skeleton';
import styles from './finance.module.css';

/**
 * Finance on its way, in the page's own parts: the green shelf with Spendable,
 * the two cards on its edge, Club Facilities and the Season section, so
 * nothing moves when the page arrives.
 */
export default function Loading() {
  const onShelf = styles.shelfBone;
  return (
    <div className={styles.page} data-route-skeleton aria-busy="true" aria-label="Loading Finance">
      <section className={styles.shelf}>
        <div className={styles.shelfTop}>
          <Skeleton shape="circle" width={44} height={44} className={onShelf} />
          <div className={styles.titles}>
            <Skeleton width={150} height={32} className={onShelf} />
            <Skeleton width={110} height={13} className={`${onShelf} ${styles.skGap}`} />
          </div>
          <div className={styles.shelfSwitch}>
            <Skeleton width={150} height={36} className={onShelf} />
          </div>
        </div>
        <div className={styles.hero}>
          <div className={styles.spend}>
            <Skeleton width={90} height={12} className={onShelf} />
            <Skeleton width="min(280px, 70vw)" height={84} className={`${onShelf} ${styles.skGap}`} />
          </div>
          <div className={styles.sum}>
            {[0, 1].map((i) => (
              <div key={i} className={styles.term}>
                <Skeleton width={96} height={11} className={onShelf} />
                <Skeleton width={100} height={25} className={onShelf} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.cards}>
        {[3, 2].map((rows, c) => (
          <section key={c} className={styles.card}>
            <header className={styles.cardHd}>
              <Skeleton width={120} height={22} />
              <Skeleton width={64} height={14} className={styles.skEnd} />
            </header>
            <ul className={styles.rows}>
              {Array.from({ length: rows }, (_, i) => (
                <li key={i} className={styles.row}>
                  <span className={styles.rowWho}>
                    <Skeleton shape="circle" width={36} height={36} />
                    <span className={styles.rowText}>
                      <Skeleton width={130} height={14} />
                      <Skeleton width={90} height={11} className={styles.skGap} />
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <Skeleton width={52} height={18} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHd}>
          <Skeleton width={190} height={28} />
          <Skeleton width={110} height={16} />
        </div>
        <div className={styles.facilities}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.facility}>
              <div className={styles.facTop}>
                <Skeleton width={110} height={18} />
                <Skeleton width={36} height={18} className={styles.skEnd} />
              </div>
              <Skeleton width={80} height={12} />
              <Skeleton width="100%" height={36} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHd}>
          <Skeleton width={110} height={28} />
          <Skeleton width={220} height={16} />
        </div>
        <div className={styles.season}>
          <Skeleton width="100%" height={240} />
          <div className={styles.breakdown}>
            {[0, 1].map((c) => (
              <div key={c} className={styles.bdCol}>
                <Skeleton width={80} height={16} />
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width="100%" height={30} className={styles.skGap} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
