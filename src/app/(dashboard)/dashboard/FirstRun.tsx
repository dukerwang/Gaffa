import type { CSSProperties } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import PositionBadge from '@/components/players/PositionBadge';
import type { DashboardModel, RatedPlayer } from '@/lib/dashboard/buildDashboardModel';
import RatedPortrait from './RatedPortrait';
import { ordinal } from './LeagueCard';
import { Matchweek } from './Sections';
import styles from './dashboard.module.css';

/* eslint-disable @next/next/no-img-element */

function PairTile({ p, rank }: { p: RatedPlayer; rank: number }) {
  return (
    <div>
      <span
        className={styles.plinth}
        style={p.position ? ({ '--pos': `var(--color-pos-${p.position.toLowerCase()})` } as CSSProperties) : undefined}
      >
        <RatedPortrait photoUrl={p.photoUrl} photoVersion={p.photoVersion} name={p.name} />
        <span className={styles.rank} style={{ display: 'block' }}>{ordinal(rank).toUpperCase()}</span>
        <span className={styles.ratingChip}>{p.rating.toFixed(2)}</span>
      </span>
      <span className={`g-namerow ${styles.tileName}`}>
        <PositionBadge position={p.position} size="sm" />
        <span>{p.name}</span>
      </span>
      {p.club && (
        <span className={styles.cap}>
          {p.clubBadge && <img src={p.clubBadge} alt="" className={styles.capBadge} />}
          {p.club}
        </span>
      )}
    </div>
  );
}

const FEATURES = [
  {
    title: 'Dynasty Squads',
    body: 'One draft, ever. You keep your squad season to season.',
    icon: <path d="M4 20V10l8-6 8 6v10M9 20v-6h6v6" />,
  },
  {
    title: 'Transfer Market',
    body: 'Auctions, loans, and trades, paid from your Club Balance.',
    icon: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  },
  {
    title: 'League and Cups',
    body: 'A league title plus the Champions Cup, League Cup, and Consolation Cup.',
    icon: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6" />,
  },
];

export default function FirstRun({ model }: { model: DashboardModel }) {
  const pair = model.roleRatings;

  return (
    <>
      <div className={styles.heroShelf}>
        <h1 className={styles.heroH}>Fantasy Football, Scored by Role</h1>
        <p className={styles.heroP}>
          Twelve tactical roles, a squad you keep for good, and a transfer market of auctions, loans, and trades.
        </p>
        <div className={styles.heroActions}>
          <NavigationLink href="/league/create" className={styles.heroPrimary}>Create a League</NavigationLink>
          <NavigationLink href="/league/join" className={styles.heroSecondary}>Join with an Invite Code</NavigationLink>
        </div>
      </div>

      <div className={styles.firstGrid}>
        {pair && (
          <section aria-labelledby="role-ratings">
            <div className={styles.lock}>
              <span className={styles.mwTile} aria-hidden="true">
                <span className={styles.mwTileK}>MW</span>
                <span className={styles.mwTileV}>{pair.gameweek}</span>
              </span>
              <div>
                <h2 id="role-ratings" className={styles.lockTSm}>Role Ratings</h2>
                <div className={styles.lockSub}>Out of {pair.total} rated players</div>
              </div>
            </div>
            <div className={styles.pair}>
              <PairTile p={pair.keeper} rank={pair.keeper.rank} />
              <PairTile p={pair.striker} rank={pair.striker.rank} />
            </div>
            <p className={styles.pairNote}>
              Both played well. Each is rated against the median for <b>his own role</b>, so the keeper finishes
              higher. With flat points, you can&rsquo;t make that comparison.
            </p>
          </section>
        )}

        <section aria-labelledby="league-features">
          <h2 id="league-features" className={styles.lockTSm}>League Features</h2>
          <div className={styles.features}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.feature}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <div>
                  <div className={styles.featureT}>{f.title}</div>
                  <div className={styles.featureD}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>
          <NavigationLink href="/guide" className={styles.guideLink}>Read the Guide &rarr;</NavigationLink>
        </section>
      </div>

      <div className={styles.section}>
        <Matchweek model={model} fixturesHref={null} />
      </div>
    </>
  );
}
