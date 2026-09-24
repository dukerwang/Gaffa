'use client';

import { useEffect, useState } from 'react';
import { STYLE_LABEL } from '@futbolpedia/engine';
import type { OutlookStyle } from '@futbolpedia/engine';
import type { HubRealWorldForm, HubScoutingReport } from '@/lib/players/hubData';
import { QUALITY_LABEL, humanise } from '@/lib/outlook/labels';
import { seasonLabel } from '@/lib/players/cardSeason';
import styles from './PlayerCardScouting.module.css';

interface Profile {
  report: HubScoutingReport | null;
  form: HubRealWorldForm | null;
  season: string;
}

/**
 * Profiles are fetched the first time the Scouting tab opens for a player and
 * season, never when the card opens, and kept for the session.
 */
const profileCache = new Map<string, Profile>();
const profileInflight = new Map<string, Promise<Profile | null>>();

function loadProfile(playerId: string, leagueId: string | undefined, season: string | null): Promise<Profile | null> {
  const key = `${playerId}|${leagueId ?? ''}|${season ?? ''}`;
  const cached = profileCache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = profileInflight.get(key);
  if (existing) return existing;
  const params = new URLSearchParams();
  if (leagueId) params.set('leagueId', leagueId);
  if (season) params.set('season', season);
  const promise = fetch(`/api/players/${playerId}/profile${params.size ? `?${params}` : ''}`)
    .then((r) => (r.ok ? (r.json() as Promise<Profile>) : null))
    .then((data) => {
      if (data) profileCache.set(key, data);
      return data;
    })
    .catch(() => null)
    .finally(() => profileInflight.delete(key));
  profileInflight.set(key, promise);
  return promise;
}

interface Props {
  playerId: string;
  leagueId?: string;
  season: string | null;
  isCurrent: boolean;
}

export default function PlayerCardScouting({ playerId, leagueId, season, isCurrent }: Props) {
  const key = `${playerId}|${leagueId ?? ''}|${season ?? ''}`;
  const [loaded, setLoaded] = useState<{ key: string; profile: Profile | null } | null>(() => {
    const cached = profileCache.get(key);
    return cached ? { key, profile: cached } : null;
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loaded?.key === key) return;
    let active = true;
    loadProfile(playerId, leagueId, season).then((profile) => {
      if (active) setLoaded({ key, profile });
    });
    return () => {
      active = false;
    };
  }, [key, loaded?.key, playerId, leagueId, season]);

  if (loaded?.key !== key) {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-label="Loading scouting report">
        <i style={{ width: '40%' }} />
        <i /><i /><i style={{ width: '70%' }} />
        <i className={styles.skelChips} />
      </div>
    );
  }

  const report = loaded.profile?.report ?? null;
  const form = loaded.profile?.form ?? null;

  return (
    <div>
      <section className={styles.section}>
        <div className={styles.head}>
          <h3 className={styles.title}>Scouting Report</h3>
          {report && (
            <span className={styles.meta}>
              <span className={`${styles.quality} ${styles[`q_${report.quality}`] ?? ''}`}>
                {QUALITY_LABEL[report.quality] ?? report.quality}
              </span>
              <span className={styles.date}>
                {new Date(report.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </span>
          )}
        </div>

        {report ? (
          <>
            <p className={`${styles.prose} ${open ? styles.proseOpen : ''}`}>{report.outlook}</p>
            <button type="button" className={styles.more} onClick={() => setOpen((v) => !v)}>
              {open ? 'Show Less' : 'Read More'}
            </button>
            <div className={styles.facets}>
              <Facet k="Minutes" v={humanise(report.minutes_role)} tone="lead" />
              <Facet k="Dynasty" v={humanise(report.dynasty_value)} tone="lead" />
              <Facet k="Phase" v={humanise(report.career_phase)} />
              <Facet k="Mobility" v={humanise(report.pl_mobility)} />
              {report.style.slice(0, 3).map((s) => (
                <Facet key={s} k="Style" v={STYLE_LABEL[s as OutlookStyle] ?? humanise(s)} />
              ))}
              {report.risk_flags.map((r) => (
                <Facet key={r} k="Watch" v={humanise(r)} tone="warn" />
              ))}
            </div>
            {!isCurrent && season && (
              /* An outlook judges the player now. It has no historical version,
                 so an older season mustn't make it look like it describes that one. */
              <p className={styles.note}>Written for today. The figures beside it are {seasonLabel(season)}.</p>
            )}
          </>
        ) : (
          <p className={styles.empty}>Not yet scouted.</p>
        )}
      </section>

      {form && (
        <section className={styles.section}>
          <div className={styles.head}>
            <h3 className={styles.title}>Premier League Form</h3>
            <span className={styles.date}>{seasonLabel(form.season)} · {form.appearances} apps</span>
          </div>
          <div className={styles.grid}>
            <div className={styles.stat}>
              <b>{form.startRate == null ? '—' : `${Math.round(form.startRate * 100)}%`}</b>
              <span>Start Rate</span>
            </div>
            <div className={styles.stat}>
              <b>{form.xgiPer90 == null ? '—' : form.xgiPer90.toFixed(2)}</b>
              <span>xGI per 90</span>
            </div>
            <div className={styles.stat}>
              <b>{form.setPieces.length > 0 ? form.setPieces.length : '—'}</b>
              <span>Set-Piece Duties</span>
            </div>
          </div>
          {form.xgiPercentile != null && (
            <div className={styles.pct}>
              <div className={styles.pctHead}>
                <span>xGI against his position</span>
                <b>{Math.round(form.xgiPercentile * 100)}th</b>
              </div>
              <div className={styles.track}>
                <i style={{ width: `${Math.max(2, Math.min(100, Math.round(form.xgiPercentile * 100)))}%` }} />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Facet({ k, v, tone }: { k: string; v: string; tone?: 'lead' | 'warn' }) {
  return (
    <span className={`${styles.facet} ${tone === 'lead' ? styles.lead : tone === 'warn' ? styles.warn : ''}`}>
      <span>{k}</span>
      <b>{v}</b>
    </span>
  );
}
