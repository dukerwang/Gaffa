import { Skeleton } from '@/components/ui/Skeleton';
import { s as gw } from '@/components/gameweeks/parts';
import sk from '@/components/skeletons/pageSkeleton.module.css';

/**
 * The gameweek page on its way. It lays out in the page's own bar and panels,
 * so it holds the page's shape at every width: the bar, the scoreboard, the
 * fixtures and the standings, each drawn as the shapes the data will fill.
 */
export default function Loading() {
  return (
    <div className={`${gw.root} g-page`} aria-busy="true" aria-label="Loading Gameweeks">
      <div className={gw.gwb}>
        <div className={sk.row} style={{ flex: 1, padding: '0 20px', justifyContent: 'space-between' }}>
          <Skeleton shape="circle" width={36} height={36} />
          <div className={sk.stack} style={{ alignItems: 'center' }}>
            <Skeleton width={150} height={22} />
            <Skeleton width={190} height={12} />
          </div>
          <Skeleton shape="circle" width={36} height={36} />
        </div>
      </div>

      <div className={gw.hxWide}>
        <div className={sk.rounded}><Skeleton height={232} /></div>
      </div>

      <section className={gw.blk}>
        <div className={gw.sh}><Skeleton width={110} height={26} /></div>
        <div className={gw.panel}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={sk.boxRow}>
              <Skeleton shape="circle" width={28} height={28} />
              <div className={`${sk.stack} ${sk.grow}`}>
                <Skeleton width="55%" height={16} />
                <Skeleton width="30%" height={10} />
              </div>
              <Skeleton width={72} height={22} />
            </div>
          ))}
        </div>
      </section>

      <section className={gw.blk}>
        <div className={gw.sh}><Skeleton width={120} height={26} /></div>
        <div className={gw.panel}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={sk.boxRow}>
              <Skeleton width={18} height={14} />
              <Skeleton shape="circle" width={20} height={20} />
              <div className={sk.grow}><Skeleton width="45%" height={14} /></div>
              <Skeleton width={36} height={14} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
