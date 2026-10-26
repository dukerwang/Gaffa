'use client';

import type { ReactNode } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import { Button } from '@/components/ui/Button';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import type { MatchState, PitchPlayer, SideView } from '@/lib/matchups/matchupView';
import { fmt, ordinal } from '@/lib/matchups/roundView';
import {
  Countdown, Crest, DarkAxis, FitText, Face, FormDots, Local, Ticks, deadlineText, kickoffShort, s, verdict, weekendRange,
} from './parts';
import type { Metas, TieLite } from './types';

export interface ScoreboardProps {
  tie: TieLite;
  state: MatchState;
  gw: number;
  big?: boolean;
  myTeamId?: string;
  metas: Metas;
  window: { first: string | null; last: string | null };
  deadline: string | null;
  /** Round page: the whole card opens the matchup. */
  href?: string;
  lineupHref: string;
  squadHref: string;
  clubHref?: (teamId: string) => string;
  onOpen: (p: PitchPlayer) => void;
  /** A cup tie: no draw band, and a finished tie is decided by its winner, not the margin. */
  knockout?: { winnerId: string | null };
}

const playedFirst = (side: SideView | undefined, live: boolean) =>
  (side?.starters ?? []).filter((p) => !live || p.status !== 'pend').slice().sort((x, y) => y.points - x.points).slice(0, 3);

/** A cup tie can be level on points; it is never drawn. */
function knockoutVerdict(a: number, b: number, mine: 'A' | 'B' | null, done: boolean, winner: 'A' | 'B' | null): ReactNode {
  const m = Math.abs(a - b);
  if (done && winner) {
    if (mine) return mine === winner ? (m > 0 ? <>Through by <b>{fmt(m)}</b></> : <>Through</>) : (m > 0 ? <>Out by <b>{fmt(m)}</b></> : <>Out</>);
    return m > 0 ? <b>{fmt(m)}</b> : <>Level</>;
  }
  if (m === 0) return <>Level</>;
  if (mine) return <>{(mine === 'A') === (a > b) ? 'Ahead' : 'Behind'} by <b>{fmt(m)}</b></>;
  return <>Ahead by <b>{fmt(m)}</b></>;
}

