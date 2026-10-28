'use client';

import { useMemo, useRef, useState } from 'react';
import Portrait from '@/components/players/Portrait';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import type { Ledger, LedgerEntry } from '@/lib/finance/ledger';
import { money, shortDate, signed } from './format';
import styles from './finance.module.css';

const W = 640;
const H = 220;
const DAY = 86_400_000;

/** How many of the largest signings carry a portrait on the line. */
const PORTRAITS = 3;

/**
 * Club Balance over the season as a step line: the balance is flat between
 * movements and jumps at each one. One series, so no legend; the ledger
 * below is the table view of the same points.
 */
export default function BalanceChart({ ledger, now, balance }: { ledger: Ledger; now: string; balance: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geo = useMemo(() => {
    const { entries, opening } = ledger;
    const end = new Date(now).getTime();
    const first = entries.length ? new Date(entries[0].at).getTime() : end - 30 * DAY;
    const start = first - 2 * DAY;
    const span = Math.max(DAY, end - start);
    const top = Math.max(opening, balance, ...entries.map((e) => e.balanceAfter)) * 1.12 || 10;
    const x = (t: number) => ((t - start) / span) * W;
    const y = (v: number) => H - (Math.max(0, v) / top) * H;

    const points = entries.map((e) => ({ e, px: x(new Date(e.at).getTime()), py: y(e.balanceAfter) }));
    const prev = entries.length ? entries[entries.length - 1].balanceAfter : opening;
    const d = `M0 ${y(opening)}${points.map((p) => ` H${p.px} V${p.py}`).join('')} H${W}`;
    const area = `${d} V${H} H0 Z`;

    const ticks: { label: string; px: number }[] = [];
    const m = new Date(start);
    m.setUTCDate(1);
    m.setUTCHours(0, 0, 0, 0);
    m.setUTCMonth(m.getUTCMonth() + 1);
    while (m.getTime() < end) {
      ticks.push({ label: m.toLocaleDateString('en-GB', { month: 'short' }), px: x(m.getTime()) });
      m.setUTCMonth(m.getUTCMonth() + 1);
    }

    const step = top / 1.12 > 150 ? 100 : top / 1.12 > 60 ? 50 : 20;
    const grid: number[] = [];
    for (let v = step; v < top; v += step) grid.push(v);

    // Largest signings first, skipping any that would land on a portrait
    // already placed: a busy week of auctions otherwise stacks them.
    const faces: typeof points = [];
    for (const p of points
      .filter((q) => q.e.direction === 'out' && q.e.player && q.e.category === 'Signings')
      .sort((a, b) => b.e.amount - a.e.amount)) {
      if (faces.length === PORTRAITS) break;
      if (faces.every((f) => Math.abs(f.px - p.px) > W * 0.12)) faces.push(p);
    }

    return { points, d, area, ticks, grid, y, faces, endY: y(prev) };
  }, [ledger, now, balance]);

  function onMove(ev: React.PointerEvent<HTMLDivElement>) {
    const el = wrap.current;
    if (!el || geo.points.length === 0) return;
    const r = el.getBoundingClientRect();
    const vx = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < geo.points.length; i++) {
      if (Math.abs(geo.points[i].px - vx) < Math.abs(geo.points[best].px - vx)) best = i;
    }
    setHover(best);
  }

  const h = hover != null ? geo.points[hover] : null;
  const pct = (px: number) => `${(px / W) * 100}%`;
  const pctY = (py: number) => `${(py / H) * 100}%`;

  return (
    <figure className={styles.chart}>
      <div
        ref={wrap}
        className={styles.plot}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Club Balance from ${money(ledger.opening)} to ${money(balance)} across ${ledger.entries.length} movements`}
      >
        {geo.grid.map((v) => (
          <span key={v} className={styles.gridLine} style={{ top: pctY(geo.y(v)) }}>
            <span className={styles.gridLabel}>{money(v)}</span>
          </span>
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svg} aria-hidden="true">
          <path d={geo.area} className={styles.area} />
          <path d={geo.d} className={styles.line} vectorEffect="non-scaling-stroke" />
          {h && <line x1={h.px} x2={h.px} y1={0} y2={H} className={styles.cross} vectorEffect="non-scaling-stroke" />}
        </svg>
        {geo.points.map((p, i) => (
          <span
            key={p.e.id}
            className={`${styles.dot} ${p.e.direction === 'in' ? styles.dotIn : styles.dotOut} ${hover === i ? styles.dotOn : ''}`}
            style={{ left: pct(p.px), top: pctY(p.py) }}
          />
        ))}
        {geo.faces.map((p) => (
          <span key={`f-${p.e.id}`} className={styles.pin} style={{ left: pct(p.px), top: pctY(p.py) }}>
            <Portrait
              photoUrl={p.e.player!.photo_url}
              photoVersion={p.e.player!.photo_version}
              name={p.e.player!.name}
              size="xxs"
              headTopPct={p.e.player!.portrait_head_top_pct}
              headWidthPct={p.e.player!.portrait_head_width_pct}
            />
          </span>
        ))}
        <span className={styles.nowTag} style={{ top: pctY(geo.endY) }}>{money(balance)}</span>
        {h && <Tip entry={h.e} left={h.px / W} />}
      </div>
      <div className={styles.axis} aria-hidden="true">
        {geo.ticks.map((t) => (
          <span key={t.label + t.px} style={{ left: pct(t.px) }}>{t.label}</span>
        ))}
      </div>
    </figure>
  );
}

function Tip({ entry, left }: { entry: LedgerEntry; left: number }) {
  const who = entry.player ? getPlayerDisplayName(entry.player, 'initial_last') : entry.detail;
  return (
    <div
      className={styles.tip}
      style={{ left: `${left * 100}%`, transform: `translateX(${left > 0.7 ? '-100%' : left < 0.3 ? '0' : '-50%'})` }}
    >
      <span className={styles.tipDate}>{shortDate(entry.at)}</span>
      <span className={styles.tipLabel}>{entry.label}{who ? ` · ${who}` : ''}</span>
      <span className={styles.tipRow}>
        <b className={entry.direction === 'in' ? styles.in : styles.out}>{signed(entry.direction === 'in' ? entry.amount : -entry.amount)}</b>
        <span>Balance {money(entry.balanceAfter)}</span>
      </span>
    </div>
  );
}
