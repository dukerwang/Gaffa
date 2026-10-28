'use client';

import { useState } from 'react';
import type { FinanceData } from '@/lib/finance/loadFinance';
import CrestBadge from '@/components/crest/CrestBadge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import NumberRoll from '@/components/ui/NumberRoll';
import MyClub from './MyClub';
import LeagueView from './LeagueView';
import { money } from './format';
import styles from './finance.module.css';

type View = 'club' | 'league';

/**
 * Finance. The green shelf answers "what can I spend?" before anything else:
 * Club Balance less the bids the club is winning, because bids aren't
 * reserved and the resolver skips a winner who can no longer pay.
 * Spec: docs/superpowers/specs/2026-10-27-finance-rework-design.md.
 */
export default function FinanceClient({ data }: { data: FinanceData }) {
  const [view, setView] = useState<View>('club');
  const { me, revenue } = data;
  const over = me.committed > me.balance;

  return (
    <div className={styles.page}>
      <section className={styles.shelf}>
        <div className={styles.shelfTop}>
          <CrestBadge config={me.crest} size={44} teamName={me.name} teamId={me.teamId} interactive={false} />
          <div className={styles.titles}>
            <h1 className={styles.title}>Finance</h1>
            <span className={styles.club}>{me.name}</span>
          </div>
          <div className={styles.shelfSwitch}>
            <SegmentedControl<View>
              variant="ink"
              ariaLabel="Finance view"
              value={view}
              onChange={setView}
              options={[
                { value: 'club', label: 'My Club' },
                { value: 'league', label: 'League' },
              ]}
            />
          </div>
        </div>

        <div className={styles.hero}>
          <div className={styles.spend}>
            <span className={styles.shelfKey}>Spendable</span>
            <span className={`${styles.spendFig} ${over ? styles.spendOver : ''}`}>
              <NumberRoll value={me.spendable} format={(n) => (n < 0 ? `−€${Math.abs(n)}m` : `€${n}m`)} />
            </span>
          </div>
          <dl className={styles.sum}>
            <div className={styles.term}>
              <dt>Club Balance</dt>
              <dd>{money(me.balance)}</dd>
            </div>
            <div className={styles.term} aria-hidden="true">
              <dd className={styles.op}>−</dd>
            </div>
            <div className={styles.term}>
              <dt>Leading Bids</dt>
              <dd>{money(me.committed)}</dd>
            </div>
            {revenue && revenue.earned > 0 && (
              <div className={`${styles.term} ${styles.termDue}`}>
                <dt>Due After GW{revenue.payAfterGw}</dt>
                <dd>+{money(Math.floor(revenue.earned))}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {view === 'club' ? <MyClub data={data} /> : <LeagueView data={data} />}
    </div>
  );
}
