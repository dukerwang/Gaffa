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
import type { TimingDiagram } from '@/lib/walkthroughs/chapters';
import s from './TimingDiagrams.module.css';

const HOUR = 3_600_000;
const BARCOLA_PHOTO = 'https://resources.premierleague.com/premierleague25/photos/players/110x140/482616.png';
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
        <Portrait size="sm" photoUrl={BARCOLA_PHOTO} name="Bradley Barcola" club="Liverpool" />
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

export function TimingDiagramView({ diagram }: { diagram: TimingDiagram }) {
  if (diagram === 'lengths') return <Lengths />;
  if (diagram === 'countdown') return <Countdown />;
  if (diagram === 'close') return <Close />;
  return <Overnight />;
}
