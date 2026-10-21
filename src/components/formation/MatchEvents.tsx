import { eventGlyphUrl, type EventKind } from '@/lib/lineups/matchEventGlyphs';
import styles from './MatchEvents.module.css';

/* eslint-disable @next/next/no-img-element -- tiny inline data-URL marks */

export interface MatchEventCounts {
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
}

const MARKS: { key: keyof MatchEventCounts; kind: EventKind; label: string }[] = [
  { key: 'goals', kind: 'goal', label: 'goal' },
  { key: 'assists', kind: 'assist', label: 'assist' },
  { key: 'ownGoals', kind: 'ownGoal', label: 'own goal' },
  { key: 'yellowCards', kind: 'yellow', label: 'yellow card' },
  { key: 'redCards', kind: 'red', label: 'red card' },
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
          <img src={eventGlyphUrl(m.kind)} alt="" width={18} height={18} />
          {events[m.key] > 1 && <span className={styles.count}>{events[m.key]}</span>}
        </span>
      ))}
    </span>
  );
}
