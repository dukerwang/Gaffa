'use client';

import NavigationLink from '@/components/ui/NavigationLink';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import type { MatchState, PitchPlayer } from '@/lib/matchups/matchupView';
import { fmt, ordinal, type ResultLetter, type TableRow } from '@/lib/matchups/roundView';
import { Crest, Glyph, Local, Res, Ticks, kickoffShort, s, useWidth } from './parts';
import Worm, { WeekendDots, onClock } from './Worm';
import type { Metas, TeamLite, TieLite } from './types';

// ── Fixtures: every tie on one weekend clock ──
function Ruler({ clock, live }: { clock: string[]; live: boolean }) {
  const now = Date.now();
  return (
    <div className={s.fsRuler}>
      {clock.map((t) => <span key={t} className={live && Date.parse(t) > now ? s.fsFut : undefined}><Local>{() => kickoffShort(t)}</Local></span>)}
    </div>
  );
}

function Strip({ tie, clock, metas, myTeamId, href }: { tie: TieLite; clock: string[]; metas: Metas; myTeamId?: string; href: string }) {
  const [ref, W] = useWidth<HTMLDivElement>(520);
  const { a: A, b: B, state, view } = tie;
  if (!B) return null;
  const up = state === 'upcoming';
  const live = state === 'live';
  const done = state === 'final' || state === 'provisional';
  const a = tie.scoreA, b = tie.scoreB;
  const lose = (v: number, o: number) => done && Math.abs(v - o) > DRAW_THRESHOLD && v < o;
  const mine = A.id === myTeamId || B.id === myTeamId;
  const meta = (t: TeamLite, side: 'a' | 'b') => {
    const sv = view?.[side];
    if (live && sv) return <span className={s.fsMeta}><Ticks played={sv.played} of={sv.starters.length || 11} /></span>;
    const m = metas[t.id];
    return <span className={s.fsMeta}>{m ? `${ordinal(m.rank)} · ${m.line}` : t.manager ?? 'Caretaker'}</span>;
  };
  const side = (t: TeamLite, k: 'a' | 'b', val: number, o: number, away: boolean) => (
    <div className={`${s.fsSide}${away ? ` ${s.fsAway}` : ''}`}>
      <span className={s.dOnly}><Crest crest={t.crest} name={t.name} size={34} /></span>
      <span className={s.mOnly}><Crest crest={t.crest} name={t.name} size={28} /></span>
      <span className={s.fsTx}><span className={s.fsName}>{t.name}</span>{meta(t, k)}</span>
      {!up && <span className={`${s.fsV}${lose(val, o) ? ` ${s.fsLose}` : ''}`}>{fmt(val)}</span>}
    </div>
  );
  let mid: React.ReactNode;
  if (up && view) {
    const count = (k: 'a' | 'b', t: string) => view[k].starters.filter((p) => p.fixture?.kickoffTime === t).length;
    mid = <WeekendDots countsA={clock.map((t) => count('a', t))} countsB={clock.map((t) => count('b', t))} W={W} H={64} colorA={A.color} colorB={B.color} />;
  } else if (view) {
    mid = <Worm rs={onClock(view.slots, clock)} W={W} H={64} scale={60} live={live} colorA={A.color} colorB={B.color} />;
  }
  const verdictTxt = up ? '' : Math.abs(a - b) <= DRAW_THRESHOLD ? (done ? 'Draw' : 'Level') : `${(a > b ? A : B).name} ${done ? 'by' : '+'} ${fmt(Math.abs(a - b))}`;
  return (
    <NavigationLink href={href} className={`${s.fs}${mine ? ` ${s.fsMine}` : ''}`}>
      {side(A, 'a', a, b, false)}
      <div className={`${s.fsWorm}${view ? '' : ` ${s.fsNone}`}`}>
        {view ? <div ref={ref} className={s.wormBox}>{mid}</div> : 'Lineups lock at each player’s kickoff'}
        {!up && view && <span className={s.fsVerdict}>{live && <i className={s.ldot} style={{ color: 'var(--color-live)' }} />}{verdictTxt}</span>}
      </div>
      {side(B, 'b', b, a, true)}
    </NavigationLink>
  );
}

