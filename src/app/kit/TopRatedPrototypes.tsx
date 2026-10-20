'use client';

import { useState, type CSSProperties } from 'react';
import { SegmentedControl } from '@/components/ui';
import PositionBadge from '@/components/players/PositionBadge';
import RatedPortrait from '../(dashboard)/dashboard/RatedPortrait';
import dash from '../(dashboard)/dashboard/dashboard.module.css';
import styles from './kit.module.css';

/* Prototype only. Three switcher looks and placements for the dashboard's
   Top Rated head, drawn with the dashboard's own tile classes so the rail is
   the shipped one and only the head differs. Ratings are fixed examples. */

const photo = (code: number) =>
  `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`;

interface Rated {
  id: string;
  name: string;
  pos: string;
  club: string;
  slug: string;
  photo: string;
  rating: number;
}

const MATCHWEEK: Rated[] = [
  { id: 'neto', name: 'Pedro Neto', pos: 'RW', club: 'Chelsea', slug: 'chelsea', photo: photo(247632), rating: 9.41 },
  { id: 'haaland', name: 'Erling Haaland', pos: 'ST', club: 'Man City', slug: 'man-city', photo: photo(223094), rating: 9.12 },
  { id: 'evanilson', name: 'Evanilson', pos: 'ST', club: 'Bournemouth', slug: 'bournemouth', photo: photo(444102), rating: 8.87 },
  { id: 'iwobi', name: 'Alex Iwobi', pos: 'LW', club: 'Fulham', slug: 'fulham', photo: photo(153133), rating: 8.64 },
  { id: 'gabriel', name: 'Gabriel', pos: 'CB', club: 'Arsenal', slug: 'arsenal', photo: photo(226597), rating: 8.51 },
  { id: 'cunha', name: 'Matheus Cunha', pos: 'LW', club: 'Man Utd', slug: 'man-utd', photo: photo(430871), rating: 8.33 },
];

const SEASON: Rated[] = [
  { id: 'haaland', name: 'Erling Haaland', pos: 'ST', club: 'Man City', slug: 'man-city', photo: photo(223094), rating: 7.94 },
  { id: 'saka', name: 'Bukayo Saka', pos: 'RW', club: 'Arsenal', slug: 'arsenal', photo: photo(223340), rating: 7.71 },
  { id: 'rice', name: 'Declan Rice', pos: 'DM', club: 'Arsenal', slug: 'arsenal', photo: photo(204480), rating: 7.58 },
  { id: 'semenyo', name: 'Antoine Semenyo', pos: 'RW', club: 'Man City', slug: 'man-city', photo: photo(437730), rating: 7.49 },
  { id: 'wirtz', name: 'Florian Wirtz', pos: 'AM', club: 'Liverpool', slug: 'liverpool', photo: photo(494595), rating: 7.37 },
  { id: 'raya', name: 'David Raya', pos: 'GK', club: 'Arsenal', slug: 'arsenal', photo: photo(154561), rating: 7.28 },
];

type Scope = 'matchweek' | 'season';
const OPTIONS = [
  { value: 'matchweek' as const, label: 'Matchweek 7' },
  { value: 'season' as const, label: 'Season' },
];

function Rail({ scope }: { scope: Scope }) {
  const players = scope === 'matchweek' ? MATCHWEEK : SEASON;
  return (
    <div className={dash.tiles}>
      {players.map((p, i) => (
        <div key={`${scope}-${p.id}`} className={`${dash.tile} ${styles.protoTile}`} style={{ animationDelay: `${i * 30}ms` }}>
          <span className={dash.plinth} style={{ '--pos': `var(--color-pos-${p.pos.toLowerCase()})` } as CSSProperties}>
            <RatedPortrait photoUrl={p.photo} photoVersion={null} name={p.name} />
            <span className={dash.rank} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <span className={dash.ratingChip} aria-hidden="true">{p.rating.toFixed(2)}</span>
          </span>
          <span className={`g-namerow ${dash.tileName}`}>
            <PositionBadge position={p.pos} size="sm" />
            <span>{p.name}</span>
          </span>
          <span className={dash.cap}>
            <img src={`/team-logos/${p.slug}.png`} alt="" className={dash.capBadge} />
            {p.club}
          </span>
        </div>
      ))}
    </div>
  );
}

