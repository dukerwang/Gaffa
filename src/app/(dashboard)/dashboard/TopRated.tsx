'use client';

import { useState, type CSSProperties } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import PositionBadge from '@/components/players/PositionBadge';
import { usePlayerCard } from '@/components/players/PlayerCardProvider';
import type { RatedPlayer } from '@/lib/dashboard/buildDashboardModel';
import RatedPortrait from './RatedPortrait';
import styles from './dashboard.module.css';

type Scope = 'matchweek' | 'season';

export default function TopRated({
  matchweek,
  season,
  ratingsHref,
}: {
  matchweek: { gameweek: number; players: RatedPlayer[] } | null;
  season: RatedPlayer[];
  ratingsHref: string | null;
}) {
  const [scope, setScope] = useState<Scope>(matchweek ? 'matchweek' : 'season');
  const { openPlayerById } = usePlayerCard();
  const players = scope === 'matchweek' ? (matchweek?.players ?? []) : season;

  if (!matchweek && season.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="top-rated">
      <div className={`${styles.lock} ${styles.topLock}`}>
        <h2 id="top-rated" className={styles.lockT}>Top Rated</h2>
        <SegmentedControl<Scope>
          className={styles.seg}
          ariaLabel="Top Rated scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'matchweek', label: matchweek ? `Matchweek ${matchweek.gameweek}` : 'Matchweek', disabled: !matchweek },
            { value: 'season', label: 'Season', disabled: season.length === 0 },
          ]}
        />
        {ratingsHref && (
          <NavigationLink href={ratingsHref} className={styles.lockLink}>
            All Ratings &rarr;
          </NavigationLink>
        )}
      </div>

      <div className={styles.tiles}>
        {players.map((p, i) => (
          <button
            key={`${scope}-${p.playerId}`}
            type="button"
            className={styles.tile}
            onClick={() => openPlayerById(p.playerId)}
            aria-label={`${p.name}, ${p.position ?? ''}, rated ${p.rating.toFixed(2)}`}
          >
            <span
              className={styles.plinth}
              style={p.position ? ({ '--pos': `var(--color-pos-${p.position.toLowerCase()})` } as CSSProperties) : undefined}
            >
              <RatedPortrait photoUrl={p.photoUrl} photoVersion={p.photoVersion} name={p.name} />
              <span className={styles.rank} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.ratingChip} aria-hidden="true">{p.rating.toFixed(2)}</span>
            </span>
            <span className={`g-namerow ${styles.tileName}`}>
              <PositionBadge position={p.position} size="sm" />
              <span>{p.name}</span>
            </span>
            {p.club && (
              <span className={styles.cap}>
                {p.clubBadge && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.clubBadge} alt="" className={styles.capBadge} />
                )}
                {p.club}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
