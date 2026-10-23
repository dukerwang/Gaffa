'use client';

import { useState, type ReactNode } from 'react';
import { MoneyStepper, NumberRoll, toast } from '@/components/ui';
import PositionBadge from '@/components/players/PositionBadge';
import bid from '@/components/transfers/BidDialog.module.css';
import styles from './kit.module.css';

/* Prototype only. The bid sheet drawn phone-first with the dialog's own CSS
   module: today's typed field beside two stepper versions. Saka is a fixed
   example; the selling club is invented, because this page is public. */

const LOT = {
  name: 'Bukayo Saka',
  pos: 'RW',
  club: 'Arsenal',
  value: 120,
  seller: 'Highbury Rovers',
  standing: 84,
  floor: 85,
  clause: 140,
  closes: '1d 04h',
  budget: 160,
};

const money = (n: number) => `€${n}m`;

type Variant = 'today' | 'stepper' | 'pressable';

function Sheet({ variant }: { variant: Variant }) {
  const [amount, setAmount] = useState<number>(LOT.floor);
  const valid = !Number.isNaN(amount);
  const belowFloor = !valid || amount < LOT.floor;
  const tooExpensive = valid && amount > LOT.budget;
  const takesClause = valid && amount >= LOT.clause;
  const pressable = variant === 'pressable';

  const place = () =>
    toast.success(takesClause ? 'Release clause triggered' : 'Bid placed', {
      description: `${LOT.name} · ${money(amount)} · Prototype: nothing was sent.`,
    });

  /** A ladder figure that sets the bid when pressed (option B). */
  const rung = (label: string, value: number, tone?: string) => {
    const on = pressable && amount === value;
    const figure = <div className={`${bid.rungValue} ${tone ?? ''}`}>{money(value)}</div>;
    if (!pressable) {
      return (
        <div className={bid.rung}>
          <div className={bid.rungLabel}>{label}</div>
          {figure}
        </div>
      );
    }
    return (
      <button
        type="button"
        className={`${bid.rung} ${styles.rungPress} ${on ? styles.rungOn : ''}`}
        aria-pressed={on}
        aria-label={`Bid the ${label.toLowerCase()}, ${money(value)}`}
        onClick={() => setAmount(value)}
      >
        <div className={bid.rungLabel}>{label}</div>
        {figure}
      </button>
    );
  };

  let field: ReactNode;
  if (variant === 'today') {
    field = (
      <label className={bid.field}>
        <span className={bid.fieldLabel}>Your bid</span>
        <div className={bid.amountRow}>
          <span className={bid.currency}>€</span>
          <input
            className={bid.amount}
            type="number"
            min={LOT.floor}
            step={1}
            value={valid ? amount : ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setAmount(Number.isNaN(n) ? NaN : n);
            }}
          />
          <span className={bid.suffix}>m</span>
        </div>
        <div className={bid.hint}>
          Minimum {money(LOT.floor)} · Club Balance {money(LOT.budget)}
        </div>
      </label>
    );
  } else {
    field = (
      <div className={`${bid.field} ${styles.stepperField}`}>
        <MoneyStepper
          fullWidth
          label="Your Bid"
          value={valid ? amount : LOT.floor}
          onChange={setAmount}
          min={LOT.floor}
          max={LOT.budget}
          hint={`Minimum ${money(LOT.floor)} · Club Balance ${money(LOT.budget)}`}
        />
      </div>
    );
  }

  return (
    <div className={styles.sheetFrame}>
      <span className={styles.sheetGrab} aria-hidden="true" />
      <header className={styles.sheetHead}>
        <h4 className={styles.sheetTitle}>Raise your bid</h4>
        <span className={styles.sheetClose} aria-hidden="true">✕</span>
      </header>

      <div className={styles.sheetBody}>
        <div className={bid.identity}>
          <PositionBadge position={LOT.pos} size="sm" />
          <span className={bid.name}>{LOT.name}</span>
          <span className={bid.meta}>
            {LOT.club} · {money(LOT.value)} · {LOT.seller}
          </span>
        </div>

        <div className={`${bid.ladder} ${styles.ladderPhone}`}>
          <div className={bid.rung}>
            <div className={bid.rungLabel}>Standing bid</div>
            <div className={`${bid.rungValue} ${bid.rungLive} ${bid.warn}`}>{money(LOT.standing)}</div>
          </div>
          {rung('Minimum', LOT.floor)}
          {rung('Clause', LOT.clause, bid.gold)}
          <div className={bid.rung}>
            <div className={bid.rungLabel}>Closes</div>
            <div className={`${bid.rungValue} ${bid.rungLive}`}>{LOT.closes}</div>
          </div>
        </div>

        {field}

        {belowFloor && <p className={bid.error}>The minimum bid is {money(LOT.floor)}.</p>}
        {tooExpensive && <p className={bid.error}>Exceeds your {money(LOT.budget)} balance.</p>}
      </div>

      <footer className={variant === 'today' ? styles.sheetFoot : `${styles.sheetFoot} ${styles.sheetFootPhone}`}>
        <span className={bid.summary}>
          {takesClause ? (
            <>Pay <b>{money(amount)}</b> to sign him immediately and close the auction.</>
          ) : (
            <>Leaves you <b>{money(Math.max(0, LOT.budget - (valid ? amount : 0)))}</b> for the rest of the window.</>
          )}
        </span>
        <button type="button" className={bid.ghost}>Cancel</button>
        <button type="button" className={bid.go} disabled={belowFloor || tooExpensive} onClick={place}>
          {variant === 'today' ? (
            takesClause ? `Pay ${money(amount)}` : `Bid ${money(amount)}`
          ) : (
            <>
              {takesClause ? 'Pay ' : 'Bid '}
              <NumberRoll value={valid ? amount : LOT.floor} format={money} />
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

export function StepperPrototypes() {
  return (
    <div className={`${styles.protos} ${styles.protosWide}`}>
      <h2 className={styles.protoGroupTitle}>Bid Amount</h2>
      <p className={styles.protoIntro}>
        The bid sheet as a phone shows it, with today&apos;s typed field and two stepper versions. Tap − or + to move
        €1m, hold to run, tap the figure to type. B also makes Minimum and Clause pressable: one tap sets the bid.
      </p>

      <div className={styles.phoneRow}>
        {(
          [
            ['today', 'Today', undefined],
            ['stepper', 'A · Stepper', undefined],
            ['pressable', 'B · Stepper and Pressable Ladder', 'recommended'],
          ] as const
        ).map(([variant, label, note]) => (
          <div key={variant} className={styles.phoneCol}>
            <div className={styles.compareLabel}>
              {label}
              {note && <span className={styles.compareNote}>{note}</span>}
            </div>
            <Sheet variant={variant} />
          </div>
        ))}
      </div>

      <p className={styles.caseFoot}>
        The same stepper would take the listing editor&apos;s three prices (asking, minimum, release clause) and the
        offer builder&apos;s cash line, in a later port.
      </p>
    </div>
  );
}
