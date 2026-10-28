'use client';

import CrestBadge from '@/components/crest/CrestBadge';
import type { FinanceData } from '@/lib/finance/loadFinance';
import { money, signed } from './format';
import styles from './finance.module.css';

/**
 * Every club's buying power, most to spend first, and the league's money
 * supply: what the league has paid in this season against what signings,
 * severance and facilities have taken out.
 */
export default function LeagueView({ data }: { data: FinanceData }) {
  const { clubs, supply } = data;
  const max = Math.max(1, ...clubs.map((c) => Math.max(c.balance, 0)));
  const change = supply.now - supply.opening;

  return (
    <>
      <section className={`${styles.card} ${styles.leagueCard}`} aria-labelledby="fin-clubs">
        <header className={styles.cardHd}>
          <h2 id="fin-clubs" className={styles.cardTitle}>Club Balances</h2>
          <span className={styles.cardFig}>{clubs.length} <small>Clubs</small></span>
        </header>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thClub}>Club</th>
                <th>Spendable</th>
                <th>Club Balance</th>
                <th>Leading Bids</th>
                <th className={styles.wide}>Season In</th>
                <th className={styles.wide}>Season Out</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((c) => (
                <tr key={c.teamId} className={c.isMine ? styles.mine : undefined}>
                  <td className={styles.tdClub}>
                    <span className={styles.clubCell}>
                      <CrestBadge config={c.crest} size={28} teamName={c.name} teamId={c.teamId} interactive={false} />
                      <span className={styles.clubName}>{c.name}</span>
                    </span>
                    <span className={`g-track ${styles.clubTrack}`} aria-hidden="true">
                      <span style={{ width: `${(Math.max(c.spendable, 0) / max) * 100}%` }} className={styles.trackSpend} />
                      <span style={{ width: `${(Math.min(c.committed, Math.max(c.balance, 0)) / max) * 100}%` }} className={styles.trackBid} />
                    </span>
                  </td>
                  <td className={styles.figStrong}>{money(c.spendable)}</td>
                  <td>{money(c.balance)}</td>
                  <td className={c.committed ? styles.out : styles.quiet}>{c.committed ? money(c.committed) : '—'}</td>
                  <td className={`${styles.wide} ${styles.in}`}>{signed(c.totalIn)}</td>
                  <td className={`${styles.wide} ${styles.out}`}>{signed(-c.totalOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="fin-supply">
        <div className={styles.sectionHd}>
          <h2 id="fin-supply" className={styles.sectionTitle}>Money Supply</h2>
          <span className={styles.totals}>
            <span><small>Net</small> <b className={change >= 0 ? styles.in : styles.out}>{signed(change)}</b></span>
          </span>
        </div>
        <div className={styles.supply}>
          <div className={styles.supplyFig}>
            <small>Opening</small>
            <b>{money(supply.opening)}</b>
          </div>
          <div className={styles.supplyFig}>
            <small>Paid In by the League</small>
            <b className={styles.in}>{signed(supply.created)}</b>
            <span>Match Revenue, prizes, compensation, grants</span>
          </div>
          <div className={styles.supplyFig}>
            <small>Taken Out</small>
            <b className={styles.out}>{signed(-supply.destroyed)}</b>
            <span>Free-agent signings, severance, facilities, less Solidarity and Scout&rsquo;s Fees</span>
          </div>
          <div className={styles.supplyFig}>
            <small>In Circulation</small>
            <b>{money(supply.now)}</b>
          </div>
        </div>
      </section>
    </>
  );
}
