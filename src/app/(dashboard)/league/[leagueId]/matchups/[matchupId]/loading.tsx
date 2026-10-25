import { Skeleton } from '@/components/ui/Skeleton';
import { s as gw } from '@/components/gameweeks/parts';
import sk from '@/components/skeletons/pageSkeleton.module.css';

/**
 * A matchup on its way: the bar back to the round, the scoreboard, then the two
 * halves side by side (stacked on a phone), as the page draws them.
 */
export default function Loading() {
  return (
    <div className={`${gw.root} g-page`} aria-busy="true" aria-label="Loading Matchup">
      <div className={gw.gwb}>
        <div className={sk.row} style={{ flex: 1, padding: '0 20px' }}>
          <Skeleton width={150} height={20} />
        </div>
      </div>

      <div className={gw.hxWide}>
        <div className={sk.rounded}><Skeleton height={232} /></div>
      </div>

      <section className={gw.blk}>
        <div className={gw.sh}><Skeleton width={120} height={26} /></div>
        <div className={gw.panel}>
          <div className={sk.pad}><Skeleton height={150} /></div>
        </div>
      </section>

      <section className={gw.blk}>
        <div className={gw.sh}><Skeleton width={110} height={26} /></div>
        <div className={sk.halves}>
          {[0, 1].map((i) => (
            <div key={i} className={gw.panel}>
              <div className={sk.boxRow}>
                <Skeleton shape="circle" width={22} height={22} />
                <div className={sk.grow}><Skeleton width="50%" height={16} /></div>
                <Skeleton width={48} height={20} />
              </div>
              <div className={sk.pad}><Skeleton height={320} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
