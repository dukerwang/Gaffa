import { Skeleton } from '@/components/ui/Skeleton';
import styles from './tournaments.module.css';

/** One tie in the bracket: two team rows, as the real one draws them. */
function Tie() {
  return (
    <div className={styles.slot}>
      <div className={styles.matchupWrapper}>
        <div className={styles.matchup}>
          {[0, 1].map((i) => (
            <div key={i} className={styles.teamRow}>
              <Skeleton width="60%" height={16} />
              <Skeleton width={34} height={16} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The Cups page on its way, in its own container, tab row and bracket grid:
 * a round of four ties, then two, then the final.
 */
export default function Loading() {
  return (
    <div className={styles.container} aria-busy="true" aria-label="Loading Cup Competitions">
      <div className={styles.headerSection}>
        <header className={styles.header}>
          <Skeleton width={320} height={44} />
        </header>
        <div className={styles.tabContainer}>
          <div style={{ display: 'flex', gap: 'var(--s5)', height: 40, alignItems: 'center' }}>
            <Skeleton width={110} height={16} />
            <Skeleton width={110} height={16} />
            <Skeleton width={120} height={16} />
          </div>
        </div>
        <div className={styles.infoBar}>
          <Skeleton width={260} height={12} />
        </div>
      </div>

      <section className={styles.bracketSection}>
        <div className={styles.bracket}>
          {[[2, 2], [1, 2], [1, 1]].map(([pairs, perPair], round) => (
            <div key={round} className={styles.roundColumn}>
              <div className={styles.roundHeader}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s1)' }}><Skeleton width={90} height={10} /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton width={56} height={13} /></div>
              </div>
              <div className={styles.matchupSlots}>
                {Array.from({ length: pairs }, (_, p) => (
                  <div key={p} className={styles.slotPair}>
                    {Array.from({ length: perPair }, (_, t) => <Tie key={t} />)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
