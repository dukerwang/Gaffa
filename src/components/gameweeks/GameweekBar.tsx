'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import NavigationLink from '@/components/ui/NavigationLink';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import type { MatchState } from '@/lib/matchups/matchupView';
import { fmt, ordinal, type RibbonCell, type TeamMeta } from '@/lib/matchups/roundView';
import { Crest, Glyph, Local, deadlineText, s, weekendRange } from './parts';
import type { TieLite } from './types';

function Ribbon({ cells, sel, record, onPick }: { cells: RibbonCell[]; sel: number; record: TeamMeta | null; onPick: (gw: number) => void }) {
  return (
    <div className={s.rib}>
      {record && <span className={`${s.ribK} ${s.dOnly}`}><b>{ordinal(record.rank)} · {record.pts} pts</b><span>W{record.W} D{record.D} L{record.L}</span></span>}
      <div className={s.ribCells}>
        {cells.map((c) => {
          const on = c.gw === sel;
          let bar: React.ReactNode, label: string;
          if (c.live && on) { bar = null; label = `Gameweek ${c.gw}, live`; }
          else if (c.r && !c.live) {
            const h = Math.max(5, Math.round((Math.min(c.margin, 50) / 50) * 17));
            bar = c.r === 'D' ? <i className={`${s.rcBar} ${s.rcD}`} /> : <i className={`${s.rcBar} ${c.r === 'W' ? s.rcW : s.rcL}`} style={{ height: h }} />;
            label = `Gameweek ${c.gw}, ${c.r === 'W' ? 'won' : c.r === 'L' ? 'lost' : 'drew'} by ${fmt(c.margin)}`;
          } else { bar = <i className={`${s.rcBar} ${s.rcF}`} />; label = `Gameweek ${c.gw}`; }
          const n = on || c.gw === 1 || c.gw % 5 === 0 || c.gw === 38 ? c.gw : '';
          return (
            <button key={c.gw} type="button" disabled={!c.exists} onClick={() => onPick(c.gw)}
              className={`${s.rc}${on ? ` ${s.rcOn}` : ''}${c.live ? ` ${s.rcLive}` : ''}`}
              aria-label={label} aria-current={on ? 'true' : undefined}>
              <span className={s.rcAx}>{bar}</span><span className={s.rcN}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GameweekBar({ leagueId, gw, gameweeks, ribbon, record, state, window: win, deadline }: {
  leagueId: string; gw: number; gameweeks: number[]; ribbon: RibbonCell[]; record: TeamMeta | null;
  state: MatchState; window: { first: string | null; last: string | null }; deadline: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const go = (n: number) => {
    if (!gameweeks.includes(n) || n === gw) return;
    window.dispatchEvent(new Event('navigation-start'));
    start(() => router.push(`/league/${leagueId}/matchups?gw=${n}`, { scroll: false }));
  };
  const i = gameweeks.indexOf(gw);
  const prev = i > 0 ? gameweeks[i - 1] : null;
  const next = i >= 0 && i < gameweeks.length - 1 ? gameweeks[i + 1] : null;
  const select = (
    <select className={s.gwSelNative} value={gw} onChange={(e) => go(Number(e.target.value))} aria-label="Choose a gameweek">
      {gameweeks.map((g) => <option key={g} value={g}>Gameweek {g}</option>)}
    </select>
  );
  const sub = state === 'upcoming'
    ? <Local>{() => deadline ? deadlineText(deadline) : weekendRange(win.first, win.last)}</Local>
    : <>{state === 'live' ? 'Live' : state === 'final' ? 'Final' : 'Provisional'} · <Local>{() => weekendRange(win.first, win.last)}</Local></>;

  return (
    <nav className={s.gwb} aria-label="Gameweeks">
      <span className={`${s.gwbName} ${s.dOnly}`}>Gameweeks</span>
      <span className={`${s.gwbStep} ${s.dOnly}`}>
        <button type="button" className={s.arw} disabled={prev == null} onClick={() => prev != null && go(prev)} aria-label="Previous gameweek"><Glyph k="left" size={18} /></button>
        <span className={s.gwSel} style={{ position: 'relative' }}>Gameweek {gw}<Glyph k="chev" />{select}</span>
        <button type="button" className={s.arw} disabled={next == null} onClick={() => next != null && go(next)} aria-label="Next gameweek"><Glyph k="right" size={18} /></button>
      </span>
      <span className={`${s.gwbStepM} ${s.mOnly}`}>
        <button type="button" className={s.arwM} disabled={prev == null} onClick={() => prev != null && go(prev)} aria-label="Previous gameweek"><Glyph k="left" size={20} /></button>
        <span className={s.gwSelM}>
          <span className={s.gwSelT}>Gameweek {gw}<Glyph k="chev" /></span>
          <span className={`${s.gwSelS}${state === 'live' ? ` ${s.gwSelLive}` : ''}`}>{sub}</span>
          {select}
        </span>
        <button type="button" className={s.arwM} disabled={next == null} onClick={() => next != null && go(next)} aria-label="Next gameweek"><Glyph k="right" size={20} /></button>
      </span>
      <Ribbon cells={ribbon} sel={gw} record={record} onPick={go} />
    </nav>
  );
}

/** Back to the round, and the round's other ties. */
export function MatchBar({ leagueId, gw, ties, current }: { leagueId: string; gw: number; ties: TieLite[]; current: string }) {
  return (
    <nav className={`${s.gwb} ${s.gwbBar}`} aria-label={`Gameweek ${gw} fixtures`}>
      <NavigationLink href={`/league/${leagueId}/matchups?gw=${gw}`} className={s.mbBack}><Glyph k="left" size={18} />Gameweek {gw}</NavigationLink>
      <div className={s.mbTies}>
        {ties.map((t) => {
          const on = t.id === current;
          const scored = t.state !== 'upcoming' && t.b;
          const done = t.state === 'final' || t.state === 'provisional';
          return (
            <NavigationLink key={t.id} href={`/league/${leagueId}/matchups/${t.id}`} className={`${s.tie}${on ? ` ${s.tieOn}` : ''}`}
              aria-label={`${t.a.name} v ${t.b?.name ?? 'Bye'}`} aria-current={on ? 'page' : undefined}>
              <Crest crest={t.a.crest} name={t.a.name} size={20} />
              {scored ? (
                <>
                  <span className={`${s.tieV}${done && t.scoreA < t.scoreB - DRAW_THRESHOLD ? ` ${s.tieL}` : ''}`}>{fmt(t.scoreA)}</span>
                  <span className={s.tieDash}>–</span>
                  <span className={`${s.tieV}${done && t.scoreB < t.scoreA - DRAW_THRESHOLD ? ` ${s.tieL}` : ''}`}>{fmt(t.scoreB)}</span>
                </>
              ) : <span className={s.tieDash}>v</span>}
              {t.b && <Crest crest={t.b.crest} name={t.b.name} size={20} />}
            </NavigationLink>
          );
        })}
      </div>
    </nav>
  );
}
