'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import { Icon } from '@/components/ui/Icon';
import { useIsClient } from '@/lib/fixtures/formatKickoff';
import type { FixtureRow } from '@/lib/dashboard/buildDashboardModel';
import LocalTime from './LocalTime';
import styles from './dashboard.module.css';

/* eslint-disable @next/next/no-img-element */

export type SeasonWeeks = Record<number, FixtureRow[]>;

interface DayGroup {
  key: string;
  label: string | null;
  rows: FixtureRow[];
}

const SWIPE_MIN = 48;

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

/**
 * Rows arrive sorted by kickoff. Before hydration the reader's timezone is
 * unknown, so the day headings wait for the client rather than baking in UTC.
 */
function groupByDay(rows: FixtureRow[], isClient: boolean): DayGroup[] {
  if (!isClient) return [{ key: 'all', label: null, rows }];
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const key = row.kickoff ? localDayKey(row.kickoff) : 'tbc';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(row);
    } else {
      groups.push({ key, label: row.kickoff ? dayLabel(row.kickoff) : 'Date To Be Confirmed', rows: [row] });
    }
  }
  return groups;
}

function byKickoff(a: FixtureRow, b: FixtureRow): number {
  if (!a.kickoff && !b.kickoff) return 0;
  if (!a.kickoff) return 1;
  if (!b.kickoff) return -1;
  return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
}

function FixtureLine({ f }: { f: FixtureRow }) {
  const scored = f.state !== 'upcoming' && f.homeScore !== null && f.awayScore !== null;
  const homeLost = f.state === 'finished' && scored && f.homeScore! < f.awayScore!;
  const awayLost = f.state === 'finished' && scored && f.awayScore! < f.homeScore!;

  return (
    <div className={styles.fxRow}>
      <span className={styles.fxHome}>
        <span className={`${styles.fxName} ${homeLost ? styles.fxNameLost : ''}`}>{f.homeName}</span>
        {f.homeBadge ? <img src={f.homeBadge} alt="" className={styles.fxBadge} /> : <span className={styles.fxBadge} />}
      </span>
      <span className={styles.fxMid}>
        {scored ? (
          <>
            <span className={styles.fxScore}>
              {f.homeScore}&ndash;{f.awayScore}
            </span>
            {f.state === 'live' ? (
              <span className={styles.fxMin}>{f.minutes}&prime;</span>
            ) : (
              <span className={styles.fxState}>FT</span>
            )}
          </>
        ) : f.kickoff ? (
          <LocalTime iso={f.kickoff} variant="clock" className={styles.fxTime} />
        ) : (
          <span className={styles.fxTime}>TBC</span>
        )}
      </span>
      <span className={styles.fxAway}>
        {f.awayBadge ? <img src={f.awayBadge} alt="" className={styles.fxBadge} /> : <span className={styles.fxBadge} />}
        <span className={`${styles.fxName} ${awayLost ? styles.fxNameLost : ''}`}>{f.awayName}</span>
      </span>
    </div>
  );
}

