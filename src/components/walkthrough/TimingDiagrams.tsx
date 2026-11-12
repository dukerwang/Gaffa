'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Portrait from '@/components/players/Portrait';
import {
  DECAY_BANDS,
  TIER_1_FLOOR_MS,
  TIER_1_MAX_MV,
  TIER_2_FLOOR_MS,
  TIER_2_MAX_MV,
  TIER_3_FLOOR_MS,
  TIER_3_MAX_MV,
  TIER_4_FLOOR_MS,
} from '@/lib/auction/timer';
import { FIGURES, MERIT, SCOUT_PCT, SOLIDARITY_PCT, type Diagram } from '@/lib/walkthroughs/chapters';
import { PINNED } from '@/lib/walkthroughs/players';
import PositionBadge from '@/components/players/PositionBadge';
import Trophy from '@/components/trophies/Trophy';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import s from './TimingDiagrams.module.css';

const HOUR = 3_600_000;
/** The real auction: hours after its first bid that each of its 26 bids landed. */
const BARCOLA_BID_HOURS = [0, 4.23, 4.67, 11.7, 25.47, 25.49, 34.36, 39.42, 46.35, 46.36, 46.84, 46.85, 46.86, 50.02, 50.42, 50.51, 50.51, 50.54, 50.55, 55.66, 56.35, 65.19, 68.91, 71.05, 73.5, 74.47];
const BARCOLA_MIN_HOURS = 72;
const BARCOLA_LAST_BID = 74.47;
const BARCOLA_CLOSED = 76.47;

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function Lengths() {
  const rows: [string, number][] = [
    [`Under €${TIER_1_MAX_MV}m`, TIER_1_FLOOR_MS / HOUR],
    [`€${TIER_1_MAX_MV}m–€${TIER_2_MAX_MV}m`, TIER_2_FLOOR_MS / HOUR],
    [`€${TIER_2_MAX_MV}m–€${TIER_3_MAX_MV}m`, TIER_3_FLOOR_MS / HOUR],
    [`€${TIER_3_MAX_MV}m and Up`, TIER_4_FLOOR_MS / HOUR],
  ];
  const longest = TIER_4_FLOOR_MS / HOUR;
  return (
    <div className={s.rows}>
      {rows.map(([label, hours]) => (
        <div className={s.row} key={label} data-on={hours === longest || undefined}>
          <span className={s.rowLabel}>{label}</span>
          <span className={s.track}><i style={{ width: `${(hours / longest) * 100}%` }} /></span>
          <span className={s.rowValue}>{hours}h</span>
        </div>
      ))}
      <div className={s.note}>
        <Portrait size="sm" {...PINNED.barcola} />
        <span><b>Barcola</b>, valued €90m, stayed open at least {longest} hours.</span>
      </div>
    </div>
  );
}

function bandLabel(from: number, until: number) {
  if (!Number.isFinite(until)) return `${from}h and Up`;
  return from === 0 ? `Under ${until}h Old` : `${from}h–${until}h`;
}

