import NavigationLink from '@/components/ui/NavigationLink';
import { Icon } from '@/components/ui/Icon';
import type { DashboardModel } from '@/lib/dashboard/buildDashboardModel';
import LocalTime from './LocalTime';
import styles from './dashboard.module.css';

/* eslint-disable @next/next/no-img-element */

export function Shelf({ model }: { model: DashboardModel }) {
  const { cards, counts } = model;
  const clubs = `${cards.length} ${cards.length === 1 ? 'club' : 'clubs'}`;
  const playing = counts.live ? ` · ${counts.live} playing now` : '';
  const deadline =
    cards
      .map((c) => c.match?.deadline)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null;

  return (
    <div className={styles.shelf}>
      <div className={styles.shelfInner}>
        <div className={styles.hero}>
          <Icon name="gaffa" size={112} className={styles.seal} aria-hidden="true" />
          <div className={styles.wordmark}>
            <h1 className={styles.shelfH}>Gaffa</h1>
            <div className={styles.descriptor}>Dynasty Fantasy Football</div>
          </div>
          <div className={styles.matchweek}>
            <span className={styles.matchweekK}>Matchweek</span>
            <div className={styles.matchweekV}>{model.gameweek}</div>
            {deadline && (
              <div className={styles.matchweekD}>
                <LocalTime iso={deadline} variant="dayTime" prefix="Deadline " />
              </div>
            )}
          </div>
        </div>
        <div className={styles.shelfLabel}>
          <h2 className={styles.shelfLabelH}>Your Leagues</h2>
          <span className={styles.shelfSub}>
            {clubs}
            {playing}
          </span>
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
    </div>
  );
}

export function Closer() {
  return (
    <footer className={styles.closer}>
      <div className={styles.closerInner}>
        <Icon name="gaffa" size={56} className={styles.closerMark} aria-hidden="true" />
        <div>
          <div className={styles.closerName}>Gaffa</div>
          <div className={styles.closerSub}>Dynasty Fantasy Football</div>
        </div>
      </div>
    </footer>
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
      <NavigationLink href="/lineup-builder" className={`${styles.card} ${styles.door} ${styles.doorWide} ${className ?? ''}`}>
        <span className={styles.doorIcon} aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2.5" width="16" height="19" rx="1.5" />
            <path d="M4 12h16" />
            <circle cx="12" cy="12" r="2.6" />
            <path d="M8.5 2.5v3.2h7V2.5M8.5 21.5v-3.2h7v3.2" />
          </svg>
        </span>
        <span>
          <span className={styles.doorTitle}>Lineup Builder</span>
          <span className={styles.doorSub}>Pick any Premier League XI and share it.</span>
        </span>
      </NavigationLink>
    </>
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
        The most realistic fantasy football game. Players score the way their match went, you buy and sell in a
        market tied to real Premier League transfers, and you play for four trophies every season.
      </p>
      <div className={styles.aboutFacts}>
        <div className={styles.fact}>
          <div className={styles.factT}>Transfer Wire</div>
          <div className={styles.factD}>A real signing worth €50m or more goes to auction, and you earn compensation when a player leaves the league.</div>
        </div>
        <div className={styles.fact}>
          <div className={styles.factT}>Four Trophies</div>
          <div className={styles.factD}>The league title, plus the Champions, League, and Consolation Cups.</div>
        </div>
      </div>
      <NavigationLink href="/guide" className={styles.aboutBtn}>
        Read the Guide
      </NavigationLink>
    </section>
  );
}
