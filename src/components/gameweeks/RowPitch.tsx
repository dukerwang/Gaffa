'use client';

/**
 * The half-pitch as rows that cannot collide: each line of the formation is
 * one row, each player owns a column of a five-column grid, and every card on
 * the pitch is the width a back five leaves each player. Height comes from the
 * rows, never from a fixed box, so a six-line formation grows the pitch
 * instead of squeezing it. Ported from scratch/matchups-proto/pitchrows.mjs.
 */
import { useEffect, useMemo, useState } from 'react';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import type { MatchState, PitchPlayer } from '@/lib/matchups/matchupView';
import { FitBox, Glyph, Local, Pts, kickoffShort, s, useWidth } from './parts';

const ZONE: Record<string, string> = { LW: 'ATT', ST: 'ATT', RW: 'ATT', AM: 'AMZ', DM: 'DMZ', CM: 'CMZ', LWB: 'WBZ', RWB: 'WBZ', CB: 'DEF', LB: 'DEF', RB: 'DEF', GK: 'GK' };
const ROWS = ['ATT', 'AMZ', 'CMZ', 'DMZ', 'WBZ', 'DEF', 'GK'];
const WIDE = new Set(['LB', 'RB', 'LWB', 'RWB', 'LW', 'RW']);
const LAT: Record<string, number> = { LB: 0, LWB: 0, LW: 0, RB: 2, RWB: 2, RW: 2 };

export const rowCount = (starters: PitchPlayer[]) => new Set(starters.map((p) => ZONE[p.slot] ?? 'CMZ')).size;

/** Columns of a five-wide grid for a row of n players; null is four equal columns. */
function columns(slots: string[]): number[] | null {
  const n = slots.length, wide = slots.some((x) => WIDE.has(x));
  if (n === 1) return [3];
  if (n === 2) return wide ? [1, 5] : [2, 4];
  if (n === 3) return wide ? [1, 3, 5] : [2, 3, 4];
  if (n === 4) return null;
  return [1, 2, 3, 4, 5];
}

// ── Names: measured in the real serif, never estimated once fonts are in ──
const V = /[aeiouyáéíóúàèëïöüćčšžğı]/i;
function syllableBreak(t: string): number {
  let best = Math.ceil(t.length / 2), bestD = 99;
  for (let i = 2; i < t.length - 2; i++) {
    if (V.test(t[i - 1]) && !V.test(t[i]) && V.test(t[i + 1])) {
      const d = Math.abs(i - t.length / 2);
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best;
}
const segsOf = (name: string) => [...new Set(splits(name).flatMap(([a, b]) => [a, b]).concat(name.length > 6 ? [`${name.slice(0, syllableBreak(name))}-`, name.slice(syllableBreak(name))] : []))];

/** Width of each string at 1px of the pitch name face, measured once per set. */
function useNameWidths(names: string[]): Record<string, number> | null {
  const key = names.join('\u0002');
  const [w, setW] = useState<{ key: string; map: Record<string, number> } | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => {
      if (!alive) return;
      const box = document.createElement('div');
      box.setAttribute('aria-hidden', 'true');
      box.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;';
      const all = new Set<string>();
      for (const n of names) { all.add(n); segsOf(n).forEach((x) => all.add(x)); }
      const spans = [...all].map((t) => {
        const sp = document.createElement('span');
        sp.className = s.pnN;
        sp.style.cssText = 'display:inline-block;width:auto;font-size:10px;';
        sp.textContent = t;
        box.appendChild(sp);
        return [t, sp] as const;
      });
      document.body.appendChild(box);
      const map: Record<string, number> = {};
      for (const [t, sp] of spans) map[t] = sp.getBoundingClientRect().width / 10;
      box.remove();
      setW({ key, map });
    };
    if (document.fonts?.ready) document.fonts.ready.then(run); else run();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return w?.key === key ? w.map : null;
}

interface NameFit { lines: string[]; size: number; hyphen: boolean }
/** Every place a name may break in two: after a space or a hyphen. */
function splits(name: string): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 1; i < name.length; i++) {
    if (name[i - 1] === ' ') out.push([name.slice(0, i - 1), name.slice(i)]);
    else if (name[i - 1] === '-') out.push([name.slice(0, i), name.slice(i)]);
  }
  return out;
}
function fitName(name: string, chipW: number, base: number, pad: number, widthOf: (t: string) => number): NameFit {
  const avail = chipW - pad;
  const full = widthOf(name);
  if (full * base <= avail) return { lines: [name], size: base, hyphen: false };
  if (full * 8 <= avail) return { lines: [name], size: avail / full, hyphen: false };
  // Two lines at the break that leaves the longer line shortest.
  const cands = splits(name);
  if (cands.length) {
    const best = cands.map(([a, b]) => ({ a, b, w: Math.max(widthOf(a), widthOf(b)) })).sort((x, y) => x.w - y.w)[0];
    const size = Math.min(base, avail / best.w);
    if (size >= 7.5 || !V.test(name)) return { lines: [best.a, best.b], size, hyphen: false };
  }
  // One long word in a tight row: break it once, at a syllable near its middle.
  const hy = syllableBreak(name);
  const a = `${name.slice(0, hy)}-`, b = name.slice(hy);
  return { lines: [a, b], size: Math.min(base, avail / (Math.max(widthOf(a), widthOf(b)) * 1.04)), hyphen: true };
}

function NameText({ fit }: { fit: NameFit }) {
  const style = { fontSize: `${fit.size.toFixed(2)}px` };
  if (fit.lines.length === 1) return <span className={s.pnN} style={style}>{fit.lines[0]}</span>;
  return <span className={`${s.pnN} ${s.pnN2}`} style={style}>{fit.lines[0]}<br />{fit.lines[1]}</span>;
}

