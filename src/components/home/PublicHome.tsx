import type { CSSProperties } from 'react';
import Link from 'next/link';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import Trophy from '@/components/trophies/Trophy';
import { DEFAULT_CLUB } from '@/lib/honours/trophyGeometry';
import type { HonourKind } from '@/lib/honours/getClubHonours';
import type { FixturesModel } from '@/lib/dashboard/buildDashboardModel';
import type { Showcase, ShowcaseRated } from '@/lib/publicHome/loadShowcase';
import RatedPortrait from '@/app/(dashboard)/dashboard/RatedPortrait';
import { Matchweek } from '@/app/(dashboard)/dashboard/Sections';
import dash from '@/app/(dashboard)/dashboard/dashboard.module.css';
import DockCta from './DockCta';
import styles from './PublicHome.module.css';

/* eslint-disable @next/next/no-img-element */

/**
 * The front of Gaffa, for anyone not yet in a league: a visitor at `/`, or a
 * signed-in manager with no clubs on the dashboard.
 *
 * The pitch is Duke's (2026-09-29): the most realistic fantasy football game,
 * on three things, in his order. The transfer market follows the real Premier
 * League, ratings match what you watched, and every season has four trophies.
 * Ported from the approved prototype (artifact "Gaffa Public Home").
 */

interface Props {
  showcase: Showcase;
  fixtures: FixturesModel;
  gameweek: number;
  nextDeadline: string | null;
  season: string;
  /** Signed in with no league: the actions go straight to create and join. */
  signedIn: boolean;
}

const TROPHIES: { kind: HonourKind; name: string; about: string; prize: number }[] = [
  { kind: 'league_title', name: 'League Title', about: 'Finish top of the table.', prize: 40 },
  { kind: 'champions_cup', name: 'Champions Cup', about: 'The main knockout, for the top clubs.', prize: 50 },
  { kind: 'league_cup', name: 'League Cup', about: 'The second knockout.', prize: 25 },
  { kind: 'consolation_cup', name: 'Consolation Cup', about: 'For clubs who miss out on the other two.', prize: 25 },
];

const ROLE_NOUN: Record<string, string> = {
  GK: 'keeper', CB: 'centre-back', LB: 'full-back', RB: 'full-back', LWB: 'wing-back', RWB: 'wing-back',
  DM: 'midfielder', CM: 'midfielder', AM: 'attacking midfielder', LW: 'winger', RW: 'winger', ST: 'striker',
};

const money = (m: number) => `€${Math.round(m)}m`;
const pts = (n: number) => `${n.toFixed(1)} pts`;
const posVar = (p: string | null) =>
  (p ? { '--pos': `var(--color-pos-${p.toLowerCase()})` } : undefined) as CSSProperties | undefined;