export default function Scoreboard(props: ScoreboardProps) {
  const { tie, state, gw, big = false, myTeamId, metas, window: win, deadline, href, lineupHref, squadHref, clubHref, onOpen, knockout } = props;
  const A = tie.a, B = tie.b;
  const vA = tie.view?.a, vB = tie.view?.b;
  const mine: 'A' | 'B' | null = A.id === myTeamId ? 'A' : B?.id === myTeamId ? 'B' : null;
  const up = state === 'upcoming';
  const live = state === 'live';
  const done = state === 'final' || state === 'provisional';
  const a = tie.scoreA, b = tie.scoreB;
  const aLose = knockout
    ? done && !!knockout.winnerId && knockout.winnerId !== A.id
    : done && Math.abs(a - b) > DRAW_THRESHOLD && a < b;
  const bLose = knockout
    ? done && !!knockout.winnerId && !!B && knockout.winnerId !== B.id
    : done && Math.abs(a - b) > DRAW_THRESHOLD && b < a;
  const said = knockout ? knockoutVerdict(a, b, mine, done, knockout.winnerId === A.id ? 'A' : knockout.winnerId && B && knockout.winnerId === B.id ? 'B' : null) : verdict(a, b, mine, done);

  const meta = (teamId: string, manager: string | null, side: SideView | undefined) => {
    const m = metas[teamId];
    if (live && side) return <span className={`${s.hxMeta} ${s.hxPlay}`}><Ticks played={side.played} of={side.starters.length || 11} /><span>{side.toPlay} to play</span></span>;
    const who = manager ?? 'Caretaker';
    if (up) return <span className={s.hxMeta}>{who}{m ? <> · {ordinal(m.rank)} · <FormDots form={m.form} /></> : null}</span>;
    return <span className={s.hxMeta}><FitText text={`${who}${m ? ` · ${ordinal(m.rank)} · ${m.line}` : ''}`} className={s.fitIn} min={10} /></span>;
  };
  const eq = (side: SideView | undefined) => (big && side && !up
    ? <span className={s.hxEq}>XI <b>{fmt(side.xi)}</b> &nbsp;+&nbsp; Bench <b>{fmt(side.bench)}</b></span> : null);
  const name = (t: { id: string; name: string }) => (big && clubHref
    ? <NavigationLink href={clubHref(t.id)}><FitText text={t.name} className={s.fitIn} min={15} /></NavigationLink>
    : <FitText text={t.name} className={s.fitIn} min={15} />);

  const side = (t: TieLite['a'], sv: SideView | undefined, v: number, lose: boolean, isMine: boolean, away: boolean) => (
    <div className={`${s.hxSide}${away ? ` ${s.hxAway}` : ''}`}>
      <span className={s.dOnly}><Crest crest={t.crest} name={t.name} size={big ? 68 : 56} /></span>
      <span className={s.mOnly}><Crest crest={t.crest} name={t.name} size={40} /></span>
      <div className={s.hxTx}>
        <span className={s.hxName}>{name(t)}</span>
        {meta(t.id, t.manager, sv)}
        {eq(sv)}
      </div>
      {!up && <span className={`${s.hxRowV}${lose ? ` ${s.hxLose}` : ''}${isMine ? ` ${s.hxMine}` : ''}`}>{fmt(v)}</span>}
    </div>
  );

  const standouts = (sv: SideView | undefined) => playedFirst(sv, live).map((p) => (
    <button key={p.id} type="button" className={`${s.so} ${s.soBtn}`} onClick={() => onOpen(p)} aria-label={`${p.name}, ${fmt(p.points)} points`}>
      <Face name={p.name} photoUrl={p.photoUrl} photoVersion={p.photoVersion} slot={p.slot} size={34} onDark />
      <span className={s.soTx}><FitText className={s.soName} text={p.name} min={9.5} /><span className={s.soPts}>{fmt(p.points)}</span></span>
    </button>
  ));
  const nextUp = (sv: SideView | undefined) => {
    const withKo = (sv?.starters ?? []).filter((p) => p.fixture?.kickoffTime);
    if (!withKo.length) return null;
    const first = withKo.map((p) => p.fixture!.kickoffTime!).sort()[0];
    const at = withKo.filter((p) => p.fixture!.kickoffTime === first).slice(0, 3);
    return (
      <>
        <span className={s.soK}>First up <Local>{() => kickoffShort(first)}</Local></span>
        {at.map((p) => (
          <button key={p.id} type="button" className={`${s.so} ${s.soBtn}`} onClick={() => onOpen(p)}>
            <Face name={p.name} photoUrl={p.photoUrl} photoVersion={p.photoVersion} slot={p.slot} size={30} onDark />
            <span className={s.soTx}><span className={s.soName}>{p.name}</span></span>
          </button>
        ))}
      </>
    );
  };
  const setLineup = <Button href={lineupHref} variant="inverse" className={s.hxBtn}>Set Lineup</Button>;

  let mid: ReactNode;
  if (up) {
    mid = (
      <div className={s.hxMid}>
        {deadline ? (
          <>
            <div className={s.hxDl}><span className={s.hxDlK}><Local>{() => deadlineText(deadline)}</Local></span><span className={s.hxDlV}><Countdown iso={deadline} /></span></div>
            <div className={s.hxVerdictRow}><span className={s.hxDlK}><Local>{() => deadlineText(deadline)}</Local></span><span className={s.hxDlV} style={{ fontSize: 20 }}><Countdown iso={deadline} short /></span></div>
          </>
        ) : (
          <>
            <div className={s.hxDl}><span className={s.hxDlK}>Kickoff</span><span className={s.hxDlV} style={{ fontSize: 22 }}><Local>{() => kickoffShort(win.first)}</Local></span></div>
            <div className={s.hxVerdictRow}><span className={s.hxDlK}>Kickoff <Local>{() => kickoffShort(win.first)}</Local></span></div>
          </>
        )}
      </div>
    );
  } else {
    const fig = (v: number, lose: boolean, isMine: boolean) => <span className={`${s.hxV}${lose ? ` ${s.hxLose}` : ''}${isMine ? ` ${s.hxMine}` : ''}`}>{fmt(v)}</span>;
    mid = (
      <div className={s.hxMid}>
        <div className={s.hxFigs}>{fig(a, aLose, mine === 'A')}<span className={s.hxSep} />{fig(b, bLose, mine === 'B')}</div>
        <DarkAxis a={a} b={b} />
        <span className={s.hxVerdict}>{said}</span>
        <div className={s.hxVerdictRow}>
          <span className={s.hxVerdict}>{said}</span>
        </div>
      </div>
    );
  }

  let footD: ReactNode, footM: ReactNode;
  if (up) {
    footD = (
      <>
        <div className={s.hxFootS}>{mine === 'A' ? setLineup : nextUp(vA)}</div>
        <div className={s.hxFootS}>{nextUp(vB)}{mine === 'B' ? setLineup : null}</div>
      </>
    );
    footM = mine
      ? <div className={s.hxFootS}><Button href={lineupHref} variant="inverse" className={s.hxBtn} fullWidth>Set Lineup</Button><Button href={squadHref} variant="onDark" className={s.hxBtn} fullWidth>Squad</Button></div>
      : <div className={s.hxFootS}>{nextUp(vA)}</div>;
  } else {
    footD = <><div className={s.hxFootS}>{standouts(vA)}</div><div className={s.hxFootS}>{standouts(vB)}</div></>;
    footM = <div className={s.hxFootS}>{standouts(mine === 'B' ? vB : vA)}</div>;
  }

  const stateNode = live
    ? <span className={`${s.hxState} ${s.hxLive}`}><i className={s.ldot} />Live</span>
    : state === 'final' ? <span className={s.hxState}>Final</span>
    : state === 'provisional' ? <span className={s.hxState}>Provisional</span>
    : <span className={s.hxState}>Gameweek {gw}</span>;
  const when = <Local>{() => weekendRange(win.first, win.last)}</Local>;
  const footHas = !up || mine || (vA?.starters.length ?? 0) > 0;

  return (
    <article className={`${s.hx}${big ? ` ${s.sbBig}` : ''}`}>
      {href && <NavigationLink href={href} className={s.hxStretch} aria-label="Open matchup">{null}</NavigationLink>}
      <div className={s.hxTop}>
        {big ? <span>{when}</span> : <span>{mine ? 'Your Fixture' : 'Fixture'}<span className={s.dOnly}> · {when}</span></span>}
        <span className={s.hxTopR}>{stateNode}</span>
      </div>
      <div className={s.hxMain}>
        {side(A, vA, a, aLose, mine === 'A', false)}
        {B ? <div className={s.hxMidWrap}>{mid}</div> : null}
        {B ? side(B, vB, b, bLose, mine === 'B', true) : <div className={s.hxMid}><span className={s.hxVerdict}>Bye</span></div>}
      </div>
      {B && footHas && (
        <div className={s.hxFoot}>
          <div className={`${s.hxFootD} ${s.dOnly}`}>{footD}</div>
          <div className={`${s.hxFootM} ${s.mOnly}`}>{footM}</div>
        </div>
      )}
    </article>
  );
}