export function Fixtures({ ties, clock, state, metas, myTeamId, leagueId }: {
  ties: TieLite[]; clock: string[]; state: MatchState; metas: Metas; myTeamId?: string; leagueId: string;
}) {
  const live = state === 'live';
  const key = state === 'upcoming'
    ? <span className={s.fsKey}><span><i className={s.fsKeyDot} />Starters in each kickoff</span></span>
    : <span className={s.fsKey}><span>Above the line, home leads</span><span><i className={s.fsKeyBand} />Draw band</span><span>Below, away leads</span></span>;
  return (
    <section className={s.blk}>
      <div className={s.sh}><h2 className={s.shT}>Fixtures</h2><span className={`${s.shTools} ${s.dOnly}`}>{key}</span></div>
      <div className={s.panel}>
        {clock.length > 0 && (
          <>
            <div className={s.fsHead}><span className={s.lbl}>Home</span><div><Ruler clock={clock} live={live} /></div><span className={s.lbl} style={{ textAlign: 'right' }}>Away</span></div>
            <div className={s.fsRulerM}><Ruler clock={clock} live={live} /></div>
          </>
        )}
        {ties.map((t) => <Strip key={t.id} tie={t} clock={clock} metas={metas} myTeamId={myTeamId} href={`/league/${leagueId}/matchups/${t.id}`} />)}
      </div>
    </section>
  );
}

