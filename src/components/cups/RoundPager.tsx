'use client';

import { useSwipePager } from '@/components/gameweeks/useSwipePager';
import CrestBadge from '@/components/crest/CrestBadge';
import type { RoundPage, TieLine } from '@/lib/cups/cupsView';
import { TieCard } from './TieCard';
import s from './cups.module.css';

function PoolLine({ l }: { l: TieLine }) {
  return (
    <div className={s.tl}>
      {l.club ? <CrestBadge config={l.club.crest} size={24} teamName={l.club.name} interactive={false} /> : <span className={s.q} aria-hidden>?</span>}
      {l.club ? <span className={`${s.nm}${l.mine ? ` ${s.nmMine}` : ''}`}>{l.club.name}</span> : <span className={s.pend}>{l.label}</span>}
      {l.tag ? <span className={s.tag}>{l.tag}</span> : <span />}
    </div>
  );
}

/** A round still to be drawn: one card of the clubs through and the places to come. */
function Pool({ round }: { round: RoundPage }) {
  const lines = round.ties.flatMap((t) => [t.a, t.b]);
  return (
    <div className={`${s.tc}${lines.some((l) => l.mine) ? ` ${s.mine}` : ''}`}>
      {lines.map((l, i) => <PoolLine key={i} l={l} />)}
    </div>
  );
}

/**
 * The selected cup's draw, one round per page. On a phone the pages swipe
 * sideways with the next one showing at the edge, and the strip above follows
 * the swipe; on a desktop every round sits side by side.
 */
export function RoundPager({ rounds, initial, seeded }: { rounds: RoundPage[]; initial: number; seeded: boolean }) {
  const { scroller, cards, active, go } = useSwipePager(initial);
  return (
    <section className={s.draw} aria-label="Draw">
      <div className={s.strip} role="tablist" aria-label="Rounds" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}>
        {rounds.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            id={`round-tab-${r.id}`}
            aria-selected={active === i}
            aria-controls={`round-${r.id}`}
            className={`${s.stripBtn}${active === i ? ` ${s.stripOn}` : ''}`}
            onClick={() => go(i)}
          >
            <b>{r.name}</b>
            <small className={r.live ? s.live : undefined}>{r.live ? 'Live' : r.mw}</small>
          </button>
        ))}
      </div>
      <div className={s.pager} ref={scroller}>
        {rounds.map((r, i) => (
          <div
            key={r.id}
            id={`round-${r.id}`}
            role="tabpanel"
            aria-labelledby={`round-tab-${r.id}`}
            className={s.pg}
            ref={(el) => { cards.current[i] = el; }}
          >
            <div className={s.pgHead}>
              <h3>{r.name}</h3>
              <span className={r.live ? s.live : undefined}>{r.live ? 'Live' : r.mw}</span>
            </div>
            <p className={s.pgWhen}>{r.when}</p>
            <div className={s.stack}>
              {r.pool ? <Pool round={r} /> : r.ties.map((t) => <TieCard key={t.id} tie={t} seeded={seeded} />)}
              {r.note && <p className={s.note}>{r.note}</p>}
              {r.prize && (
                <p className={s.prize}>
                  Winner <b>€{r.prize.winner}m</b> · Runner-Up <b>€{r.prize.runnerUp}m</b>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