function Countdown() {
  const bands = DECAY_BANDS.map((b, i) => {
    const prev = i === 0 ? 0 : DECAY_BANDS[i - 1].untilAgeMs / HOUR;
    return { label: bandLabel(prev, b.untilAgeMs / HOUR), hours: b.timeoutMs / HOUR };
  });
  const tallest = Math.max(...bands.map((b) => b.hours));
  return (
    <div className={s.steps}>
      {bands.map((b) => (
        <div className={s.step} key={b.label}>
          <div className={s.well}><div className={s.bar} style={{ height: `${(b.hours / tallest) * 100}%` }}><b>{b.hours}h</b></div></div>
          <span className={s.stepLabel}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function Close() {
  const [ref, w] = useWidth(480);
  const h = 104;
  const x = (t: number) => 2 + (t / 80) * (w - 4);
  return (
    <div ref={ref}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Barcola auction timeline">
        <rect x={x(0)} y="40" width={x(BARCOLA_MIN_HOURS) - x(0)} height="24" rx="4" fill="var(--color-bg-inset)" />
        <text className={s.svgLabel} x={x(0) + 10} y="56">Minimum Length</text>
        {BARCOLA_BID_HOURS.map((t, i) => <line key={i} x1={x(t)} x2={x(t)} y1="20" y2="34" stroke="var(--color-accent)" strokeWidth="1.5" />)}
        <rect x={x(BARCOLA_LAST_BID)} y="40" width={x(BARCOLA_CLOSED) - x(BARCOLA_LAST_BID)} height="24" fill="var(--color-gold)" />
        <line x1={x(BARCOLA_CLOSED)} x2={x(BARCOLA_CLOSED)} y1="14" y2="70" stroke="var(--color-text-primary)" strokeWidth="1.5" />
        <text className={s.svgStrong} x={x(BARCOLA_CLOSED)} y="11" textAnchor="end">Closed</text>
        {[0, 24, 48, 72].map((t) => <text key={t} className={s.svgAxis} x={x(t)} y="92" textAnchor={t === 0 ? 'start' : 'middle'}>{t}h</text>)}
      </svg>
      <div className={s.key}>
        <span><i style={{ background: 'var(--color-accent)' }} />{BARCOLA_BID_HOURS.length} Bids</span>
        <span><i style={{ background: 'var(--color-gold)' }} />Last Bid + 2h</span>
      </div>
    </div>
  );
}

function Overnight() {
  const pct = (h: number) => `${(h / 24) * 100}%`;
  return (
    <div>
      <div className={s.dayBar}>
        <i style={{ left: 0, width: pct(12) }} />
        <i style={{ left: pct(23), width: pct(1) }} />
        <b style={{ left: pct(12) }} />
      </div>
      <div className={s.dayLabels}>
        <span style={{ left: 0 }}>00:00</span>
        <span style={{ left: pct(12), transform: 'translateX(-50%)' }}><strong>Midday</strong></span>
        <span style={{ left: pct(23), transform: 'translateX(-100%)' }}>23:00</span>
      </div>
      <div className={s.key}>
        <span><i style={{ background: 'var(--color-green-300)' }} />Can Close</span>
        <span><i style={{ background: 'var(--color-text-secondary)' }} />Nothing Closes</span>
      </div>
    </div>
  );
}

/** A pinned lot, for when the board has none live. */
function SampleLot({ on }: { on: 'standing' | 'bid' | 'closes' }) {
  return (
    <div className={s.lot}>
      <Portrait size="sm" {...PINNED.barcola} />
      <div className={s.lotId}>
        <span className={s.lotName}><PositionBadge position="LW" size="sm" /> B. Barcola</span>
        <span className={s.lotTag}>Free Agent</span>
      </div>
      <div className={s.lotCell} data-on={on === 'standing' || undefined}>
        <span className={s.lotKey}>Standing Bid</span>
        <span className={s.lotMoney}>€71m</span>
      </div>
      <div className={s.lotCell} data-on={on === 'closes' || undefined}>
        <span className={s.lotKey}>Closes</span>
        <span className={s.lotClock}>2d 03:14</span>
      </div>
      <span className={s.lotBid} data-on={on === 'bid' || undefined}>Bid</span>
    </div>
  );
}

const RODRI_VALUE = 60;

function ReleaseRetain() {
  return (
    <div className={s.choice}>
      <div className={s.choiceWho}>
        <Portrait size="sm" {...PINNED.rodri} />
        <span>Rodri, valued <b>€{RODRI_VALUE}m</b>, leaves Manchester City</span>
      </div>
      <div className={s.choiceGrid}>
        <div className={s.option}>
          <span className={s.optionName}>Release</span>
          <span className={s.optionFig}>+€{Math.round((RODRI_VALUE * FIGURES.compensationPct) / 100)}m</span>
          <span className={s.optionText}>{FIGURES.compensationPct}% of his value now. If he ever returns, you can’t bid on him.</span>
        </div>
        <div className={s.option}>
          <span className={s.optionName}>Retain</span>
          <span className={s.optionFig}>€0</span>
          <span className={s.optionText}>He’s yours again the moment he returns, with no auction. Uses a retained slot.</span>
        </div>
      </div>
    </div>
  );
}

function FeeSplit() {
  const shared = SOLIDARITY_PCT - SCOUT_PCT;
  const gone = 100 - SOLIDARITY_PCT;
  return (
    <div>
      <div className={s.splitBar} aria-hidden="true">
        <i style={{ flex: gone }} />
        <b style={{ flex: SCOUT_PCT }} />
        <b style={{ flex: shared }} data-alt />
      </div>
      <div className={s.splitKey}>
        <span><strong>{gone}%</strong> Leaves the Game</span>
        <span><strong>{SCOUT_PCT}%</strong> Scout</span>
        <span><strong>{shared}%</strong> Other Clubs</span>
      </div>
    </div>
  );
}

function PlayerCardSample() {
  return (
    <div className={s.cardSample}>
      <Portrait size="md" {...PINNED.odegaard} />
      <div>
        <div className={s.cardName}>{PINNED.odegaard.name}</div>
        <div className={s.cardPositions}>
          <PositionBadge position="CM" size="md" />
          <PositionBadge position="AM" size="md" />
        </div>
      </div>
    </div>
  );
}

/** The front page's pinned example: matchweek 4, Gabriel's clean sheet against Haaland's goal. */
function Ratings() {
  const rows = [
    { p: PINNED.gabriel, label: 'Gabriel', pos: 'CB' as const, note: 'Clean sheet', rating: 8.43, pts: 28.1 },
    { p: PINNED.haaland, label: 'Haaland', pos: 'ST' as const, note: 'Scored', rating: 8.19, pts: 24.6 },
  ];
  return (
    <div className={s.ratings}>
      {rows.map((r, i) => (
        <div className={s.rating} key={r.p.name}>
          <Portrait size="sm" {...r.p} />
          <div className={s.ratingWho}>
            <span className={s.ratingName}>{r.label}</span>
            <span className={s.ratingNote}><PositionBadge position={r.pos} size="sm" /> {r.note}</span>
          </div>
          <span className={s.ratingTrack}><i style={{ width: `${(r.rating / 10) * 100}%` }} data-top={i === 0 || undefined} /></span>
          <span className={s.ratingFig}>{r.rating.toFixed(2)}<small>{r.pts} pts</small></span>
        </div>
      ))}
    </div>
  );
}

function MatchRevenue() {
  const results: [string, number][] = [['Win', MERIT.win], ['Draw', MERIT.draw], ['Loss', MERIT.loss]];
  return (
    <div className={s.revenue}>
      {results.map(([label, amount]) => (
        <div className={s.revenueCell} key={label}>
          <span className={s.optionName}>{label}</span>
          <span className={s.optionFig}>€{amount}m</span>
        </div>
      ))}
    </div>
  );
}

function TransferFlow() {
  return (
    <div className={s.flow}>
      <div className={s.flowStop}>
        <Portrait size="sm" {...PINNED.barcola} />
        <span className={s.flowText}><b>Barcola</b>PSG to Liverpool</span>
      </div>
      <span className={s.flowArrow} aria-hidden="true">→</span>
      <div className={s.flowStop}>
        <span className={s.flowText}><b>Auction</b>Every league</span>
      </div>
      <span className={s.flowArrow} aria-hidden="true">→</span>
      <div className={s.flowStop}>
        <span className={s.flowText}><b>€164m</b>26 bids</span>
      </div>
    </div>
  );
}

/** A matchup inside the draw band: the margin sits inside the shaded ±10. */
function Matchup() {
  const home = 152.6;
  const away = 145.3;
  const margin = home - away;
  const span = DRAW_THRESHOLD * 3;
  const at = (v: number) => `${50 + (v / span) * 50}%`;
  return (
    <div className={s.matchup}>
      <div className={s.matchupScores}>
        <span className={s.matchupSide}><span className={s.matchupClub}>Your Club</span><b>{home.toFixed(1)}</b></span>
        <span className={s.matchupResult}>Draw</span>
        <span className={s.matchupSide} data-away><b>{away.toFixed(1)}</b><span className={s.matchupClub}>Rival</span></span>
      </div>
      <div className={s.band}>
        <i style={{ left: at(-DRAW_THRESHOLD), width: `${(DRAW_THRESHOLD / span) * 100}%` }} />
        <b style={{ left: at(margin) }} />
      </div>
      <div className={s.bandLabels}><span>Their win</span><span>Draw within {DRAW_THRESHOLD}</span><span>Your win</span></div>
    </div>
  );
}

const TROPHY_KINDS = [
  { kind: 'league_title' as const, name: 'League Title' },
  { kind: 'champions_cup' as const, name: 'Champions Cup' },
  { kind: 'league_cup' as const, name: 'League Cup' },
  { kind: 'consolation_cup' as const, name: 'Consolation Cup' },
];

function Trophies() {
  return (
    <div className={s.trophies}>
      {TROPHY_KINDS.map((t) => (
        <div className={s.trophyCell} key={t.kind}>
          <Trophy kind={t.kind} size="pip" height={44} />
          <span>{t.name}</span>
        </div>
      ))}
    </div>
  );
}

export function DiagramView({ diagram }: { diagram: Diagram }) {
  switch (diagram) {
    case 'lengths': return <Lengths />;
    case 'countdown': return <Countdown />;
    case 'close': return <Close />;
    case 'overnight': return <Overnight />;
    case 'lot-standing': return <SampleLot on="standing" />;
    case 'lot-bid': return <SampleLot on="bid" />;
    case 'lot-closes': return <SampleLot on="closes" />;
    case 'release-retain': return <ReleaseRetain />;
    case 'fee-split': return <FeeSplit />;
    case 'player-card': return <PlayerCardSample />;
    case 'ratings': return <Ratings />;
    case 'match-revenue': return <MatchRevenue />;
    case 'transfer-flow': return <TransferFlow />;
    case 'matchup': return <Matchup />;
    case 'trophies': return <Trophies />;
  }
}
