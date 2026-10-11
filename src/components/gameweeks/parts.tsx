'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import { portraitInitials, portraitSources } from '@/lib/players/photo';
import { useIsClient } from '@/lib/fixtures/formatKickoff';
import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import { fmt, type ResultLetter } from '@/lib/matchups/roundView';
import s from './gw.module.css';

export { s };

// ── Glyphs (stroke, currentColor) ──
const G = {
  chev: <path d="M6 9l6 6 6-6" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  up: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  down: <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  star: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
} as const;
export function Glyph({ k, size = 14, className }: { k: keyof typeof G; size?: number; className?: string }) {
  return (
    <svg className={`${s.gl}${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {G[k]}
    </svg>
  );
}

export function Crest({ crest, name, size, teamId }: { crest: CrestConfig | null; name: string; size: number; teamId?: string | null }) {
  return (
    <span className={s.crestCell}>
      <CrestBadge config={crest} size={size} teamName={name} teamId={teamId} interactive={false} />
    </span>
  );
}

// ── Points badge: the pitch's shipped ramp ──
export const ptsBand = (v: number) =>
  v >= 29 ? s.ptsElite : v >= 15.8 ? s.ptsGood : v >= 5.6 ? s.ptsFair : v >= 2 ? s.ptsBelow : v > 0 ? s.ptsWeak : s.ptsBad;
export function Pts({ v, status = 'played' }: { v: number; status?: 'played' | 'dnp' | 'pend' }) {
  if (status === 'pend') return <span className={`${s.pts} ${s.ptsPend}`}>–</span>;
  if (status === 'dnp') return <span className={`${s.pts} ${s.ptsDnp}`}>DNP</span>;
  return <span className={`${s.pts} ${ptsBand(v)}`}>{fmt(v)}</span>;
}

// ── A round face on a ground mixed from the position colour ──
export function Face({ name, photoUrl, photoVersion, slot, size = 22, onDark = false }: {
  name: string; photoUrl: string | null; photoVersion?: string | null; slot: string; size?: number; onDark?: boolean;
}) {
  const src = portraitSources(photoUrl, photoVersion)[0];
  const [failed, setFailed] = useState(false);
  const style = { '--pos': `var(--color-pos-${slot.toLowerCase()}, var(--color-text-muted))`, width: size, height: size } as CSSProperties;
  const cls = `${s.fc}${onDark ? ` ${s.fcOnDark}` : ''}`;
  if (!src || failed) return <span className={`${cls} ${s.fcNone}`} style={style} title={name}>{portraitInitials(name)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <span className={cls} style={style} title={name}><img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></span>;
}

// ── Kickoff times, in the viewer's own zone (rendered after mount) ──
export function kickoffShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString(undefined, { weekday: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${day} ${time}`;
}
export function dayMonth(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`;
}
export function Local({ children }: { children: () => ReactNode }) {
  const client = useIsClient();
  return <>{client ? children() : ''}</>;
}
/** "Fri 18 – Sun 20 Sep" from the first and last kickoffs. */
export function weekendRange(first: string | null, last: string | null): string {
  if (!first || !last) return '';
  const a = new Date(first), b = new Date(last);
  const mon = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  const dd = (d: Date) => `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`;
  if (a.toDateString() === b.toDateString()) return `${dd(a)} ${mon(a)}`;
  return mon(a) === mon(b) ? `${dd(a)} – ${dd(b)} ${mon(b)}` : `${dd(a)} ${mon(a)} – ${dd(b)} ${mon(b)}`;
}
export function deadlineText(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`;
  return `Deadline ${date}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
}

/** Days, hours and minutes to a deadline, ticking once a minute. */
export function Countdown({ iso, short = false }: { iso: string; short?: boolean }) {
  const client = useIsClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!client) return null;
  const ms = Math.max(0, Date.parse(iso) - now);
  const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60;
  if (short) return <>{d ? `${d}d ${h}h` : `${h}h ${m}m`}</>;
  return <>{d ? `${d}d ` : ''}{h}h {m}m</>;
}

// ── The margin axis: draw band engraved, ink toward whoever leads ──
export function axisInk(a: number, b: number): CSSProperties {
  const reach = (Math.min(Math.abs(a - b), 50) / 50) * 50;
  if (!reach) return { display: 'none' };
  return a > b ? { right: '50%', width: `${reach}%` } : { left: '50%', width: `${reach}%` };
}
export function DarkAxis({ a, b }: { a: number; b: number }) {
  return <div className={s.hxAxis} aria-hidden="true"><span className={s.hxBand} /><span className={s.hxInk} style={axisInk(a, b)} /><span className={s.hxTick} /></div>;
}

export function Ticks({ played, of = 11 }: { played: number; of?: number }) {
  return (
    <span className={s.ticks} aria-label={`${played} of ${of} played`}>
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < played ? undefined : s.to} />)}
    </span>
  );
}
export function FormDots({ form, light = false }: { form: ResultLetter[]; light?: boolean }) {
  if (light) return <span className={s.frmL}>{form.map((r, i) => <i key={i} className={`${s.res} ${s[`res${r}`]}`}>{r}</i>)}</span>;
  return <span className={s.frm}>{form.map((r, i) => <i key={i} className={s[r]}>{r}</i>)}</span>;
}
export function Res({ r }: { r: ResultLetter }) {
  return <span className={`${s.res} ${s[`res${r}`]}`}>{r}</span>;
}

export function verdict(a: number, b: number, mine: 'A' | 'B' | null, done: boolean): ReactNode {
  const m = Math.abs(a - b);
  if (m <= DRAW_THRESHOLD) return <>{done ? 'Drawn' : 'Level'}, <b>{fmt(m)}</b> apart</>;
  const aLeads = a > b;
  if (mine) {
    const ours = (mine === 'A') === aLeads;
    return done ? <>{ours ? 'Won' : 'Lost'} by <b>{fmt(m)}</b></> : <>{ours ? 'Ahead' : 'Behind'} by <b>{fmt(m)}</b></>;
  }
  return done ? <b>{fmt(m)}</b> : <>Ahead by <b>{fmt(m)}</b></>;
}

/** Width of an element, tracked, so SVG charts draw at their real size. */
export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => { const v = Math.floor(el.clientWidth); if (v > 0) setW(v); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(q.matches);
    const on = () => setR(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return r;
}

/** Text that shrinks (to a floor) until it fits its box on one line. */
export function FitText({ text, className, min = 8 }: { text: string; className?: string; min?: number }) {
  return <FitBox className={className} min={min} dep={text}>{text}</FitBox>;
}

/** Any one-line content that shrinks (to a floor) until it fits its box. */
export function FitBox({ children, className, min = 8, dep }: { children: ReactNode; className?: string; min?: number; dep?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize);
      let f = base;
      while (f > min && el.scrollWidth > el.clientWidth + 0.5) { f -= 0.5; el.style.fontSize = `${f}px`; }
      setSize(f === base ? null : f);
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [dep, min]);
  return <span ref={ref} className={className} style={size ? { fontSize: size } : undefined}>{children}</span>;
}
