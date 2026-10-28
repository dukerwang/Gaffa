import { Skeleton } from '@/components/ui/Skeleton';
import s from '@/components/cups/cups.module.css';

/** One tie card's two lines, as the real one draws them. */
function Tie() {
  return (
    <div className={s.tc}>
      {[0, 1].map((i) => (
        <div key={i} className={s.tl}>
          <Skeleton shape="circle" width={24} height={24} />
          <Skeleton width="60%" height={14} />
          <span />
        </div>
      ))}
    </div>
  );
}

/**
 * The Cups page on its way: the shelf with its three trophy places, then the
 * draw's strip and a round of ties, in the page's own layout. The labels are
 * real; only the data is shapes.
 */
export default function Loading() {
  return (
    <div className="g-page" data-route-skeleton aria-busy="true" aria-label="Loading cups">
      <section className={s.shelf}>
        <div className={s.shelfGrid}>
          <div>
            <h1 className={s.shelfH}>Cups</h1>
            <div className={s.cab}>
              {['Champions', 'League Cup', 'Consolation'].map((name) => (
                <span key={name} className={s.cabItem}>
                  <span className={s.tro} style={{ alignItems: 'center' }}>
                    <Skeleton width={56} height="80%" />
                  </span>
                  <span className={s.cabName}>{name}</span>
                  <Skeleton width={64} height={12} />
                </span>
              ))}
            </div>
          </div>
          <div className={s.nextSlot}>
            <div className={s.next} style={{ height: 156 }} />
          </div>
        </div>
      </section>
      <div className={s.afterShelf} />
      <section className={s.draw}>
        <div className={s.strip} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {['Quarter-Final', 'Semi-Final', 'Final'].map((name) => (
            <span key={name} className={s.stripBtn}><b>{name}</b><Skeleton width={36} height={11} /></span>
          ))}
        </div>
        <div className={s.stack}>
          <Tie />
          <Tie />
        </div>
      </section>
    </div>
  );
}