// ── Round records: every club's score on one scale ──
export interface RecordsData {
  top: { teamId: string; v: number };
  close: { a: string; b: string; margin: number };
  seasonHigh: number;
  bars: { teamId: string; v: number }[];
}
export function RoundRecords({ data, teams, myTeamId }: { data: RecordsData; teams: Record<string, TeamLite>; myTeamId?: string }) {
  const name = (id: string) => teams[id]?.name ?? '—';
  const hi = Math.max(240, ...data.bars.map((b) => b.v));
  return (
    <section className={s.blk}>
      <div className={s.sh}><h2 className={s.shT}>Round Records</h2></div>
      <div className={`${s.panel} ${s.rrPanel}`}>
        <div className={s.rrLeft}>
          <p className={s.rrLead2}>
            <b>{name(data.top.teamId)}</b> set the pace with {fmt(data.top.v)}.{' '}
            {data.close.margin <= DRAW_THRESHOLD
              ? <><b>{name(data.close.a)}</b> and <b>{name(data.close.b)}</b> finished {fmt(data.close.margin)} apart, the closest duel of the week.</>
              : <><b>{name(data.close.a)}</b> edged out <b>{name(data.close.b)}</b> by {fmt(data.close.margin)}, the closest duel of the week.</>}
          </p>
          <div className={s.rrFigs}>
            <span><b>{fmt(data.top.v)}</b>Highest Score</span>
            <span><b>{fmt(data.close.margin)}</b>Closest Match</span>
            <span><b>{fmt(data.seasonHigh)}</b>Season High</span>
          </div>
        </div>
        <div className={s.rrBars}>
          {data.bars.map((b) => (
            <div key={b.teamId} className={`${s.rrBar}${b.teamId === myTeamId ? ` ${s.rrBarMe}` : ''}`}>
              <Crest crest={teams[b.teamId]?.crest ?? null} name={name(b.teamId)} size={18} />
              <span className={s.rrBarN}>{name(b.teamId)}</span>
              <span className={s.rrBarT}><i style={{ width: `${(b.v / hi) * 100}%` }} /></span>
              <b>{fmt(b.v)}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Top performers: the whole round's spread, and who led it ──
export interface SpreadPlayer { p: PitchPlayer; owner: string; opp: string | null }
export function Spread({ all, teams, myTeamId, live, onOpen }: { all: SpreadPlayer[]; teams: Record<string, TeamLite>; myTeamId?: string; live: boolean; onOpen: (p: PitchPlayer) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>(740);
  const H = 118, r = 4.5, maxV = 45;
  const x = (v: number) => 14 + (Math.min(v, maxV) / maxV) * (W - 28);
  const top = all.slice().sort((a, b) => b.p.points - a.p.points).slice(0, 6);
  const rankOf = new Map(top.map((t, i) => [`${t.p.id}${t.owner}`, i + 1]));
  const bins = new Map<number, number>();
  const placed = all.slice().sort((a, b) => a.p.points - b.p.points).map((t) => {
    const bin = Math.min(Math.floor(Math.max(0, t.p.points) / 1.5), Math.floor(maxV / 1.5));
    const n = bins.get(bin) ?? 0; bins.set(bin, n + 1);
    const cx = x(bin * 1.5 + 0.75) + (n % 2 ? r + 0.5 : -(r + 0.5));
    const cy = (H / 2 - 22) - Math.floor(n / 2) * (2 * r + 1);
    return { cx, cy, t };
  });
  return (
    <section className={s.blk}>
      <div className={s.sh}>
        <h2 className={s.shT}>{live ? 'Top Performers So Far' : 'Top Performers'}</h2>
        <span className={`${s.shTools} ${s.dOnly}`}><span className={s.fsKey}><span><i className={s.spKeyMe} />Your starters</span><span><i className={s.spKeyO} />Everyone else’s</span></span></span>
      </div>
      <div className={s.panel}>
        <div className={s.spChart}>
          <div ref={ref} className={s.wormBox}>
            <svg className={s.sp} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Every starter’s points this round">
              {[0, 10, 20, 30, 40].map((v) => (
                <g key={v}><line x1={x(v)} x2={x(v)} y1="4" y2={H - 22} className={s.spGrid} /><text x={x(v)} y={H - 4} textAnchor="middle" className={s.spAx}>{v}</text></g>
              ))}
              {placed.map(({ cx, cy, t }) => {
                const rank = rankOf.get(`${t.p.id}${t.owner}`);
                const cls = t.owner === myTeamId ? s.spMe : s.spOther;
                if (rank) return <g key={`${t.p.id}${t.owner}`}><circle cx={cx} cy={H / 2 + cy - 4} r="9" className={`${cls} ${s.spTop}`} /><text x={cx} y={H / 2 + cy - 0.5} textAnchor="middle" className={s.spN}>{rank}</text></g>;
                return <circle key={`${t.p.id}${t.owner}`} cx={cx} cy={H / 2 + cy} r={r} className={cls} />;
              })}
            </svg>
          </div>
          <span className={s.spUnit}>Points, all {all.length} starters</span>
        </div>
        <div className={s.spList}>
          {top.map((t, i) => (
            <button key={`${t.p.id}${t.owner}`} type="button" className={s.spRow} onClick={() => onOpen(t.p)}>
              <span className={s.spRank}>{i + 1}</span>
              <Portrait photoUrl={t.p.photoUrl} name={t.p.name} club={t.p.club} size="sm" headTopPct={t.p.headTopPct} headWidthPct={t.p.headWidthPct} photoVersion={t.p.photoVersion} />
              <span className={s.spTx}>
                <span className="g-namerow"><b className={s.spName}>{t.p.name}</b><PositionBadge position={t.p.slot} size="sm" /></span>
                <span className={s.spCtx}><Crest crest={teams[t.owner]?.crest ?? null} name={teams[t.owner]?.name ?? ''} size={13} />{teams[t.owner]?.name}{t.opp && <span className={s.muted}>&nbsp;v {teams[t.opp]?.name}</span>}</span>
              </span>
              <span className={s.spPts}>{fmt(t.p.points)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface SeasonTopRow { id: string; name: string; slot: string; club: string | null; photoUrl: string | null; photoVersion: string | null; headTopPct: number | null; headWidthPct: number | null; owner: string; pts: number; apps: number }
export function SeasonList({ rows, teams, onOpenId }: { rows: SeasonTopRow[]; teams: Record<string, TeamLite>; onOpenId: (id: string, slot: string) => void }) {
  return (
    <section className={s.blk}>
      <div className={s.sh}><h2 className={s.shT}>Top Performers</h2><span className={s.shTools}><span className={s.lbl}>Season So Far</span></span></div>
      <div className={s.panel}>
        {rows.length === 0 ? <p className={s.empty}>No points scored yet this season.</p> : (
          <div className={s.spList}>
            {rows.map((p, i) => (
              <button key={p.id} type="button" className={s.spRow} onClick={() => onOpenId(p.id, p.slot)}>
                <span className={s.spRank}>{i + 1}</span>
                <Portrait photoUrl={p.photoUrl} name={p.name} club={p.club} size="sm" headTopPct={p.headTopPct} headWidthPct={p.headWidthPct} photoVersion={p.photoVersion} />
                <span className={s.spTx}>
                  <span className="g-namerow"><b className={s.spName}>{p.name}</b><PositionBadge position={p.slot} size="sm" /></span>
                  <span className={s.spCtx}><Crest crest={teams[p.owner]?.crest ?? null} name={teams[p.owner]?.name ?? ''} size={13} />{teams[p.owner]?.name}<span className={s.muted}>&nbsp;· {p.apps} {p.apps === 1 ? 'app' : 'apps'}</span></span>
                </span>
                <span className={s.spPts}>{fmt(p.pts)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── The table, as this round left it ──
export function Standings({ rows, moves, gwRes, gw, teams, myTeamId, leagueId, clubHref }: {
  rows: TableRow[]; moves: Record<string, number>; gwRes: Record<string, { r: ResultLetter; my: number; opp: number }>; gw: number;
  teams: Record<string, TeamLite>; myTeamId?: string; leagueId: string; clubHref: (id: string) => string;
}) {
  const mv = (n: number) => (n > 0 ? <span className={`${s.stMv} ${s.stUp}`}><Glyph k="up" size={11} />{n}</span>
    : n < 0 ? <span className={`${s.stMv} ${s.stDn}`}><Glyph k="down" size={11} />{-n}</span>
    : <span className={`${s.stMv} ${s.stEq}`}>–</span>);
  return (
    <section className={s.blk}>
      <div className={s.sh}><h2 className={s.shT}>Standings</h2></div>
      <div className={s.panel}>
        <div className={`${s.tbH} ${s.lbl}`}><span>#</span><span /><span /><span>Club</span><span>GW{gw}</span><span>W-D-L</span><span>Pts</span></div>
        {rows.map((r) => {
          const res = gwRes[r.teamId];
          return (
            <NavigationLink key={r.teamId} href={clubHref(r.teamId)} className={`${s.tbR}${r.teamId === myTeamId ? ` ${s.stMine}` : ''}`}>
              <span className={s.stRk}>{r.rank}</span>
              {mv(moves[r.teamId] ?? 0)}
              <Crest crest={teams[r.teamId]?.crest ?? null} name={teams[r.teamId]?.name ?? ''} size={18} />
              <span className={s.stName}>{teams[r.teamId]?.name}</span>
              {res ? <span title={`${fmt(res.my)}–${fmt(res.opp)}`}><Res r={res.r} /></span> : <span />}
              <span className={s.stNum}>{r.W}-{r.D}-{r.L}</span>
              <span className={s.stPts}>{r.pts}</span>
            </NavigationLink>
          );
        })}
        <div className={s.stFoot}><span>Arrows show movement this round</span><NavigationLink href={`/league/${leagueId}/standings`} className={s.quiet}>Full Table<Glyph k="right" size={13} /></NavigationLink></div>
      </div>
    </section>
  );
}
