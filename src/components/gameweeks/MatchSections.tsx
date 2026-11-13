'use client';

import { useState, type ReactNode } from 'react';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import PerformanceBlock, { PerformanceSignature } from '@/components/players/PerformanceBlock';
import { renderBoldedText } from '@/lib/narrative/boldText';
import type { MatchReport } from '@/lib/narrative/matchReport';
import type { BenchPlayer, Line, MatchState, MatchupView, PitchPlayer, SideView } from '@/lib/matchups/matchupView';
import { fmt } from '@/lib/matchups/roundView';
import { Crest, Face, FitText, Glyph, Local, Pts, kickoffShort, s, useWidth } from './parts';
import { Disclosure } from '@/components/ui/Disclosure';
import RowPitch, { rowCount } from './RowPitch';
import { useSwipePager } from './useSwipePager';
import Worm, { onClock, turnIndex } from './Worm';
import type { TeamLite } from './types';

export const LINES: Line[] = ['Goalkeeper', 'Defence', 'Midfield', 'Attack'];
type Open = (p: PitchPlayer) => void;

// ── Lineups: each club's own half, both attacking up, each bench under its own half ──
function BenchOne({ side, state, onOpen }: { side: SideView; state: MatchState; onOpen: Open }) {
  const up = state === 'upcoming';
  return (
    <div className={s.bnSide}>
      <div className={s.bnH}>
        <span className={s.bnT}>Bench</span>
        {up ? <span className={s.bnBonus}>25% of each unused player’s points</span> : <span className={s.bnBonus}>Bench Bonus <b>+{fmt(side.bench)}</b></span>}
      </div>
      <div className={s.bnChips}>
        {side.benchPlayers.map((p) => {
          const line = p.status === 'pend'
            ? <><b>{p.fixture?.opponentShort ?? ''}</b> <Local>{() => { const k = kickoffShort(p.fixture?.kickoffTime); const i = k.indexOf(' '); return <><span className={s.bnWide}>{k.slice(0, i)} </span>{k.slice(i + 1)}</>; }}</Local></>
            : p.status === 'dnp' ? 'Did not play'
            : p.cameOn ? 'Came on' : <><b>+{fmt(p.credit)}</b><span className={s.bnWide}> to total</span></>;
          return (
            <div key={p.id} className={s.bnSlot}>
              <button type="button" className={`${s.ch}${p.status === 'pend' ? ` ${s.chPend}` : p.status === 'dnp' ? ` ${s.chDnp}` : ''}`} onClick={() => onOpen(p)} aria-label={`${p.name}, bench`}>
                <span className={s.chPor}>
                  <Portrait photoUrl={p.photoUrl} name={p.name} club={p.club} size="xs" headTopPct={p.headTopPct} headWidthPct={p.headWidthPct} photoVersion={p.photoVersion} />
                  <Pts v={p.points} status={p.status} />
                </span>
                <span className={s.chBox}>
                  <PositionBadge position={p.slot} size="sm" />
                  <FitText className={s.chName} text={p.name} />
                  <span className={s.chStats}>{line}</span>
                </span>
              </button>
              <span className={s.bnCat}>{p.benchSlot}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Lineups({ view, teams, onOpen, mineFirst }: { view: MatchupView; teams: { a: TeamLite; b: TeamLite }; onOpen: Open; mineFirst: 'a' | 'b' }) {
  const minRows = Math.max(rowCount(view.a.starters), rowCount(view.b.starters));
  const up = view.state === 'upcoming';
  const { scroller, cards, active, go } = useSwipePager();
  // Your own club first, so a phone opens on your half; wide screens flip it back to the scoreboard's order in CSS.
  const order: ('a' | 'b')[] = mineFirst === 'b' ? ['b', 'a'] : ['a', 'b'];
  const other = teams[order[active === 0 ? 1 : 0]];
  const col = (side: SideView, t: TeamLite, i: number) => (
    <div className={s.lsCol} key={t.id} ref={(el) => { cards.current[i] = el; }}>
      <div className={s.lsHead}>
        <Crest crest={t.crest} name={t.name} size={22} />
        <b>{t.name}</b>
        {side.formation && <span className={s.lbl}>{side.formation}</span>}
        {!up && <span className={s.lsScore}>{fmt(side.score)}</span>}
      </div>
      <RowPitch starters={side.starters} minRows={minRows} onOpen={onOpen} />
      <BenchOne side={side} state={view.state} onOpen={onOpen} />
    </div>
  );
  return (
    <section className={s.blk}>
      <div className={s.sh}>
        <h2 className={s.shT}>Lineups</h2>
        <span className={s.shTools}>
          <span className={s.lnKeyWrap}><span className={s.lnKey}>{[0, 2, 5.6, 15.8, 29].map((v) => <Pts key={v} v={v} />)}</span></span>
          <span className={`${s.swpPager} ${s.lsPg}`} role="tablist" aria-label="Lineups">
            {order.map((k, i) => (
              <button key={k} type="button" role="tab" aria-selected={active === i} aria-label={teams[k].name}
                className={`${s.swpDot}${active === i ? ` ${s.swpOn}` : ''}`} onClick={() => go(i)}>
                <Crest crest={teams[k].crest} name={teams[k].name} size={14} />
              </button>
            ))}
          </span>
        </span>
      </div>
      <div ref={scroller} className={s.lsSwp}>
        <div className={`${s.lsGrid}${mineFirst === 'b' ? ` ${s.lsFlip}` : ''}`}>{order.map((k, i) => col(view[k], teams[k], i))}</div>
      </div>
      <div className={`${s.swpFoot} ${s.lsPg}`} aria-hidden="true">
        <span className={s.swpBar}>{order.map((k, i) => <i key={k} className={active === i ? s.swpBarOn : undefined} />)}</span>
        <span>Swipe for {other.name}</span>
      </div>
    </section>
  );
}

// ── Line totals: where the matchup was won and lost ──
export function LineTotals({ view, teams }: { view: MatchupView; teams: { a: TeamLite; b: TeamLite } }) {
  const rows: [string, number, number][] = [...LINES.map((l) => [l, view.a.lines[l], view.b.lines[l]] as [string, number, number]), ['Bench Bonus', view.a.bench, view.b.bench]];
  const max = Math.max(1, ...rows.flatMap((r) => [r[1], r[2]]));
  const edge = (d: number) => (
    <span className={`${s.ltD}`}>
      <Crest crest={(d >= 0 ? teams.a : teams.b).crest} name={(d >= 0 ? teams.a : teams.b).name} size={12} />{fmt(Math.abs(d))}
    </span>
  );
  return (
    <section className={s.blk}>
      <div className={s.sh}><h2 className={s.shT}>Line Totals</h2></div>
      <div className={s.panel}>
        <div className={s.ltH}>
          <span />
          <span className={s.ltHc}><Crest crest={teams.a.crest} name={teams.a.name} size={16} /></span>
          <span />
          <span className={s.ltHc}><Crest crest={teams.b.crest} name={teams.b.name} size={16} /></span>
          <span className={s.lbl}>Edge</span>
        </div>
        {rows.map(([l, a, b]) => (
          <div key={l} className={s.ltR}>
            <span className={s.ltL}>{l}</span>
            <span className={s.ltV}>{fmt(a)}</span>
            <span className={s.ltBar}>
              <i style={{ right: '50%', width: `${(a / max) * 50}%`, background: teams.a.color }} />
              <i style={{ left: '50%', width: `${(b / max) * 50}%`, background: teams.b.color }} />
            </span>
            <span className={s.ltV}>{fmt(b)}</span>
            {edge(a - b)}
          </div>
        ))}
        <div className={`${s.ltR} ${s.ltTot}`}>
          <span className={s.ltL}>Total</span>
          <span className={s.ltV}>{fmt(view.a.score)}</span>
          <span />
          <span className={s.ltV}>{fmt(view.b.score)}</span>
          {edge(view.a.score - view.b.score)}
        </div>
      </div>
    </section>
  );
}

// ── Match report, or who is still to play while it is live ──
export function Report({ view, teams, onOpenId }: { view: MatchupView; teams: { a: TeamLite; b: TeamLite }; onOpenId: (id: string) => void }) {
  if (view.state === 'live') {
    const slots = view.slots.filter((x) => x.toPlayA.length || x.toPlayB.length);
    return (
      <section className={s.blk}>
        <div className={s.sh}><h2 className={s.shT}>Still to Play</h2></div>
        <div className={s.panel}>
          <div className={s.mrBody}>
            {slots.length === 0 && <p className={s.muted}>Every starter has kicked off.</p>}
            {slots.map((x, i) => (
              <div key={x.t} className={`${s.mrCol}${i === 0 ? ` ${s.mrColFirst}` : ''}`}>
                <span className={s.mrColH}><Glyph k="clock" /><Local>{() => kickoffShort(x.t)}</Local></span>
                {([['a', x.toPlayA], ['b', x.toPlayB]] as const).map(([k, who]) => (
                  <div key={k} className={s.stpR}>
                    <Crest crest={teams[k].crest} name={teams[k].name} size={16} />
                    <span className={s.nm}>{who.map((p) => p.name).join(', ') || 'Nobody'}</span>
                    <span className={s.lbl}>{who.length}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  const r: MatchReport | null = view.report;
  if (!r) return null;
  const text = `${r.starHighlight} ${r.disappointmentHighlight}`;
  const named = [...view.a.starters, ...view.b.starters].filter((p) => text.includes(p.name.replace(/^[A-Z]\.\s?/, ''))).slice(0, 2);
  const bold = (t: string) => renderBoldedText(t, onOpenId);
  return (
    <section className={s.blk}>
      <div className={s.sh}>
        {named.length > 0 && <span className={s.fstack}>{named.map((p) => <Face key={p.id} name={p.name} photoUrl={p.photoUrl} photoVersion={p.photoVersion} slot={p.slot} size={34} />)}</span>}
        <h2 className={s.shT}>Match Report</h2>
      </div>
      <div className={s.panel}>
        <div className={s.mrBody}>
          <h3 className={s.mrHead}>{bold(r.headline)}</h3>
          <p className={s.mrLead}>{bold(r.leadParagraph)}</p>
          <div className={s.mrCol}><span className={s.mrColH}><Glyph k="star" />Star of the Match</span><p>{bold(r.starHighlight)}</p></div>
          <div className={s.mrCol}><span className={s.mrColH}><Glyph k="down" />Boardroom Notes</span><p>{bold(r.disappointmentHighlight)}</p></div>
          <span className={s.mrBy}>{r.byline}</span>
        </div>
      </div>
    </section>
  );
}

// ── Momentum: the margin across the weekend, slot by slot ──
export function Momentum({ view, teams }: { view: MatchupView; teams: { a: TeamLite; b: TeamLite } }) {
  const [open, setOpen] = useState(false);
  const [ref, W] = useWidth<HTMLDivElement>(1100);
  const live = view.state === 'live';
  const rs = onClock(view.slots, view.slots.map((x) => x.t));
  if (!rs.length) return null;
  const phone = W < 600;
  const last = live ? rs.map((r) => r.started).lastIndexOf(true) : rs.length - 1;
  const turn = turnIndex(rs, last);
  const name = (k: 'a' | 'b') => teams[k].name;
  const lane = (i: number) => {
    const x = view.slots[i];
    const fut = live && i > last;
    const row = (k: 'a' | 'b') => {
      const who = fut ? (k === 'a' ? x.toPlayA : x.toPlayB) : (k === 'a' ? x.whoA : x.whoB).filter((p) => p.points > 0 && !p.bench).slice(0, 3);
      const gained = k === 'a' ? x.a : x.b;
      return (
        <span className={s.mlR}>
          <span className={s.mlSw} style={{ background: teams[k].color }} />
          {fut ? <b className={s.muted}>{who.length}</b> : <b>+{gained.toFixed(1)}</b>}
          <span className={s.facesRow}>{who.map((p) => <Face key={p.id} name={p.name} photoUrl={p.photoUrl} photoVersion={p.photoVersion} slot={p.slot} size={22} />)}</span>
        </span>
      );
    };
    const margin = x.cumA - x.cumB;
    const lead = fut ? 'To Play' : i === turn ? 'Lead Changed' : Math.abs(margin) <= 10 ? 'Level' : `${margin > 0 ? name('a') : name('b')} +${Math.abs(margin).toFixed(1)}`;
    return (
      <div key={x.t} className={`${s.ml}${i === turn ? ` ${s.mlTurn}` : ''}${fut ? ` ${s.mlFut}` : ''}`}>
        <span className={s.mlT}><Local>{() => kickoffShort(x.t)}</Local></span>
        <span className={s.mlLead}>{lead}</span>
        {row('a')}{row('b')}
      </div>
    );
  };
  const endM = last >= 0 ? rs[last].cumA - rs[last].cumB : 0;
  const summary = turn >= 0
    ? <>Lead changed <Local>{() => kickoffShort(rs[turn].t)}</Local></>
    : live ? `${rs.length - last - 1} kickoff${rs.length - last - 1 === 1 ? '' : 's'} to come`
    : `${Math.abs(endM) <= 10 ? 'Level' : `${endM > 0 ? name('a') : name('b')} led`} throughout`;
  const lanes = (
    <div className={s.mmLanes} style={{ gridTemplateColumns: `repeat(${rs.length}, minmax(0, 1fr))` }}>
      {rs.map((_, i) => lane(i))}
    </div>
  );
  return (
    <section className={s.blk}>
      <div className={s.sh}>
        <h2 className={s.shT}>Momentum</h2>
        <span className={`${s.shTools} ${s.mmKey}`}>
          <span className={s.fsKey}>
            <span><i style={{ background: teams.a.color }} />{name('a')} ahead</span>
            <span><i className={s.fsKeyBand} />Draw band</span>
            <span><i style={{ background: teams.b.color }} />{name('b')} ahead</span>
          </span>
        </span>
      </div>
      <div className={s.panel}>
        <div className={s.mmChart}>
          <div ref={ref} className={s.wormBox}>
            <Worm rs={rs} W={W} H={phone ? 150 : 200} scale={50} live={live} colorA={teams.a.color} colorB={teams.b.color} labels={!phone} turnTag pad={8} />
          </div>
        </div>
        {/* A wide screen shows every kickoff. A phone folds them under the kit's Disclosure. */}
        {phone ? (
          <Disclosure className={s.mmDisc} title="Kickoffs" meta={summary} open={open} onOpenChange={setOpen}>{lanes}</Disclosure>
        ) : lanes}
      </div>
    </section>
  );
}

// ── Team sheets: one per club, grouped by line ──
function SheetRow({ p, open, onToggle, onOpen }: { p: PitchPlayer; open: boolean; onToggle: () => void; onOpen: Open }) {
  const fx = p.fixture;
  const statTxt = p.stats.join(' · ') + (p.rating != null && p.status === 'played' ? `${p.stats.length ? ' · ' : ''}${p.rating.toFixed(2)} rating` : '');
  const sub = p.status === 'pend'
    ? <>{fx?.opponent ?? ''} · <Local>{() => kickoffShort(fx?.kickoffTime)}</Local></>
    : p.status === 'dnp' ? <>Did not play<span className={s.dOnly}> · no bench cover</span></>
    : `${p.subIn && p.replacedName ? `On for ${p.replacedName}${statTxt ? ' · ' : ''}` : ''}${statTxt}`;
  const canOpen = !!p.perf?.length && p.status === 'played';
  const pts = p.status === 'pend' ? <span className={`${s.shP} ${s.shP0}`}>–</span> : <span className={`${s.shP}${p.status === 'dnp' ? ` ${s.shP0}` : ''}`}>{fmt(p.status === 'dnp' ? 0 : p.points)}</span>;
  return (
    <div className={`${s.shE}${open ? ` ${s.shOpen}` : ''}`}>
      <div className={`${s.shRow}${canOpen ? ` ${s.shRowBtn}` : ''}`} role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined}
        aria-expanded={canOpen ? open : undefined} onClick={canOpen ? onToggle : undefined}
        onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}>
        <PositionBadge position={p.slot} size="sm" />
        <Portrait photoUrl={p.photoUrl} name={p.name} club={null} size="xxs" headTopPct={p.headTopPct} headWidthPct={p.headWidthPct} photoVersion={p.photoVersion} />
        <span className={s.shTx}>
          <b><button type="button" className={s.shNameBtn} onClick={(e) => { e.stopPropagation(); onOpen(p); }}>{p.name}{p.subIn && <Glyph k="up" size={12} />}</button></b>
          <span>{sub}</span>
        </span>
        {canOpen ? (
          <PerformanceSignature groups={p.perf!} />
        ) : <span />}
        {pts}
      </div>
      {open && canOpen && <div className={s.shPerf}><PerformanceBlock groups={p.perf!} note={`Centre line is the median for ${/^[AEIOU]/.test(p.slot) ? 'an' : 'a'} ${p.slot}`} /></div>}
    </div>
  );
}


/** A bench row opens its scoring detail the way a starter's does, when he played. The right-hand figure is what the bench bonus paid. */
function BenchRow({ b, sub, open, onToggle, onOpen }: { b: BenchPlayer; sub: ReactNode; open: boolean; onToggle: () => void; onOpen: Open }) {
  const canOpen = !!b.perf?.length && b.status === 'played';
  const paid = b.status === 'played' && b.credit;
  return (
    <div className={`${s.shE}${open ? ` ${s.shOpen}` : ''}`}>
      <div className={`${s.shRow}${canOpen ? ` ${s.shRowBtn}` : ''}`} role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined}
        aria-expanded={canOpen ? open : undefined} onClick={canOpen ? onToggle : undefined}
        onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } } : undefined}>
        <PositionBadge position={b.slot} size="sm" />
        <Portrait photoUrl={b.photoUrl} name={b.name} club={null} size="xxs" headTopPct={b.headTopPct} headWidthPct={b.headWidthPct} photoVersion={b.photoVersion} />
        <span className={s.shTx}>
          <b><button type="button" className={s.shNameBtn} onClick={(e) => { e.stopPropagation(); onOpen(b); }}>{b.name}</button></b>
          <span>{sub}</span>
        </span>
        {canOpen ? <PerformanceSignature groups={b.perf!} /> : <span />}
        <span className={`${s.shP}${paid ? '' : ` ${s.shP0}`}`}>{paid ? `+${fmt(b.credit)}` : '–'}</span>
      </div>
      {open && canOpen && <div className={s.shPerf}><PerformanceBlock groups={b.perf!} note={`Centre line is the median for ${/^[AEIOU]/.test(b.slot) ? 'an' : 'a'} ${b.slot}`} /></div>}
    </div>
  );
}

function TeamSheet({ side, team, state, onOpen }: { side: SideView; team: TeamLite; state: MatchState; onOpen: Open }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const up = state === 'upcoming';
  const byLine: Record<Line, PitchPlayer[]> = { Goalkeeper: [], Defence: [], Midfield: [], Attack: [] };
  const ZL: Record<string, Line> = { GK: 'Goalkeeper', CB: 'Defence', LB: 'Defence', RB: 'Defence', LWB: 'Defence', RWB: 'Defence', DM: 'Midfield', CM: 'Midfield', AM: 'Midfield', LW: 'Attack', RW: 'Attack', ST: 'Attack' };
  for (const p of side.starters) byLine[ZL[p.slot] ?? 'Midfield'].push(p);
  const benchTxt = (b: BenchPlayer) => b.status === 'pend'
    ? <>{b.fixture?.opponent ?? ''} · <Local>{() => kickoffShort(b.fixture?.kickoffTime)}</Local></>
    : b.status === 'dnp' ? 'Did not play' : b.cameOn ? 'Came on as an auto-sub' : `${fmt(b.points)} pts × 25%`;
  return (
    <div className={`${s.panel} ${s.shPanel}`}>
      <div className={s.shHead}>
        <Crest crest={team.crest} name={team.name} size={24} />
        <span className={s.shName}>{team.name}</span>
        {side.formation && <span className={s.lbl}>{side.formation}</span>}
        {!up && <span className={s.shTot}>{fmt(side.score)}</span>}
      </div>
      {LINES.map((l) => (
        <div key={l} className={s.shLine}>
          <div className={s.shLH}><span>{l}</span>{!up && <b>{fmt(side.lines[l])}</b>}</div>
          {byLine[l].map((p) => (
            <SheetRow key={p.id} p={p} open={openId === p.id} onToggle={() => setOpenId((v) => (v === p.id ? null : p.id))} onOpen={onOpen} />
          ))}
        </div>
      ))}
      <div className={s.shLine}>
        <div className={s.shLH}><span>Bench</span>{!up && <b>+{fmt(side.bench)}</b>}</div>
        {side.benchPlayers.map((b) => (
          <BenchRow key={b.id} b={b} sub={<>{b.benchSlot} · {benchTxt(b)}</>} open={openId === b.id} onToggle={() => setOpenId((v) => (v === b.id ? null : b.id))} onOpen={onOpen} />
        ))}
      </div>
      {!up && (
        <>
          <div className={s.shSum}><span>Starting XI</span><b>{fmt(side.xi)}</b></div>
          <div className={s.shSum}><span>Bench Bonus</span><b>{fmt(side.bench)}</b></div>
          <div className={`${s.shSum} ${s.shTotal}`}><span>Total</span><b>{fmt(side.score)}</b></div>
        </>
      )}
    </div>
  );
}

export { TeamSheet };
