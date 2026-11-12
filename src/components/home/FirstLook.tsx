'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { DiagramView } from '@/components/walkthrough/TimingDiagrams';
import { FIRST_LOOK } from '@/lib/walkthroughs/chapters';
import styles from './FirstLook.module.css';

interface Props {
  createHref: string;
  joinHref: string;
}

/**
 * The front page's tour, in the page itself rather than over it: pick a step
 * or page through them. The last stop is starting or joining a league.
 */
export default function FirstLook({ createHref, joinHref }: Props) {
  const [index, setIndex] = useState(0);
  const total = FIRST_LOOK.length + 1;
  const onLeague = index === FIRST_LOOK.length;
  const step = FIRST_LOOK[index];

  return (
    <div className={styles.panel}>
      <ol className={styles.steps} aria-label="First Look steps">
        {[...FIRST_LOOK.map((s) => s.title), 'Your League'].map((title, i) => (
          <li key={title}>
            <button
              type="button"
              className={styles.stepBtn}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => setIndex(i)}
            >
              <span className={styles.stepNo}>{i + 1}</span>
              <span className={styles.stepName}>{title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.stage} aria-live="polite">
        {onLeague ? (
          <div className={styles.slide} key="league">
            <h3 className={styles.title}>Your League</h3>
            <p className={styles.body}>Start a league and invite your friends, or join one with an invite code.</p>
            <div className={styles.actions}>
              <Link href={createHref} className={`${styles.btn} ${styles.primary}`}>Create a League</Link>
              <Link href={joinHref} className={`${styles.btn} ${styles.ghost}`}>Join with an Invite Code</Link>
            </div>
          </div>
        ) : (
          <div className={styles.slide} key={step.title}>
            <h3 className={styles.title}>{step.title}</h3>
            {step.diagram && <div className={styles.diagram}><DiagramView diagram={step.diagram} /></div>}
            <p className={styles.body}>{step.body}</p>
          </div>
        )}

        <div className={styles.foot}>
          <span className={styles.count}>{index + 1} of {total}</span>
          <button type="button" className={styles.arrow} aria-label="Previous" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <Icon name="chevron-left" size={18} strokeWidth={2} />
          </button>
          <button type="button" className={styles.arrow} aria-label="Next" disabled={onLeague} onClick={() => setIndex(index + 1)}>
            <Icon name="chevron-right" size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
