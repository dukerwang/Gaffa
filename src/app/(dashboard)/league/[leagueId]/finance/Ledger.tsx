'use client';

import { useMemo, useState } from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import EmptyState from '@/components/ui/EmptyState';
import Portrait from '@/components/players/Portrait';
import { usePlayerCard } from '@/components/players/PlayerCardProvider';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import type { Category, Ledger as LedgerData, LedgerEntry } from '@/lib/finance/ledger';
import { money, monthKey, signed } from './format';
import styles from './finance.module.css';

type Filter = 'all' | 'out' | 'in';

/** Rows shown before Show All; a season's ledger is usually under this. */
const FIRST = 24;

/** A two-letter mark for rows with no player, so every row has something in the face column. */
const GLYPH: Record<Category, string> = {
  Signings: 'Si',
  Severance: 'Sv',
  Trades: 'Tr',
  Sales: 'Sa',
  Departures: 'Dp',
  'Match Revenue': 'MR',
  Prizes: 'Pr',
  "Scout's Fees": 'SF',
  Solidarity: 'So',
  Loans: 'Lo',
  Facilities: 'Fa',
  Grants: 'Gr',
};

export default function Ledger({ ledger }: { ledger: LedgerData }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [all, setAll] = useState(false);
  const { openPlayerById } = usePlayerCard();

  const rows = useMemo(() => {
    const newest = [...ledger.entries].reverse();
    return filter === 'all' ? newest : newest.filter((e) => e.direction === filter);
  }, [ledger.entries, filter]);
  const shown = all ? rows : rows.slice(0, FIRST);

  const months = useMemo(() => {
    const out: { key: string; net: number; rows: LedgerEntry[] }[] = [];
    for (const e of shown) {
      const key = monthKey(e.at);
      let m = out[out.length - 1];
      if (!m || m.key !== key) {
        m = { key, net: 0, rows: [] };
        out.push(m);
      }
      m.rows.push(e);
      m.net += e.direction === 'in' ? e.amount : -e.amount;
    }
    return out;
  }, [shown]);

  return (
    <section className={styles.section} aria-labelledby="fin-ledger">
      <div className={styles.sectionHd}>
        <h2 id="fin-ledger" className={styles.sectionTitle}>Ledger</h2>
        <SegmentedControl<Filter>
          variant="ink"
          size="sm"
          ariaLabel="Ledger filter"
          value={filter}
          onChange={(f) => { setFilter(f); setAll(false); }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'out', label: 'Spending' },
            { value: 'in', label: 'Earnings' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState size="compact">No money has moved yet.</EmptyState>
      ) : (
        <div className={`g-panel ${styles.ledger}`}>
          <div className={styles.ledgerCols} aria-hidden="true">
            <span>Date</span>
            <span />
            <span>Item</span>
            <span className={styles.num}>Amount</span>
            <span className={styles.num}>Balance</span>
          </div>
          {months.map((m) => (
            <div key={m.key} role="rowgroup">
              <div className={styles.month}>
                <span>{m.key}</span>
                {filter === 'all' && <span className={m.net >= 0 ? styles.in : styles.out}>{signed(m.net)}</span>}
              </div>
              {m.rows.map((e) => {
                const name = e.player ? getPlayerDisplayName(e.player, 'initial_last') : null;
                return (
                  <div key={e.id} className={styles.entry}>
                    <span className={styles.entryDay}>
                      <b>{new Date(e.at).getDate()}</b>
                      <small>{new Date(e.at).toLocaleDateString('en-GB', { month: 'short' })}</small>
                    </span>
                    {e.player ? (
                      <button type="button" className={styles.entryFace} onClick={() => openPlayerById(e.player!.id)} aria-label={`Open ${e.player.name}`}>
                        <Portrait
                          photoUrl={e.player.photo_url}
                          photoVersion={e.player.photo_version}
                          name={e.player.name}
                          club={e.player.pl_team}
                          size="xxs"
                          headTopPct={e.player.portrait_head_top_pct}
                          headWidthPct={e.player.portrait_head_width_pct}
                        />
                      </button>
                    ) : (
                      <span className={`${styles.glyph} ${e.direction === 'in' ? styles.glyphIn : styles.glyphOut}`} aria-hidden="true">
                        {GLYPH[e.category]}
                      </span>
                    )}
                    <span className={styles.entryText}>
                      <span className={styles.entryLabel}>{name ?? e.label}</span>
                      <span className={styles.entryMeta}>{name ? e.label : e.detail ?? e.category}</span>
                    </span>
                    <span className={`${styles.entryAmt} ${e.direction === 'in' ? styles.in : styles.out}`}>
                      {signed(e.direction === 'in' ? e.amount : -e.amount)}
                    </span>
                    <span className={styles.entryBal}>{money(e.balanceAfter)}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div className={styles.opening}>
            {all || rows.length <= FIRST ? (
              filter === 'all' && (
                <>
                  <span>Opening Balance</span>
                  <span className={styles.entryBal}>{money(ledger.opening)}</span>
                </>
              )
            ) : (
              <button type="button" className={styles.more} onClick={() => setAll(true)}>
                Show All {rows.length}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
