import NavigationLink from '@/components/ui/NavigationLink';
import CrestBadge from '@/components/crest/CrestBadge';
import { fmt } from '@/lib/matchups/roundView';
import type { TieLine, TieModel } from '@/lib/cups/cupsView';
import s from './cups.module.css';

function Line({ l, seeded }: { l: TieLine; seeded: boolean }) {
  const nameCls = `${s.nm}${l.mine ? ` ${s.nmMine}` : ''}${l.lost ? ` ${s.nmLost}` : ''}`;
  return (
    <div className={s.tl}>
      {seeded && <span className={s.rk}>{l.seed ?? ''}</span>}
      {l.club ? (
        <CrestBadge config={l.club.crest} size={24} teamName={l.club.name} interactive={false} />
      ) : (
        <span className={s.q} aria-hidden>?</span>
      )}
      {l.club ? <span className={nameCls}>{l.club.name}</span> : <span className={s.pend}>{l.label}</span>}
      {l.tag ? (
        <span className={s.tag}>{l.tag}</span>
      ) : l.score != null ? (
        <span className={`${s.sc}${l.lost ? ` ${s.scLost}` : ''}`}>{fmt(l.score)}</span>
      ) : (
        <span />
      )}
    </div>
  );
}

/** One cup tie as two stacked lines. The whole card opens the tie page. */
export function TieCard({ tie, seeded = false }: { tie: TieModel; seeded?: boolean }) {
  const foot = tie.state === 'live' || tie.decidedLabel;
  const label = tie.a.club && tie.b.club ? `${tie.a.club.name} v ${tie.b.club.name}` : undefined;
  return (
    <div className={`${s.tc}${tie.mine ? ` ${s.mine}` : ''}${seeded ? ` ${s.seeded}` : ''}`}>
      {tie.href && <NavigationLink href={tie.href} className={s.stretch} aria-label={label}>{null}</NavigationLink>}
      <Line l={tie.a} seeded={seeded} />
      <Line l={tie.b} seeded={seeded} />
      {foot && (
        <div className={s.tcFoot}>
          <span className={tie.state === 'live' ? s.live : undefined}>{tie.state === 'live' ? 'Live' : ''}</span>
          <span>{tie.decidedLabel}</span>
        </div>
      )}
    </div>
  );
}
