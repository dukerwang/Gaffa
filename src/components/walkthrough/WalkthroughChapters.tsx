'use client';

import { useState } from 'react';
import Link from 'next/link';
import Portrait from '@/components/players/Portrait';
import { Icon } from '@/components/ui/Icon';
import { CHAPTERS } from '@/lib/walkthroughs/chapters';
import { resetWalkthroughs } from '@/lib/walkthroughs/seen';
import styles from './WalkthroughChapters.module.css';

const photo = (code: number) => `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`;

/** The Walkthroughs section of a league's Help page: replay any chapter. */
export default function WalkthroughChapters({ leagueId, isDynasty }: { leagueId: string; isDynasty: boolean }) {
  const [reset, setReset] = useState(false);
  const chapters = CHAPTERS.filter((c) => c.only !== (isDynasty ? 'redraft' : 'dynasty'));
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.heading}>Walkthroughs</h2>
        <button
          type="button"
          className={styles.reset}
          disabled={reset}
          onClick={() => {
            resetWalkthroughs();
            setReset(true);
          }}
        >
          {reset ? 'All Back On' : 'Show All Again'}
        </button>
      </div>
      <div className={styles.grid}>
        {chapters.map((c) => (
          <Link key={c.id} href={`/league/${leagueId}${c.route}?tour=${c.id}`} className={styles.tile}>
            {c.photoCode != null ? (
              <Portrait size="md" photoUrl={photo(c.photoCode)} name={c.title} />
            ) : (
              <span className={styles.cup} aria-hidden="true"><Icon name="trophy" size={34} strokeWidth={1.6} /></span>
            )}
            <span className={styles.name}>{c.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