export function Matchweek({
  currentWeek,
  weeks,
  nextDeadline,
  fixturesHref,
}: {
  currentWeek: number;
  weeks: SeasonWeeks;
  nextDeadline: string | null;
  fixturesHref: string | null;
}) {
  const isClient = useIsClient();
  const numbers = useMemo(() => Object.keys(weeks).map(Number).sort((a, b) => a - b), [weeks]);
  const first = numbers[0];
  const last = numbers[numbers.length - 1];

  const [week, setWeek] = useState(currentWeek);
  const [dir, setDir] = useState<1 | -1 | 0>(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const settled = useRef(false);

  const rows = useMemo(() => [...(weeks[week] ?? [])].sort(byKickoff), [weeks, week]);
  const groups = useMemo(() => groupByDay(rows, isClient), [rows, isClient]);

  const finished = rows.filter((r) => r.state === 'finished').length;
  const live = rows.filter((r) => r.state === 'live').length;
  const toCome = rows.length - finished - live;
  const dated = rows.map((r) => r.kickoff).filter((k): k is string => !!k);
  const firstKickoff = dated[0] ?? null;
  const lastKickoff = dated[dated.length - 1] ?? null;
  const kickedOff = finished + live > 0;

  const segments = [
    ...Array.from({ length: finished }, () => styles.segDone),
    ...Array.from({ length: live }, () => styles.segLive),
    ...Array.from({ length: toCome }, () => styles.seg1),
  ];

  const done = useMemo(() => {
    const set = new Set<number>();
    for (const n of numbers) {
      const r = weeks[n];
      if (r.length > 0 && r.every((x) => x.state === 'finished')) set.add(n);
    }
    return set;
  }, [numbers, weeks]);

  function go(next: number) {
    if (next < first || next > last || next === week) return;
    setDir(next > week ? 1 : -1);
    setWeek(next);
  }

  // Keep the chosen chip centred in the strip. The strip scrolls itself, so
  // the page never jumps; the first placement is instant, later ones glide.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !chip) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({
      left: chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2,
      behavior: settled.current && !reduce ? 'smooth' : 'auto',
    });
    settled.current = true;
  }, [week]);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) go(week + (dx < 0 ? 1 : -1));
  }

  if (numbers.length === 0) return null;

  const isCurrent = week === currentWeek;
  const solo = groups.length === 1;
  const allFixtures = fixturesHref && (
    <NavigationLink href={fixturesHref} className={`${styles.lockLink} ${styles.topLinkHead}`}>
      All Fixtures &rarr;
    </NavigationLink>
  );

  return (
    <section aria-labelledby="matchweek" className={styles.fxWrap}>
      <div className={`${styles.lock} ${styles.fxLock}`}>
        <span className={styles.mwTile} aria-hidden="true">
          <span className={styles.mwTileK}>MW</span>
          <span className={styles.mwTileV}>{week}</span>
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 id="matchweek" className={styles.lockTSm}>Premier League</h2>
          <div className={styles.lockSub}>
            {firstKickoff === null ? (
              'Dates to be confirmed'
            ) : isCurrent && !kickedOff && nextDeadline ? (
              <LocalTime iso={nextDeadline} variant="dayTime" prefix="Deadline " />
            ) : (
              <LocalTime iso={firstKickoff} endIso={lastKickoff} variant="range" />
            )}
          </div>
        </div>

        <div className={styles.fxStep}>
          <button
            type="button"
            className={styles.fxStepBtn}
            onClick={() => go(week - 1)}
            disabled={week <= first}
            aria-label={`Matchweek ${week - 1}`}
          >
            <Icon name="chevron-left" size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.fxStepBtn}
            onClick={() => go(week + 1)}
            disabled={week >= last}
            aria-label={`Matchweek ${week + 1}`}
          >
            <Icon name="chevron-right" size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ '--n': segments.length } as CSSProperties} aria-hidden="true">
            {segments.map((cls, i) => (
              <span key={i} className={cls} />
            ))}
          </div>
          <div className={styles.progressKey}>
            <span>{finished} Finished</span>
            <span className={styles.keyLive}>{live} Live</span>
            <span className={styles.keyCome}>{toCome} To Come</span>
          </div>
        </div>
        {allFixtures}
      </div>

      <div className={styles.weekNav}>
        <div ref={stripRef} className={styles.weekStrip} role="group" aria-label="Matchweeks">
          {numbers.map((n) => {
            const cls = [
              styles.weekChip,
              done.has(n) ? styles.weekChipDone : '',
              n === currentWeek ? styles.weekChipNow : '',
            ].join(' ');
            return (
              <button
                key={n}
                type="button"
                className={cls}
                onClick={() => go(n)}
                aria-current={n === week ? 'page' : undefined}
                aria-label={n === currentWeek ? `Matchweek ${n}, current` : `Matchweek ${n}`}
              >
                {n}
              </button>
            );
          })}
        </div>
        {!isCurrent && (
          <button type="button" className={styles.weekBack} onClick={() => go(currentWeek)}>
            Back to MW {currentWeek}
          </button>
        )}
      </div>

      <div
        key={week}
        className={`${styles.fixtures} ${dir === 1 ? styles.fxFromRight : dir === -1 ? styles.fxFromLeft : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {groups.map((g) => (
          <div key={g.key} className={solo ? styles.fxDaySolo : styles.fxDay}>
            {g.label && <h3 className={styles.fxDayH}>{g.label}</h3>}
            {g.rows.map((f) => (
              <FixtureLine key={f.id} f={f} />
            ))}
          </div>
        ))}
        {rows.length === 0 && <p className={styles.fxEmpty}>No fixtures scheduled for this matchweek.</p>}
      </div>

      {fixturesHref && (
        <NavigationLink href={fixturesHref} className={`${styles.lockLink} ${styles.topLinkFoot}`}>
          All Fixtures &rarr;
        </NavigationLink>
      )}
    </section>
  );
}