function ordinal(n: number): string {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function withArticle(noun: string): string {
  return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

function oxford(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function rolesSentence(players: ShowcaseRated[]): string {
  const roles = oxford(players.map((p) => withArticle(ROLE_NOUN[p.position ?? ''] ?? 'player')));
  return `${roles.charAt(0).toUpperCase()}${roles.slice(1)}, each rated against players in the same position. Any position can top the week.`;
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function SwapIcon({ size = 24, stroke = 2 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h14l-3-3M20 16H6l3 3" />
    </svg>
  );
}

export default function PublicHome({ showcase, fixtures, gameweek, nextDeadline, season, signedIn }: Props) {
  const createHref = signedIn ? '/league/create' : '/signup';
  const joinHref = signedIn ? '/league/join' : '/signup';
  const { topRated, comparison, arrival, departure } = showcase;

  return (
    <div className={styles.page}>
      {/* The green shelf is the anchor; the Top Rated card rises out of it. */}
      <section className={styles.shelf}>
        <div className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.heroH}>The Most Realistic Fantasy Football Game</h1>
            <p className={styles.heroP}>
              Players score the way their match went. Buy and sell in a transfer market tied to the real Premier
              League, and play for four trophies every season.
            </p>
            <div className={styles.heroActions} id="hero-actions">
              <Link href={createHref} className={`${styles.btn} ${styles.btnPrimary}`}>Create a League</Link>
              <Link href={joinHref} className={`${styles.btn} ${styles.btnGhost}`}>Join a League</Link>
            </div>
            {!signedIn && (
              <p className={styles.heroSignIn}>
                Already a manager? <Link href="/login">Sign In</Link>
              </p>
            )}
          </div>

          {topRated && (
            <article className={styles.rated} aria-labelledby="top-rated">
              <div className={styles.ratedHead}>
                <span className={styles.mwTile} aria-hidden="true">
                  <span className={styles.mwTileK}>MW</span>
                  <span className={styles.mwTileV}>{topRated.gameweek}</span>
                </span>
                <div>
                  <h2 id="top-rated" className={styles.ratedT}>Top Rated</h2>
                  <div className={styles.ratedSub}>Out of {topRated.total} rated players</div>
                </div>
              </div>
              <div className={styles.trio}>
                {topRated.players.map((p) => (
                  <div key={p.playerId} className={styles.tile}>
                    <span className={`${dash.plinth} ${styles.plinth}`} style={posVar(p.position)}>
                      <RatedPortrait photoUrl={p.photoUrl} photoVersion={p.photoVersion} name={p.name} />
                      <span className={dash.rank} style={{ display: 'block' }}>{ordinal(p.rank)}</span>
                      <span className={dash.ratingChip}>{p.rating.toFixed(2)}</span>
                    </span>
                    <span className={`g-namerow ${styles.tileName}`}>
                      <PositionBadge position={p.position} size="sm" />
                      <span>{p.name}</span>
                    </span>
                    <span className={styles.cap}>
                      {p.clubBadge && <img src={p.clubBadge} alt="" className={styles.capBadge} />}
                      {p.line} &middot; {pts(p.points)}
                    </span>
                  </div>
                ))}
              </div>
              <p className={styles.ratedFoot}>{rolesSentence(topRated.players)}</p>
            </article>
          )}
        </div>
      </section>

      {/* Transfers */}
      <section className={`${styles.section} ${topRated ? styles.first : ''}`} aria-labelledby="transfer-wire">
        <div className={styles.lock}>
          <span className={styles.iconTile} aria-hidden="true"><SwapIcon /></span>
          <div>
            <h2 id="transfer-wire" className={styles.lockT}>Transfer Wire</h2>
            <div className={styles.lockSub}>Real transfers and their Gaffa outcomes</div>
          </div>
        </div>

        <div className={styles.twoCol}>
          {(arrival || departure) && (
            <div className={styles.wire}>
              <div className={styles.wireCols} aria-hidden="true">
                <span>Premier League</span>
                <span>In Gaffa</span>
              </div>

              {arrival && (
                <div className={styles.wireRow}>
                  <div className={styles.move}>
                    <Portrait
                      size="md"
                      photoUrl={arrival.player.photoUrl}
                      photoVersion={arrival.player.photoVersion}
                      name={arrival.player.name}
                      club={arrival.player.club}
                      headTopPct={arrival.player.headTopPct}
                      headWidthPct={arrival.player.headWidthPct}
                    />
                    <div className={styles.moveTx}>
                      <div className={styles.moveName}>{arrival.player.name}</div>
                      <div className={styles.route}>Joined {arrival.player.club}</div>
                    </div>
                    <div className={styles.fee}>
                      <span className={styles.feeK}>VALUE</span>
                      {money(arrival.value)}
                    </div>
                  </div>
                  <span className={styles.link}><ArrowIcon /></span>
                  <div className={styles.outcome}>
                    <span className={`${styles.tag} ${styles.tagAuction}`}>Auction</span>
                    <div className={styles.outLine}>
                      <span className={styles.outBig}>{money(arrival.winningBid)}</span>
                      <span className={styles.outD}>Sold after {arrival.bids} {arrival.bids === 1 ? 'bid' : 'bids'}</span>
                    </div>
                  </div>
                </div>
              )}

              {departure && (
                <div className={styles.wireRow}>
                  <div className={styles.move}>
                    <Portrait
                      size="md"
                      photoUrl={departure.player.photoUrl}
                      photoVersion={departure.player.photoVersion}
                      name={departure.player.name}
                      club={departure.player.club}
                      headTopPct={departure.player.headTopPct}
                      headWidthPct={departure.player.headWidthPct}
                    />
                    <div className={styles.moveTx}>
                      <div className={styles.moveName}>{departure.player.name}</div>
                      <div className={styles.route}>Left {departure.player.club}</div>
                    </div>
                    <div className={styles.fee}>
                      <span className={styles.feeK}>VALUE</span>
                      {money(departure.value)}
                    </div>
                  </div>
                  <span className={styles.link}><ArrowIcon /></span>
                  <div className={styles.outcome}>
                    <span className={`${styles.tag} ${styles.tagChoice}`}>Manager&rsquo;s Call</span>
                    <div className={styles.choice}>
                      <div className={styles.opt}>
                        <div className={styles.optK}>Release</div>
                        <div className={styles.optV}>{money(departure.compensation)} now</div>
                      </div>
                      <div className={styles.opt}>
                        <div className={styles.optK}>Retain</div>
                        <div className={styles.optV}>Keep his rights</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <p className={styles.prose}>
              When a Premier League club signs a player, he joins Gaffa too, and any signing worth €50m or more goes
              to auction in every league.
            </p>
            <p className={styles.prose}>
              When a player leaves the league, his manager chooses between 60% of his value now and keeping his
              rights, so he rejoins the squad if he comes back.
            </p>
            <div className={styles.facts}>
              <div className={styles.fact}>
                <span className={styles.factIcon} aria-hidden="true"><SwapIcon size={18} stroke={1.9} /></span>
                <div>
                  <div className={styles.factT}>Trades, Loans, and Listings</div>
                  <div className={styles.factD}>Deal with other managers all season, using your Club Balance.</div>
                </div>
              </div>
              <div className={styles.fact}>
                <span className={styles.factIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20V10l8-6 8 6v10M9 20v-6h6v6" />
                  </svg>
                </span>
                <div>
                  <div className={styles.factT}>Dynasty Squads</div>
                  <div className={styles.factD}>One draft, ever. After that, you buy, borrow, or trade for every player.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ratings */}
      {comparison && (
        <section className={styles.section} aria-labelledby="match-ratings">
          <div className={styles.lock}>
            <span className={`${styles.mwTile} ${styles.mwTileLg}`} aria-hidden="true">
              <span className={styles.mwTileK}>MW</span>
              <span className={styles.mwTileV}>{comparison.gameweek}</span>
            </span>
            <div>
              <h2 id="match-ratings" className={styles.lockT}>Match Ratings</h2>
              <div className={styles.lockSub}>Rated out of 10 against players in the same position</div>
            </div>
          </div>

          <div className={styles.twoCol}>
            <div className={styles.board}>
              {[comparison.hero, ...comparison.scorers].map((p, i) => (
                <div key={p.playerId} className={`${styles.rate} ${i === 0 ? styles.rateTop : ''}`}>
                  <Portrait
                    size="md"
                    photoUrl={p.photoUrl}
                    photoVersion={p.photoVersion}
                    name={p.name}
                    club={p.club}
                    headTopPct={p.headTopPct}
                    headWidthPct={p.headWidthPct}
                    className={styles.ratePic}
                  />
                  <div className={styles.rateWho}>
                    <div className={styles.rateName}>{p.name}</div>
                    <div className={`g-namerow ${styles.rateWhy}`}>
                      <PositionBadge position={p.position} size="sm" />
                      <span>{i === 0 ? 'No goal' : 'Scored'}</span>
                    </div>
                  </div>
                  <div className={styles.bar}>
                    <span
                      className={styles.barFill}
                      style={{ width: `${Math.max(0, Math.min(100, ((p.rating - 6) / 4) * 100))}%` }}
                    />
                  </div>
                  <div className={styles.rateVal}>
                    <div className={styles.rateR}>{p.rating.toFixed(2)}</div>
                    <div className={styles.rateP}>{p.points.toFixed(1)} PTS</div>
                  </div>
                </div>
              ))}
              <div className={styles.axis} aria-hidden="true">
                <div className={styles.axisScale}>
                  <span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
                </div>
              </div>
            </div>

            <div>
              <p className={styles.prose}>
                {comparison.scorers.length > 1
                  ? `${oxford(comparison.scorers.map((s) => s.name))} both scored in Matchweek ${comparison.gameweek}. `
                  : `${comparison.scorers[0].name} scored in Matchweek ${comparison.gameweek}. `}
                {comparison.hero.name} didn&rsquo;t, and he rated higher than {comparison.scorers.length > 1 ? 'both' : comparison.scorers[0].name}
                {comparison.heroWhy ? `, with ${comparison.heroWhy}.` : '.'}
              </p>
              <p className={styles.prose}>
                Every player gets a rating out of 10, close to the one you&rsquo;d give after watching, and earns
                points from it. Over a season, you get an honest read of who&rsquo;s playing well.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Cups */}
      <section className={styles.section} aria-labelledby="four-trophies">
        <div className={styles.lock}>
          <span className={styles.pips} aria-hidden="true">
            {TROPHIES.map((t) => (
              <Trophy key={t.kind} kind={t.kind} size="pip" height={34} className={styles.pip} />
            ))}
          </span>
          <div>
            <h2 id="four-trophies" className={styles.lockT}>Four Trophies</h2>
            <div className={styles.lockSub}>Every season</div>
          </div>
        </div>

        <div className={styles.cabinet}>
          {TROPHIES.map((t) => (
            <div key={t.kind} className={styles.trophy}>
              <div className={styles.trophyArt}>
                <Trophy kind={t.kind} size="hero" height={170} season={season} club={DEFAULT_CLUB} className={styles.trophySvg} />
              </div>
              <div className={styles.trophyName}>{t.name}</div>
              <div className={styles.trophyD}>{t.about}</div>
              <div className={styles.prize}>{money(t.prize)}</div>
            </div>
          ))}
        </div>
        <p className={styles.cupNote}>
          Play three knockout cups alongside the league. A club with no title hope in March still has a tie next
          week. Cup ties never end level, and a treble is possible.
        </p>
      </section>

      {/* Fixtures + start */}
      <div className={`${styles.section} ${styles.bottomRow}`}>
        <Matchweek model={{ gameweek, nextDeadline, fixtures }} fixturesHref={null} />

        <aside className={styles.start} id="start-league" aria-labelledby="start-league-title">
          <h2 id="start-league-title" className={styles.startT}>Start a League</h2>
          <p className={styles.startP}>
            Set up a league for you and your friends, and keep playing it season after season. Nobody starts over in
            August.
          </p>
          <ol className={styles.steps}>
            <li><span className={styles.n}>1</span>Create the league and set its rules.</li>
            <li><span className={styles.n}>2</span>Share the invite code.</li>
            <li><span className={styles.n}>3</span>Draft once, then run your club.</li>
          </ol>
          <div className={styles.startActions}>
            <Link href={createHref} className={`${styles.btn} ${styles.btnPrimary}`}>Create a League</Link>
            <Link href={joinHref} className={`${styles.btn} ${styles.btnGhost}`}>Join with an Invite Code</Link>
          </div>
        </aside>
      </div>

      {!signedIn && (
        <footer className={styles.foot}>
          <span>&copy; {new Date().getFullYear()} Gaffa</span>
          <Link href="/guide">Guide</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </footer>
      )}

      <DockCta createHref={createHref} joinHref={joinHref} />
    </div>
  );
}
