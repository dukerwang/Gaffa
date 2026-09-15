import type { CSSProperties } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import type { DashboardModel, FixtureRow } from '@/lib/dashboard/buildDashboardModel';
import LocalTime from './LocalTime';
import styles from './dashboard.module.css';

/* eslint-disable @next/next/no-img-element */

export function Shelf({ model }: { model: DashboardModel }) {
  const { cards, counts } = model;
  const crests = cards.slice(0, 3);
  const more = cards.length - crests.length;
  const clubs = `${cards.length} ${cards.length === 1 ? 'club' : 'clubs'}`;
  const playing = counts.live ? ` · ${counts.live} playing now` : '';

  return (
    <div className={styles.shelf}>
      <div className={styles.shelfInner}>
        <div className={styles.stack} aria-hidden="true">
          {crests.map((c) => (
            <span key={c.leagueId} className={styles.stackItem}>
              <CrestBadge
                config={c.myCrest as CrestConfig | null}
                size={20}
                teamName={c.myTeamName}
                interactive={false}
              />
            </span>
          ))}
          {more > 0 && <span className={styles.stackMore}>+{more}</span>}
        </div>
        <div className={styles.shelfTitle}>
          <h1 className={styles.shelfH}>Your Leagues</h1>
          <div className={styles.shelfSub}>
            {clubs}
            {playing}
            <span className={styles.shelfDesktopOnly}> &middot; Matchweek {model.gameweek}</span>
          </div>
        </div>
        <div className={styles.pills}>
          {counts.live > 0 && (
            <span className={styles.pill}>
              <span className={styles.pillDot} aria-hidden="true" />
              {counts.live} Live
            </span>
          )}
          {counts.drafting > 0 && <span className={styles.pill}>{counts.drafting} Drafting</span>}
          {counts.setup > 0 && <span className={styles.pill}>{counts.setup} Pre-Draft</span>}
          {counts.offseason > 0 && <span className={styles.pill}>{counts.offseason} Offseason</span>}
        </div>
      </div>
    </div>
  );
}

export function Doors({ className }: { className?: string }) {
  return (
    <>
      <NavigationLink href="/league/create" className={`${styles.card} ${styles.door} ${className ?? ''}`}>
        <span className={styles.doorIcon} aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span>
          <span className={styles.doorTitle}>Create a League</span>
          <span className={styles.doorSub}>Set the rules and invite your friends.</span>
        </span>
      </NavigationLink>
      <NavigationLink href="/league/join" className={`${styles.card} ${styles.door} ${className ?? ''}`}>
        <span className={styles.doorIcon} aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0" />
          </svg>
        </span>
        <span>
          <span className={styles.doorTitle}>Join a League</span>
          <span className={styles.doorSub}>Enter an invite code from your commissioner.</span>
        </span>
      </NavigationLink>
    </>
  );
}

function FixtureLine({ f }: { f: FixtureRow }) {
  const scored = f.state !== 'upcoming' && f.homeScore !== null && f.awayScore !== null;
  const homeLost = f.state === 'finished' && scored && f.homeScore! < f.awayScore!;
  const awayLost = f.state === 'finished' && scored && f.awayScore! < f.homeScore!;

  return (
    <div className={f.state === 'upcoming' ? styles.fxUpcoming : styles.fx}>
      {f.homeBadge ? <img src={f.homeBadge} alt="" className={styles.fxBadge} /> : <span className={styles.fxBadge} />}
      <span className={`${styles.fxName} ${homeLost ? styles.fxNameLost : ''}`}>{f.homeName}</span>
      {scored ? (
        <span className={styles.fxScore}>
          {f.homeScore}&ndash;{f.awayScore}
        </span>
      ) : (
        <span className={styles.fxTime}>
          <LocalTime iso={f.kickoff} variant="dayTime" />
        </span>
      )}
      <span className={`${styles.fxNameAway} ${awayLost ? styles.fxNameLost : ''}`}>{f.awayName}</span>
      {f.awayBadge ? <img src={f.awayBadge} alt="" className={styles.fxBadge} /> : <span className={styles.fxBadge} />}
      {f.state === 'live' ? (
        <span className={styles.fxMin}>{f.minutes}&prime;</span>
      ) : (
        <span className={styles.fxState}>{f.state === 'finished' ? 'FT' : ''}</span>
      )}
    </div>
  );
}

export function Matchweek({ model, fixturesHref }: { model: DashboardModel; fixturesHref: string | null }) {
  const fx = model.fixtures;
  if (fx.rows.length === 0) return null;
  const segments = [
    ...Array.from({ length: fx.finished }, () => styles.segDone),
    ...Array.from({ length: fx.live }, () => styles.segLive),
    ...Array.from({ length: fx.toCome }, () => styles.seg1),
  ];
  const kickedOff = fx.finished + fx.live > 0;

  return (
    <section aria-labelledby="matchweek" className={styles.fxWrap}>
      <div className={`${styles.lock} ${styles.fxLock}`}>
        <span className={styles.mwTile} aria-hidden="true">
          <span className={styles.mwTileK}>MW</span>
          <span className={styles.mwTileV}>{model.gameweek}</span>
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 id="matchweek" className={styles.lockTSm}>Premier League</h2>
          <div className={styles.lockSub}>
            {kickedOff || !model.nextDeadline ? (
              <LocalTime iso={fx.firstKickoff} endIso={fx.lastKickoff} variant="range" />
            ) : (
              <LocalTime iso={model.nextDeadline} variant="dayTime" prefix="Deadline " />
            )}
          </div>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar} style={{ '--n': segments.length } as CSSProperties} aria-hidden="true">
            {segments.map((cls, i) => (
              <span key={i} className={cls} />
            ))}
          </div>
          <div className={styles.progressKey}>
            <span>{fx.finished} Finished</span>
            <span className={styles.keyLive}>{fx.live} Live</span>
            <span className={styles.keyCome}>{fx.toCome} To Come</span>
          </div>
        </div>
        {fixturesHref && (
          <NavigationLink href={fixturesHref} className={styles.lockLink}>
            All Fixtures &rarr;
          </NavigationLink>
        )}
      </div>

      <div className={styles.fixtures}>
        {fx.rows.map((f) => (
          <FixtureLine key={f.id} f={f} />
        ))}
      </div>
    </section>
  );
}

export function AboutGaffa() {
  return (
    <section className={styles.about} aria-labelledby="about-gaffa">
      <div className={styles.aboutHead}>
        <h2 id="about-gaffa" className={styles.aboutT}>About Gaffa</h2>
        <span className={styles.baseline} aria-hidden="true">
          <span className={styles.baselineInk} />
          <span className={styles.baselineTick} />
        </span>
      </div>
      <p className={styles.aboutP}>
        There are twelve tactical roles, and every player is rated against the median for <b>his own</b>. A
        full-back is judged as a full-back, so one who overlaps and keeps a clean sheet can outscore a striker who
        scores once and does little else.
      </p>
      <div className={styles.aboutFacts}>
        <div className={styles.fact}>
          <div className={styles.factT}>Dynasty Squads</div>
          <div className={styles.factD}>One draft, ever. You keep your squad season to season.</div>
        </div>
        <div className={styles.fact}>
          <div className={styles.factT}>Transfer Market</div>
          <div className={styles.factD}>Auctions, loans, and trades, paid from your Club Balance.</div>
        </div>
      </div>
      <NavigationLink href="/guide" className={styles.aboutBtn}>
        Read the Guide
      </NavigationLink>
    </section>
  );
}
