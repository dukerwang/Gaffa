'use client';

import styles from './BidRange.module.css';

interface Props {
  /** In €m. */
  value: number;
  onChange: (value: number) => void;
  /** The lowest bid the lot takes. */
  min: number;
  /** The Club Balance: the most this club can bid. */
  max: number;
  /** The release clause, if the lot has one. */
  clause: number | null;
  disabled?: boolean;
}

const money = (n: number) => `€${n}m`;

/** The native thumb travels this far in from each end of the track. */
const THUMB = 28;

/**
 * The bid as a place on a range, from the minimum to the Club Balance, with
 * the release clause marked where the thumb would land on it. Drag for a big
 * move; the stepper above takes single millions. Tapping the clause's button
 * sets the bid to it.
 *
 * A clause the club can't reach has no place on the range, so it is said in a
 * line under it instead of disappearing from the dialog.
 */
export default function BidRange({ value, onChange, min, max, clause, disabled = false }: Props) {
  if (max <= min) return null;

  const frac = (n: number) => Math.min(Math.max((n - min) / (max - min), 0), 1);
  const clauseOnRange = clause != null && clause >= min && clause <= max;
  const at = (n: number) => ({
    left: `${frac(n) * 100}%`,
    marginLeft: `${THUMB / 2 - THUMB * frac(n)}px`,
  });

  return (
    <div className={styles.range}>
      <div className={`${styles.track} ${clauseOnRange ? styles.trackWithMark : ''}`}>
        {clauseOnRange && (
          <>
            <button
              type="button"
              className={styles.mark}
              style={at(clause)}
              aria-pressed={value === clause}
              disabled={disabled}
              onClick={() => onChange(clause)}
            >
              Clause {money(clause)}
            </button>
            <span className={styles.tick} style={at(clause)} aria-hidden="true" />
          </>
        )}
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={1}
          value={Math.min(Math.max(value, min), max)}
          disabled={disabled}
          aria-label="Bid"
          aria-valuetext={money(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ ['--fill' as string]: `${frac(value) * 100}%` }}
        />
      </div>
      <div className={styles.ends}>
        <span>Minimum {money(min)}</span>
        <span>Club Balance {money(max)}</span>
      </div>
      {clause != null && !clauseOnRange && (
        <p className={styles.clauseOff}>
          Release clause {money(clause)}
          {clause > max ? ', above your Club Balance.' : '.'}
        </p>
      )}
    </div>
  );
}
