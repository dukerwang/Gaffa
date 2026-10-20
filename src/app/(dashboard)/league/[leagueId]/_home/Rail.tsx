import NavigationLink from '@/components/ui/NavigationLink';
import type { HomeModel } from '@/lib/home/buildHomeModel';
import { renderBoldedText } from '@/lib/narrative/boldText';
import OpponentCard from './OpponentCard';
import styles from './home.module.css';

/**
 * The rail.
 *
 * It carries three things the old page's rail did not: the opponent as a
 * PERSON, a shortened register of transactions, and the dynasty. That card used
 * to be called The Wire, which collided with the live market ticker of the same
 * name on /transfers — two different feeds, one name. The ticker keeps the name;
 * this one is the settled record, so it takes the page's. What it deliberately no longer
 * carries is the "desk summary" — four unrelated numbers where "Squad 23 of
 * 25" was a My Club stat and "Unread messages 3" was a nav badge. That block
 * existed because the rail ran short, which is a content problem; the honest
 * fix is better content, not a sticky column.
 */
export default function Rail({ model }: { model: HomeModel }) {
  return (
    <aside className={styles.rail} aria-label="League feed">
      <OpponentCard model={model} />

      <div className={styles.railCard}>
        <div className={styles.railHd}>
          <h2 className={styles.railT}>Transactions</h2>
        </div>
        {model.wire.length === 0 ? (
          <div className={styles.ev}>
            <span className={styles.evDot} />
            <div className={styles.evText}>No player has changed hands yet this season.</div>
          </div>
        ) : (
          model.wire.map((e) => (
            <div key={e.id} className={styles.ev}>
              <span className={styles.evDot} />
              <div>
                {/* The generators mark emphasis with **…** and encode player
                    references as **p:{id}:{Name}**. Printing the raw string
                    leaks both. renderBoldedText is the parser the rest of the
                    app already uses; with no click handler it degrades to
                    <strong>, which is exactly right for a digest. */}
                <div className={styles.evText}>{renderBoldedText(e.text)}</div>
                <div className={styles.evTime}>{e.at}</div>
              </div>
            </div>
          ))
        )}
        <NavigationLink href={`/league/${model.leagueId}/activity`} className={styles.railMore}>
          All transactions &rarr;
        </NavigationLink>
      </div>

      <div className={styles.railCard}>
        <div className={styles.railHd}>
          <h2 className={styles.railT}>The Club</h2>
        </div>
        <div className={styles.dyn}>
          {model.clubFacts.map((f, i) => (
            <div key={i} className={styles.dynRow}>
              <span className={styles.dynL}>{f.label}</span>
              <span className={f.gold ? styles.dynVGold : styles.dynV}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Not tied to the league: the builder picks from every Premier League squad. */}
      <NavigationLink href="/lineup-builder" className={styles.toolCard}>
        <span className={styles.toolIcon} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2.5" width="16" height="19" rx="1.5" />
            <path d="M4 12h16" />
            <circle cx="12" cy="12" r="2.6" />
            <path d="M8.5 2.5v3.2h7V2.5M8.5 21.5v-3.2h7v3.2" />
          </svg>
        </span>
        <span className={styles.toolText}>
          <span className={styles.toolT}>Lineup Builder</span>
          <span className={styles.toolSub}>Pick any Premier League XI and share it.</span>
        </span>
        <span className={styles.toolArrow} aria-hidden="true">&rarr;</span>
      </NavigationLink>
    </aside>
  );
}
