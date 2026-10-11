'use client';

import { useId } from 'react';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import type { SlotView } from '@/lib/matchups/matchupView';
import { s } from './parts';

export interface WormSlot { t: string; cumA: number; cumB: number; started: boolean }

/** A tie's running totals laid onto a wider clock (every kickoff in the round). */
export function onClock(slots: SlotView[], clock: string[]): WormSlot[] {
  const by = new Map(slots.map((x) => [x.t, x]));
  let a = 0, b = 0;
  return clock.map((t) => {
    const x = by.get(t);
    if (x) { a = x.cumA; b = x.cumB; }
    return { t, cumA: a, cumB: b, started: x ? x.started : Date.parse(t) <= Date.now() };
  });
}

/** The slot where the lead last changed hands, or -1. */
export function turnIndex(rs: WormSlot[], last: number): number {
  let turn = -1;
  for (let i = 1; i <= last; i++) {
    const p = rs[i - 1].cumA - rs[i - 1].cumB, c = rs[i].cumA - rs[i].cumB;
    if (p && Math.sign(p) !== Math.sign(c)) turn = i;
  }
  return turn;
}

/**
 * The margin worm. Home's lead above the line, away's below; the ±10 band is
 * where a result would be a draw. Each side's area takes its own club colour.
 */
export default function Worm({
  rs, W, H, scale, live, colorA, colorB, labels = false, turnTag = false, pad = 0,
}: {
  rs: WormSlot[]; W: number; H: number; scale: number; live: boolean;
  colorA: string; colorB: string; labels?: boolean; turnTag?: boolean; pad?: number;
}) {
  const id = useId().replace(/:/g, '');
  const n = Math.max(1, rs.length), step = W / n;
  const x = (i: number) => (i + 0.5) * step;
  const mid = H / 2, half = H / 2 - pad;
  const y = (v: number) => mid - Math.max(-1, Math.min(1, v / scale)) * half;
  const last = live ? rs.map((r) => r.started).lastIndexOf(true) : rs.length - 1;
  let d = `M 0 ${y(0)}`;
  for (let i = 0; i <= last; i++) d += ` H ${x(i)} V ${y(rs[i].cumA - rs[i].cumB)}`;
  const endX = !live ? W : last >= 0 ? x(last) + step / 2 : 0;
  d += ` H ${endX}`;
  const area = `${d} V ${y(0)} H 0 Z`;
  const turn = turnIndex(rs, last);
  const lastV = last >= 0 ? rs[last].cumA - rs[last].cumB : 0;
  const ink = 'var(--color-text-primary)';
  const op = 'var(--worm-op, .34)';
  return (
    <svg className={s.wm} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Margin through the weekend">
      <defs>
        <clipPath id={`${id}a`}><rect x="0" y="0" width={W} height={y(0)} /></clipPath>
        <clipPath id={`${id}b`}><rect x="0" y={y(0)} width={W} height={H - y(0)} /></clipPath>
      </defs>
      {rs.map((_, i) => <line key={i} x1={x(i)} x2={x(i)} y1={pad} y2={H - pad} stroke="var(--color-border-subtle)" strokeWidth="1" />)}
      {turn >= 0 && turnTag && <rect x={turn * step} y="0" width={step} height={H} fill="color-mix(in oklab, var(--color-text-primary) 5%, transparent)" />}
      <rect x="0" y={y(DRAW_THRESHOLD)} width={W} height={y(-DRAW_THRESHOLD) - y(DRAW_THRESHOLD)} fill="color-mix(in srgb, var(--color-text-muted) 12%, transparent)" />
      <line x1="0" x2={W} y1={y(DRAW_THRESHOLD)} y2={y(DRAW_THRESHOLD)} stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="0" x2={W} y1={y(-DRAW_THRESHOLD)} y2={y(-DRAW_THRESHOLD)} stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="3 3" />
      <path d={area} fill={colorA} style={{ fillOpacity: op }} clipPath={`url(#${id}a)`} />
      <path d={area} fill={colorB} style={{ fillOpacity: op }} clipPath={`url(#${id}b)`} />
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke={ink} strokeOpacity=".35" strokeWidth="1" />
      <path d={d} fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      {last >= 0 && <circle cx={endX} cy={y(lastV)} r="3.5" fill={ink} />}
      {live && <line x1={endX} x2={endX} y1="0" y2={H} stroke="var(--color-live)" strokeWidth="1.5" strokeDasharray="4 3" />}
      {labels && <text x={W - 6} y={y(DRAW_THRESHOLD) - 5} textAnchor="end" className={s.wmT}>Draw band ±{DRAW_THRESHOLD}</text>}
    </svg>
  );
}

/** Starters each side has in each kickoff, for a weekend that has not started. */
export function WeekendDots({ countsA, countsB, W, H, colorA, colorB }: {
  countsA: number[]; countsB: number[]; W: number; H: number; colorA: string; colorB: string;
}) {
  const n = Math.max(1, countsA.length), step = W / n;
  return (
    <svg className={s.wm} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Starters in each kickoff">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--color-border-strong)" strokeWidth="1" />
      {countsA.map((a, i) => {
        const cx = (i + 0.5) * step;
        // Dots stack away from the line; a crowded kickoff packs them tighter
        // rather than running into the next fixture.
        const col = (v: number, up: boolean, c: string) => {
          const gap = Math.min(9, (H / 2 - 12) / Math.max(1, v - 1));
          return Array.from({ length: v }, (_, j) => (
            <circle key={`${up}${j}`} cx={cx} cy={H / 2 + (up ? -1 : 1) * (8 + j * gap)} r="3.5" fill={c} />
          ));
        };
        return <g key={i}>{col(a, true, colorA)}{col(countsB[i] ?? 0, false, colorB)}</g>;
      })}
    </svg>
  );
}