function AllRatings({ className }: { className?: string }) {
  return (
    <a href="#" className={[dash.lockLink, styles.protoLink, className].filter(Boolean).join(' ')} onClick={(e) => e.preventDefault()}>
      All Ratings &rarr;
    </a>
  );
}

/** A: ink switch at the right of the head, beside the link. */
function InkRight() {
  const [scope, setScope] = useState<Scope>('matchweek');
  return (
    <section className={styles.protoSection} aria-labelledby="proto-a">
      <div className={styles.protoHead}>
        <h3 id="proto-a" className={dash.lockT}>Top Rated</h3>
        <div className={styles.protoRight}>
          <SegmentedControl variant="ink" ariaLabel="Top Rated Scope" value={scope} onChange={setScope} options={OPTIONS} />
          <span className={styles.protoRule} aria-hidden="true" />
          <AllRatings className={styles.protoDesktopOnly} />
        </div>
      </div>
      <Rail scope={scope} />
      <AllRatings className={styles.protoMobileOnly} />
    </section>
  );
}

/** B: underline switch at the right, sitting on the title's baseline. */
function UnderlineRight() {
  const [scope, setScope] = useState<Scope>('matchweek');
  return (
    <section className={styles.protoSection} aria-labelledby="proto-b">
      <div className={[styles.protoHead, styles.protoHeadBaseline].join(' ')}>
        <h3 id="proto-b" className={dash.lockT}>Top Rated</h3>
        <div className={styles.protoRight}>
          <SegmentedControl variant="underline" ariaLabel="Top Rated Scope" value={scope} onChange={setScope} options={OPTIONS} />
          <span className={styles.protoRule} aria-hidden="true" />
          <AllRatings className={styles.protoDesktopOnly} />
        </div>
      </div>
      <Rail scope={scope} />
      <AllRatings className={styles.protoMobileOnly} />
    </section>
  );
}

/** C: the scope is part of the heading, set in the title's serif. */
function InTitle() {
  const [scope, setScope] = useState<Scope>('matchweek');
  return (
    <section className={styles.protoSection} aria-labelledby="proto-c">
      <div className={[styles.protoHead, styles.protoHeadBaseline].join(' ')}>
        <div className={styles.protoTitleSwitch}>
          <h3 id="proto-c" className={dash.lockT}>Top Rated</h3>
          <SegmentedControl
            variant="underline"
            className={styles.serifSwitch}
            ariaLabel="Top Rated Scope"
            value={scope}
            onChange={setScope}
            options={OPTIONS}
          />
        </div>
        <AllRatings className={styles.protoDesktopOnly} />
      </div>
      <Rail scope={scope} />
      <AllRatings className={styles.protoMobileOnly} />
    </section>
  );
}

export default function TopRatedPrototypes() {
  return (
    <div className={styles.protos}>
      <h2 className={styles.protoGroupTitle}>Switcher Options</h2>
      <p className={styles.protoIntro}>
        Three looks for the Top Rated head, on the dashboard&apos;s own rail. Switch each one: the rail changes
        between this matchweek and the season.
      </p>
      <div className={styles.protoCase}>
        <span className={styles.protoTag}>A</span>
        <InkRight />
      </div>
      <div className={styles.protoCase}>
        <span className={styles.protoTag}>B</span>
        <UnderlineRight />
      </div>
      <div className={styles.protoCase}>
        <span className={styles.protoTag}>C</span>
        <InTitle />
      </div>
    </div>
  );
}