/**
 * The detail line fits the card: the fixture with its day before kickoff,
 * otherwise goals and assists first, then the position's own stats, dropping
 * from the end whatever will not fit. Rating lives in the team sheets.
 */
function DetailLine({ p, cardW, compact }: { p: PitchPlayer; cardW: number; compact: boolean }) {
  if (p.status === 'pend' && p.fixture) {
    return <FitBox className={s.rcFx} min={7} dep={p.fixture.kickoffTime ?? ''}><b>{p.fixture.opponentShort}</b> <Local>{() => kickoffShort(p.fixture!.kickoffTime)}</Local></FitBox>;
  }
  if (p.status === 'dnp') return <>Did not play</>;
  const toks = p.stats.filter((t) => t && !/x[GA]|rating/.test(t));
  const ga = (t: string) => /^\d+[GA]$/.test(t);
  const ordered = [...toks.filter(ga), ...toks.filter((t) => !ga(t))];
  const maxChars = Math.floor((cardW - 10) / (compact ? 4.8 : 5.4));
  while (ordered.length && ordered.join(' · ').length > maxChars) ordered.pop();
  if (!ordered.length) return <>&nbsp;</>;
  return <>{ordered.map((t, i) => <span key={t}>{i ? ' · ' : ''}{ga(t) ? <b>{t}</b> : t}</span>)}</>;
}

export default function RowPitch({ starters, state, minRows = 0, onOpen }: {
  starters: PitchPlayer[]; state: MatchState; minRows?: number; onOpen: (p: PitchPlayer) => void;
}) {
  const [ref, fieldW] = useWidth<HTMLDivElement>(560);
  const compact = fieldW < 480;
  const names = useMemo(() => starters.map((p) => p.name), [starters]);
  const widths = useNameWidths(names);
  const widthOf = (t: string) => widths?.[t] ?? t.length * 0.55;

  const byRow: Record<string, PitchPlayer[]> = {};
  for (const p of starters) (byRow[ZONE[p.slot] ?? 'CMZ'] ??= []).push(p);
  for (const k in byRow) byRow[k].sort((a, b) => (LAT[a.slot] ?? 1) - (LAT[b.slot] ?? 1));
  const rows = ROWS.filter((z) => byRow[z]);

  const inner = fieldW - 28;
  const unit = inner / 5;
  const maxW = compact ? 80 : 112;
  // One card size for the whole pitch: the width a back five leaves each player.
  const cardW = Math.max(40, Math.floor(Math.min(maxW, unit - (compact ? 3 : 8))));
  const nameBase = compact ? 10.5 : 12.5;
  const porH = compact ? 46 : 60, badgeH = compact ? 14 : 15, nameH = compact ? 12 : 15, statH = compact ? 11 : 12;

  const built = rows.map((z) => {
    const ps = byRow[z];
    const cols = columns(ps.map((p) => p.slot));
    const central3 = cols?.length === 3 && !ps.some((p) => WIDE.has(p.slot));
    const xs = cols ? cols.map((c, i) => (central3 ? [1.5, 3, 4.5][i] : c) - 0.5) : ps.map((_, i) => ((i + 0.5) * 5) / 4);
    const chips = ps.map((p, i) => ({ p, cx: xs[i] * unit, fit: fitName(p.name, cardW, nameBase, compact ? 10 : 14, widthOf) }));
    const h = 10 + porH + 4 + 8 + badgeH + nameH * (chips.some((c) => c.fit.lines.length > 1) ? 2 : 1) + statH + 6;
    return { z, h, chips };
  });
  const rowH = Math.max(0, ...built.map((r) => r.h));
  const minH = built.reduce((t, r) => t + r.h, 0) + Math.max(0, minRows - rows.length) * rowH;

  return (
    <div ref={ref} className={`${s.rp}${compact ? ` ${s.rpM}` : ''}`}>
      <div className={s.rpField}>
        <span className={s.phTop} /><span className={s.phCircle} /><span className={s.phBox} /><span className={s.phGoal} />
        <div className={s.rpRows} style={{ minHeight: minH }}>
          {built.map((r) => (
            <div key={r.z} className={s.rpRow} style={{ height: r.h }}>
              {r.chips.map(({ p, cx, fit }) => (
                <span key={p.id} className={s.rpCell} style={{ left: `${(cx / inner) * 100}%` }}>
                  <button type="button" className={`${s.rcC}${p.status === 'pend' ? ` ${s.chPend}` : p.status === 'dnp' ? ` ${s.chDnp}` : ''}`}
                    style={{ width: cardW }} onClick={() => onOpen(p)} aria-label={`${p.name}, ${p.slot}`}>
                    <span className={s.rcP}>
                      {p.subIn && <span className={s.rcSub} title={p.replacedName ? `On for ${p.replacedName}` : 'Auto-subbed in'}><Glyph k="up" size={11} /></span>}
                      <Portrait photoUrl={p.photoUrl} name={p.name} club={p.club} size={compact ? 'xs' : 'cmp'} headTopPct={p.headTopPct} headWidthPct={p.headWidthPct} photoVersion={p.photoVersion} />
                      <Pts v={p.points} status={p.status} />
                    </span>
                    <span className={s.rcBox}>
                      <PositionBadge position={p.slot} size="sm" />
                      <NameText fit={fit} />
                      <span className={s.rcS}><DetailLine p={p} cardW={cardW} compact={compact} /></span>
                    </span>
                  </button>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
