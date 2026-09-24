'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CardBack, CardGamelogEntry } from '@/lib/players/cardCache';
import {
  latestPlayedGameweek,
  matchweekSeries,
  seasonLabel,
  seasonSummary,
} from '@/lib/players/cardSeason';
import { resolveClub } from '@/lib/clubs/registry';
import { roleArticle } from '@/lib/scoring/perfBand';
import LocalKickoff from '@/components/fixtures/LocalKickoff';
import PerformanceBlock from './PerformanceBlock';
import { POS_CSS_VAR, pointsAtSlot } from './PremiumPlayerCard';
import styles from './PlayerCardStats.module.css';

/** The display-rating band, as a variable defined on `.stats`. */
function ratingVar(r: number | null): string {
  if (r == null) return 'var(--rating-none)';
  if (r >= 8.5) return 'var(--rating-elite)';
  if (r >= 7.5) return 'var(--rating-good)';
  if (r >= 6.5) return 'var(--rating-fair)';
  if (r >= 6.0) return 'var(--rating-below-avg)';
  if (r >= 5.5) return 'var(--rating-weak)';
  return 'var(--rating-bad)';
}

const CHART_HEIGHT = 112;

/** "LIV (A)" → the club and the venue. Null club when the feed gave us nothing usable. */
function parseOpponent(opponent: string | undefined) {
  const m = opponent?.match(/^(.+?)\s*\((H|A)\)$/);
  const short = m ? m[1] : opponent ?? '';
  const club = resolveClub(short);
  return {
    name: club?.name ?? (short && short !== 'Unknown' ? short : 'Unknown'),
    badge: club ? `/team-logos/${club.slug}.png` : null,
    venue: (m?.[2] ?? null) as 'H' | 'A' | null,
  };
}

