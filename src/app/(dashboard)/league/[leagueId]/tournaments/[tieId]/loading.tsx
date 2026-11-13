import { Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { Lineups, Scoreboard, TeamSheets } from '@/components/gameweeks/Skeletons';
import gw from '@/components/gameweeks/gw.module.css';
import s from '@/components/cups/cupTie.module.css';

/**
 * A cup tie on its way, in the tie page's own layout: the trophy lockup, the
 * scoreboard, the lineups and the team sheets. None of the Gameweek bar,
 * Momentum or Match Report, which a tie doesn't have. The legs strip is left
 * out because only a two-legged round draws it.
 */
export default function Loading() {
  return (
    <div className={`${gw.root} g-page`} data-route-skeleton aria-busy="true" aria-label="Loading cup tie">
      <div className={s.head}>
        <span className={s.back} aria-hidden="true">
          <Icon name="chevron-left" size={20} strokeWidth={2.25} className={s.chev} />
          <span className={s.tro}><Skeleton width={29} height={40} /></span>
          <div className={s.titleTx}>
            <Skeleton width={200} height={28} />
            <span className={s.round}><Skeleton width={96} height={14} /></span>
          </div>
        </span>
      </div>
      <Scoreboard big />
      <div className={gw.stl}><Lineups /></div>
      <div className={gw.stl}><TeamSheets /></div>
    </div>
  );
}
