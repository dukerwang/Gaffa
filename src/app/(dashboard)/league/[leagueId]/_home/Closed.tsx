import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import type { HomeModel } from '@/lib/home/buildHomeModel';
import styles from './home.module.css';

/**
 * Close of season — the three states Duke asked to merge, as one card.
 *
 * The final table and the season's best deliberately do NOT appear here: in
 * the offseason those turn Home into a copy of /history. The space belongs to
 * the departure decisions, which are the mechanic that actually runs through
 * the summer.
 */
export default function Closed({ model }: { model: HomeModel }) {
  const c = model.closed;
  if (!c) return null;

  return (
    <div className={styles.matchRowSolo}>
      <article className={styles.mCardLead} aria-label="Season closed">
        <div className={styles.mWatermark} aria-hidden="true">
          <CrestBadge
            config={model.club.crest as CrestConfig | null}
            size={260}
            teamName={model.club.name}
            interactive={false}
          />
        </div>

        <div className={styles.mBar}>
          <span className={styles.mBarT}>{model.season}</span>
          <span className={styles.mBarWhen}>Season closed</span>
        </div>

        <div className={styles.mBody}>
          <div className={styles.closedLead}>
            <div className={styles.closedF}>{c.headline}</div>
            <div className={styles.closedS}>{c.sub}</div>
          </div>

          <div className={styles.stages}>
            {c.stages.map((s, i) => (
              <div key={i} className={s.done ? styles.stageDone : styles.stageNow}>
                <div className={styles.stageH}>{s.name}</div>
                <div className={styles.stageS}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className={styles.closedMoney}>
            <div>
              <div className={styles.closedMv}>{c.prizes}</div>
              <div className={styles.closedMs}>{c.prizeSub}</div>
            </div>
            <div>
              <div className={styles.closedMvAccent}>{c.balance}</div>
              <div className={styles.closedMs}>Club Balance, carried over untouched</div>
            </div>
            <div>
              <div className={styles.closedMv}>{c.openDepartures}</div>
              <div className={styles.closedMs}>
                {c.openDepartures === 1 ? 'Departure decision' : 'Departure decisions'} open.
                Release takes the compensation and bars you from his return auction; retain keeps
                the claim and pays nothing.
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