/** The score from the player's side, "W 2–1", from the feed's home–away "W 2-1". */
function resultFor(result: string | undefined, venue: 'H' | 'A' | null) {
  const m = result?.match(/^([WDL])\s*(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  const [home, away] = [m[2], m[3]];
  const [f, a] = venue === 'A' ? [away, home] : [home, away];
  return { code: m[1] as 'W' | 'D' | 'L', text: `${m[1]} ${f}–${a}` };
}

interface Props {
  /** The season's payload; null while it loads. */
  back: CardBack | null;
  isCurrent: boolean;
  slot: string;
  primary: string;
  /** Open this gameweek's row on arrival (a matchup chip carries it). */
  focusGameweek?: number | null;
}

export default function PlayerCardStats({ back, isCurrent, slot, primary, focusGameweek }: Props) {
  const [metric, setMetric] = useState<'points' | 'rating'>('points');
  // One row open at a time: an accordion, not a set of toggles. `undefined`
  // until the reader touches a row, so the focused match (below) opens first.
  const [pickedRow, setOpenRow] = useState<string | null | undefined>(undefined);
  const tableRef = useRef<HTMLTableElement>(null);

  // Every figure in the view is read at the selected slot, so the chart, the
  // summary's rating and the log agree with the card beside them.
  const log = useMemo<CardGamelogEntry[]>(() => {
    const raw = back?.gamelog ?? [];
    if (slot === primary) return raw;
    return raw.map((g) => ({
      ...g,
      fantasy_points: pointsAtSlot(g, slot),
      match_rating: g.by_position?.[slot]?.match_rating ?? g.match_rating,
    }));
  }, [back, slot, primary]);

  const summary = useMemo(() => seasonSummary(log), [log]);
  const latest = latestPlayedGameweek(log);
  const upcoming = log.find((g) => g.isUpcoming) ?? null;
  const through = isCurrent ? Math.max(upcoming?.gameweek ?? 0, latest ?? 0) : 38;
  const series = useMemo(() => matchweekSeries(log, through), [log, through]);
  const dense = series.length > 10;
  const maxPoints = Math.max(1, ...series.map((p) => (p.upcoming ? p.projected ?? 0 : p.points)));

  // Land on the match the caller asked about. Derived, not set in an effect:
  // it holds until the reader opens or closes a row themselves.
  const focusKey = useMemo(() => {
    if (focusGameweek == null) return null;
    const index = log.findIndex((g) => !g.isUpcoming && Number(g.gameweek) === Number(focusGameweek));
    return index < 0 ? null : `${log[index].gameweek}-${index}`;
  }, [focusGameweek, log]);
  const openRow = pickedRow !== undefined ? pickedRow : focusKey;

  // Scroll to it once, when it first appears.
  const scrolledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusKey || scrolledRef.current === focusKey) return;
    scrolledRef.current = focusKey;
    requestAnimationFrame(() => {
      tableRef.current?.querySelector(`[data-row="${focusKey}"]`)?.scrollIntoView({ block: 'center' });
    });
  }, [focusKey]);

  if (!back) {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-label="Loading season">
        <i style={{ width: '30%' }} />
        <i className={styles.skelBig} />
        <i style={{ width: '40%' }} />
        <i className={styles.skelChart} />
        <i /><i /><i /><i />
      </div>
    );
  }

  const seasonName = back.season ? seasonLabel(back.season) : null;
  const slotVar = { '--slot': POS_CSS_VAR[slot] ?? 'var(--color-accent)' } as React.CSSProperties;

  return (
    <div className={styles.stats}>
      <section className={styles.section}>
        <div className={styles.head}>
          <h3 className={styles.title}>Season</h3>
          {isCurrent ? (
            latest != null && (
              <span className={`${styles.state} ${styles.stateLive}`}>MW {latest} of 38</span>
            )
          ) : (
            <span className={styles.state}>Final</span>
          )}
        </div>
        <div className={styles.summary}>
          <div className={styles.stat}><b>{summary.appearances}</b><span>Apps</span></div>
          <div className={styles.stat}><b>{summary.minutes.toLocaleString('en-GB')}</b><span>Minutes</span></div>
          <div className={styles.stat}><b>{summary.goals}</b><span>Goals</span></div>
          <div className={styles.stat}><b>{summary.assists}</b><span>Assists</span></div>
          <div className={styles.stat}>
            <b>{summary.averageRating != null ? summary.averageRating.toFixed(2) : '—'}</b>
            <span>Avg Rating</span>
          </div>
        </div>
      </section>

      {series.length > 0 && (
        <section className={styles.section}>
          <div className={styles.head}>
            <h3 className={styles.title}>By Matchweek</h3>
            <div className={styles.seg} role="group" aria-label="Chart measure">
              {(['points', 'rating'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={metric === m ? styles.segOn : ''}
                  aria-pressed={metric === m}
                  onClick={() => setMetric(m)}
                >
                  {m === 'points' ? 'Points' : 'Rating'}
                </button>
              ))}
            </div>
          </div>
          <div className={`${styles.chart} ${dense ? styles.dense : ''}`}>
            {series.map((p) => {
              let height = 2;
              let label = '';
              let title = `MW${p.gameweek}: did not play`;
              if (p.upcoming) {
                const proj = p.projected;
                height = metric === 'rating' || proj == null ? 0 : Math.max(6, (proj / maxPoints) * CHART_HEIGHT);
                label = metric === 'rating' || proj == null ? '—' : proj.toFixed(1);
                title = proj != null ? `MW${p.gameweek}: projected ${proj.toFixed(1)}` : `MW${p.gameweek}: to come`;
              } else if (p.played) {
                height =
                  metric === 'rating'
                    ? Math.max(6, (((p.rating ?? 5) - 5) / 5) * CHART_HEIGHT)
                    : Math.max(6, (p.points / maxPoints) * CHART_HEIGHT);
                label = metric === 'rating' ? (p.rating != null ? p.rating.toFixed(2) : '—') : p.points.toFixed(2);
                title = `MW${p.gameweek}: ${p.points.toFixed(2)} pts${p.rating != null ? `, rated ${p.rating.toFixed(2)}` : ''}`;
              }
              const cls = p.upcoming ? styles.colUp : !p.played ? styles.colNone : '';
              return (
                <div key={p.gameweek} className={`${styles.col} ${cls}`} title={title}>
                  <i>{label}</i>
                  <div
                    className={styles.bar}
                    style={{ height: `${height}px`, ...(p.played ? { background: ratingVar(p.rating) } : {}) }}
                  />
                </div>
              );
            })}
          </div>
          <div className={`${styles.axis} ${dense ? styles.dense : ''}`} aria-hidden="true">
            {series.map((p) => (
              <span key={p.gameweek}>
                {dense ? (p.gameweek === 1 || p.gameweek % 5 === 0 ? p.gameweek : '') : `MW${p.gameweek}`}
              </span>
            ))}
          </div>
        </section>
      )}

      {(back.seasonPerf?.length ?? 0) > 0 && (
        <section className={styles.section}>
          <div className={styles.head}>
            {/* Built at the primary slot only: the season-scope band cuts were
                measured there, and no per-secondary season distribution exists. */}
            <h3 className={styles.title}>Performance</h3>
            <span className={styles.slot} style={{ '--slot': POS_CSS_VAR[primary] ?? 'var(--color-accent)' } as React.CSSProperties}>
              Scored as <b>{primary}</b>
            </span>
          </div>
          <PerformanceBlock groups={back.seasonPerf!} />
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.head}>
          <h3 className={styles.title}>Game Log</h3>
          <span className={styles.slot} style={slotVar}>Scored as <b>{slot}</b></span>
        </div>
        {log.length === 0 ? (
          <p className={styles.empty}>No matches in {seasonName ?? 'this season'} yet.</p>
        ) : (
          <table className={styles.log} ref={tableRef}>
            <colgroup>
              <col className={styles.cMw} />
              <col />
              <col className={styles.cRes} />
              <col className={styles.cMin} />
              <col className={`${styles.cGa} ${styles.hideNarrow}`} />
              <col className={`${styles.cGa} ${styles.hideNarrow}`} />
              <col className={styles.cRtg} />
              <col className={styles.cPts} />
            </colgroup>
            <thead>
              <tr>
                <th>MW</th>
                <th>Opponent</th>
                <th>Result</th>
                <th>Min</th>
                <th className={styles.hideNarrow}>G</th>
                <th className={styles.hideNarrow}>A</th>
                <th>Rtg</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {log.map((g, index) => {
                const opp = parseOpponent(g.opponent);
                const oppCell = (
                  <div className={styles.opp}>
                    {opp.badge ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opp.badge} alt="" width={20} height={20} />
                    ) : (
                      <span className={styles.oppBlank} aria-hidden="true" />
                    )}
                    <b>{opp.name}</b>
                    {opp.venue && <em>{opp.venue}</em>}
                  </div>
                );

                if (g.isUpcoming) {
                  return (
                    <tr key={`up-${g.gameweek}-${index}`} className={styles.upRow}>
                      <td className={styles.mw}>{g.gameweek}</td>
                      <td>{oppCell}</td>
                      <td className={styles.when}>{g.date ? <LocalKickoff iso={g.date} /> : '—'}</td>
                      <td>—</td>
                      <td className={styles.hideNarrow}>—</td>
                      <td className={styles.hideNarrow}>—</td>
                      <td>—</td>
                      <td>
                        {g.projected_points != null ? (
                          <span className={styles.proj} title={`Projected ${g.projected_points.toFixed(1)} points`}>
                            {g.projected_points.toFixed(1)}
                            <small>proj.</small>
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                }

                if (g.isDNP) {
                  return (
                    <tr key={`dnp-${g.gameweek}-${index}`} className={styles.dnpRow}>
                      <td className={styles.mw}>{g.gameweek}</td>
                      <td>{opp.name === 'Unknown' ? <span className={styles.dnpLabel}>Did not play</span> : oppCell}</td>
                      <td className={styles.dnpLabel}>DNP</td>
                      <td>—</td>
                      <td className={styles.hideNarrow}>—</td>
                      <td className={styles.hideNarrow}>—</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  );
                }

                const res = resultFor(g.result, opp.venue);
                const key = `${g.gameweek}-${index}`;
                const isOpen = openRow === key;
                // The block for the slot being viewed, falling back to the
                // primary block for older rows and for slots he isn't eligible at.
                const rowPerf = g.perf_by_position?.[slot] ?? g.perf;
                const perfPos = g.perf_by_position?.[slot] ? slot : primary;
                const openable = (rowPerf?.length ?? 0) > 0;
                const stats = g.stats ?? {};

                return (
                  <Fragment key={key}>
                    <tr
                      data-row={key}
                      className={`${openable ? styles.openable : ''} ${isOpen ? styles.rowOpen : ''}`}
                      onClick={openable ? () => setOpenRow(isOpen ? null : key) : undefined}
                      aria-expanded={openable ? isOpen : undefined}
                    >
                      <td className={styles.mw}>{g.gameweek}</td>
                      <td>{oppCell}</td>
                      <td>
                        {res ? (
                          <span className={`${styles.res} ${styles[`res${res.code}`]}`}>{res.text}</span>
                        ) : '—'}
                      </td>
                      <td>{stats.minutes_played ?? '—'}</td>
                      <td className={styles.hideNarrow}>{stats.goals ?? 0}</td>
                      <td className={styles.hideNarrow}>{stats.assists ?? 0}</td>
                      <td>
                        {g.match_rating != null ? (
                          <span className={styles.rtg} style={{ background: ratingVar(g.match_rating) }}>
                            {g.match_rating.toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className={styles.pts}>{g.fantasy_points.toFixed(2)}</td>
                    </tr>
                    {isOpen && openable && (
                      <tr className={styles.expandRow}>
                        <td colSpan={8}>
                          <PerformanceBlock
                            groups={rowPerf!}
                            note={`Centre line is the median for ${roleArticle(perfPos)}`}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
