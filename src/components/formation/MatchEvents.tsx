import type { ReactNode } from 'react';
import styles from './MatchEvents.module.css';

export interface MatchEventCounts {
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
}

/** A football: the mark for a goal, and in red for an own goal. */
function Ball({ own }: { own?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={own ? styles.ballOwn : styles.ball} aria-hidden>
      <circle cx="8" cy="8" r="7" />
      <path d="M8 4.6 10.7 6.5 9.7 9.7H6.3L5.3 6.5Z" className={styles.ballPatch} />
    </svg>
  );
}

/** A boot, the mark for an assist. */
function Boot() {
  return (
    <svg viewBox="0 0 16 16" className={styles.boot} aria-hidden>
      <path d="M2 3h4.2v4.1c0 .7.4 1.1 1 1.4l5.3 2.3c.9.4 1.5 1.2 1.5 2.1V14H2Z" />
      <path d="M4.2 11.8h1.2M6.9 11.8h1.2M9.6 11.8h1.2" className={styles.studs} />
    </svg>
  );
}

function Card({ red }: { red?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={red ? styles.cardRed : styles.cardYellow} aria-hidden>
      <rect x="3.5" y="1.5" width="9" height="13" rx="1.5" />
    </svg>
  );
}

const MARKS: { key: keyof MatchEventCounts; label: string; mark: ReactNode }[] = [
  { key: 'goals', label: 'goal', mark: <Ball /> },
  { key: 'assists', label: 'assist', mark: <Boot /> },
  { key: 'ownGoals', label: 'own goal', mark: <Ball own /> },
  { key: 'yellowCards', label: 'yellow card', mark: <Card /> },
  { key: 'redCards', label: 'red card', mark: <Card red /> },
];

/** What a player did in a match, as the small marks FotMob and Sofascore hang on a portrait. */
export default function MatchEvents({ events }: { events: MatchEventCounts }) {
  const shown = MARKS.filter((m) => events[m.key] > 0);
  if (shown.length === 0) return null;
  const label = shown.map((m) => `${events[m.key]} ${m.label}${events[m.key] === 1 ? '' : 's'}`).join(', ');
  return (
    <span className={styles.events} role="img" aria-label={label}>
      {shown.map((m) => (
        <span key={m.key} className={styles.event}>
          {m.mark}
          {events[m.key] > 1 && <span className={styles.count}>{events[m.key]}</span>}
        </span>
      ))}
    </span>
  );
}
