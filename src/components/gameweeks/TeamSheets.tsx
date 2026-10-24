'use client';

import type { MatchupView, PitchPlayer } from '@/lib/matchups/matchupView';
import { fmt, type ResultLetter } from '@/lib/matchups/roundView';
import { Crest, FormDots, Res, s } from './parts';
import { TeamSheet } from './MatchSections';
import { useSwipePager } from './useSwipePager';
import type { TeamLite } from './types';

/**
 * Both team sheets. Side by side on a wide screen; on a phone they are a pair
 * you swipe between with native scroll-snap (momentum and rubber-banding come
 * from the browser, so it moves at the finger's speed), the next sheet peeking
 * in from the edge. The crest pager follows the scroll and scrolls on tap.
 */
export function TeamSheets({ view, teams, mine, onOpen }: {
  view: MatchupView; teams: { a: TeamLite; b: TeamLite }; mine: 'a' | 'b'; onOpen: (p: PitchPlayer) => void;
}) {
  const order: ('a' | 'b')[] = mine === 'b' ? ['b', 'a'] : ['a', 'b'];
  const { scroller, cards, active, go } = useSwipePager();
  const other = teams[order[active === 0 ? 1 : 0]];

  return (
    <section className={s.blk}>
      <div className={s.sh}>
        <h2 className={s.shT}>Team Sheets</h2>
        <span className={s.shTools}>
          <span className={s.swpPager} role="tablist" aria-label="Team sheets">
            {order.map((k, i) => (
              <button key={k} type="button" role="tab" aria-selected={active === i} aria-label={teams[k].name}
                className={`${s.swpDot}${active === i ? ` ${s.swpOn}` : ''}`} onClick={() => go(i)}>
                <Crest crest={teams[k].crest} name={teams[k].name} size={14} />
              </button>
            ))}
          </span>
        </span>
      </div>
      <div ref={scroller} className={s.swp}>
        <div className={`${s.swpTrack}${mine === 'b' ? ` ${s.swpFlip}` : ''}`}>
          {order.map((k, i) => (
            <div key={k} ref={(el) => { cards.current[i] = el; }} className={s.swpCard}>
              <TeamSheet side={view[k]} team={teams[k]} state={view.state} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </div>
      <div className={s.swpFoot} aria-hidden="true">
        <span className={s.swpBar}>{order.map((k, i) => <i key={k} className={active === i ? s.swpBarOn : undefined} />)}</span>
        <span>Swipe for {other.name}</span>
      </div>
    </section>
  );
}

export interface H2HData {
  won: number; drawn: number; lost: number;
  meetings: { key: string; label: string; my: number; opp: number; r: ResultLetter; isThis: boolean }[];
  nextLabel: string | null;
  note: string;
  formMine: ResultLetter[];
  formOther: ResultLetter[];
  formLabel: string;
}

export function HeadToHead({ data, mine, other }: { data: H2HData; mine: TeamLite; other: TeamLite }) {
  return (
    <section className={s.blk}>
      <div className={s.sh}><h2 className={s.shT}>Head-to-Head</h2></div>
      <div className={`${s.panel} ${s.h2}`}>
        <div className={s.h2Rec}>
          <div className={s.h2Big}>
            <div><b>{data.won}</b><span>Won</span></div>
            <div><b>{data.drawn}</b><span>Drawn</span></div>
            <div><b>{data.lost}</b><span>Lost</span></div>
          </div>
          {data.note && <p className={s.h2Note}>{data.note}</p>}
        </div>
        <div className={s.h2List}>
          {data.meetings.map((m) => (
            <div key={m.key} className={s.h2M}>
              <span className={s.h2Gw}>{m.label}</span>
              <span className={s.h2Sc}>{fmt(m.my)} <span className={s.l}>–</span> {fmt(m.opp)}</span>
              <span className={s.h2Who}>{m.isThis ? <span className={s.h2Now}>This Match</span> : `${m.r === 'W' ? 'Won' : m.r === 'L' ? 'Lost' : 'Drew'} by ${fmt(Math.abs(m.my - m.opp))}`}</span>
              <Res r={m.r} />
            </div>
          ))}
          {data.nextLabel && (
            <div className={s.h2M}><span className={s.h2Gw}>{data.nextLabel}</span><span className={s.h2Sc} style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Next Meeting</span><span /><span /></div>
          )}
          {!data.meetings.length && !data.nextLabel && <div className={s.h2M}><span className={s.h2Who}>No meetings yet</span></div>}
        </div>
        <div className={s.h2Form}>
          <span className={s.lbl}>{data.formLabel}</span>
          {([[mine, data.formMine], [other, data.formOther]] as const).map(([t, f]) => (
            <div key={t.id} className={s.h2FR}><Crest crest={t.crest} name={t.name} size={18} /><span className={s.nm}>{t.name}</span><FormDots form={f} light /></div>
          ))}
        </div>
      </div>
    </section>
  );
}
