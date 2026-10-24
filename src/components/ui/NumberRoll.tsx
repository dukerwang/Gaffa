'use client';

import React from 'react';
import styles from './NumberRoll.module.css';

export interface NumberRollProps {
  value: number;
  /** Turns the number into the characters shown. Digits roll; everything else sits still. */
  format?: (value: number) => string;
  className?: string;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Gaffa UI Primitive: NumberRoll
 *
 * An odometer. Each digit is a strip of 0–9 that rolls to its new place when
 * the value changes, so a Club Balance going from €48m to €14m reads as money
 * leaving, not as one string swapped for another. It takes the font of its
 * parent: serif for a settled figure, mono for one that ticks.
 *
 * Columns are keyed from the right, so 99 → 100 grows a new column on the
 * left instead of every digit shifting one place. The first render never
 * animates; only changes do.
 */
export function NumberRoll({ value, format = (n) => n.toLocaleString('en-GB'), className }: NumberRollProps) {
  const text = format(value);
  const chars = Array.from(text);

  return (
    <span className={[styles.roll, className].filter(Boolean).join(' ')}>
      <span className="sr-only">{text}</span>
      <span className={styles.visual} aria-hidden="true">
        {chars.map((char, i) => {
          const fromRight = chars.length - 1 - i;
          const digit = DIGITS.indexOf(char);
          if (digit < 0) {
            return (
              <span key={`s${fromRight}-${char}`} className={styles.static}>
                {char}
              </span>
            );
          }
          return (
            <span key={`d${fromRight}`} className={styles.column}>
              <span
                className={styles.strip}
                style={
                  {
                    transform: `translateY(${-digit * 10}%)`,
                    // Lower places settle a beat later, like a mechanical counter.
                    transitionDelay: `${Math.min(fromRight, 4) * 24}ms`,
                  } as React.CSSProperties
                }
              >
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export default NumberRoll;
