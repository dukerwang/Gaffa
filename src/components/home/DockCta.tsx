'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './PublicHome.module.css';

/**
 * Create a League, docked to the bottom edge on phones. It appears once the
 * hero's own buttons scroll away and steps aside while the Start a League
 * panel is on screen, so there is never a second copy of the same button in
 * view. Desktop hides it in CSS; the hero and panel are always within reach.
 */
export default function DockCta({ createHref, joinHref }: { createHref: string; joinHref: string }) {
  const [heroGone, setHeroGone] = useState(false);
  const [startIn, setStartIn] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero-actions');
    const start = document.getElementById('start-league');
    if (!hero || !start || !('IntersectionObserver' in window)) return;
    const heroObs = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting));
    const startObs = new IntersectionObserver(([e]) => setStartIn(e.isIntersecting));
    heroObs.observe(hero);
    startObs.observe(start);
    return () => {
      heroObs.disconnect();
      startObs.disconnect();
    };
  }, []);

  const on = heroGone && !startIn;
  return (
    <div className={`${styles.dock} ${on ? styles.dockOn : ''}`} aria-hidden={!on} inert={!on}>
      <Link href={createHref} className={`${styles.btn} ${styles.dockCreate}`}>Create a League</Link>
      <Link href={joinHref} className={styles.dockJoin}>Join</Link>
    </div>
  );
}
