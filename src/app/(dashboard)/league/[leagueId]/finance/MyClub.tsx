'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavigationLink from '@/components/ui/NavigationLink';
import Portrait from '@/components/players/Portrait';
import { usePlayerCard } from '@/components/players/PlayerCardProvider';
import FacilityPurchaseSheet from '@/components/facilities/FacilityPurchaseSheet';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import type { FacilityView } from '@/lib/facilities/facilities';
import type { FinanceData } from '@/lib/finance/loadFinance';
import type { LedgerPlayer } from '@/lib/finance/ledger';
import BalanceChart from './BalanceChart';
import Ledger from './Ledger';
import { clock, money, ordinal, shortDate, signed } from './format';
import styles from './finance.module.css';

/** Ticks once a second while there is a clock on screen; idle otherwise. */
function useNow(active: boolean, start: string): number {
  const [now, setNow] = useState(() => new Date(start).getTime());
  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- replace the server's clock with the browser's on mount
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function PlayerButton({ player, children, className }: { player: LedgerPlayer | null; children: React.ReactNode; className?: string }) {
  const { openPlayerById } = usePlayerCard();
  if (!player) return <span className={className}>{children}</span>;
  return (
    <button type="button" className={`${styles.playerBtn} ${className ?? ''}`} onClick={() => openPlayerById(player.id)}>
      {children}
    </button>
  );
}

function Face({ player }: { player: LedgerPlayer | null }) {
  if (!player) return <span className={styles.faceBlank} aria-hidden="true" />;
  return (
    <Portrait
      photoUrl={player.photo_url}
      photoVersion={player.photo_version}
      name={player.name}
      club={player.pl_team}
      size="xxs"
      headTopPct={player.portrait_head_top_pct}
      headWidthPct={player.portrait_head_width_pct}
    />
  );
}

export default function MyClub({ data }: { data: FinanceData }) {
  const router = useRouter();
  const base = `/league/${data.leagueId}`;
  const now = useNow(data.bids.length + data.listings.length > 0, data.serverNow);
  const [buying, setBuying] = useState<FacilityView | null>(null);

  const { me, bids, revenue, prize, listings, departures, facilities, ledger } = data;
  const over = me.committed - me.balance;
  const winning = bids.filter((b) => b.winning);

  const due = useMemo(() => {
    let n = 0;
    if (revenue) n++;
    if (prize) n++;
    return n + listings.length + departures.length;
  }, [revenue, prize, listings, departures]);

  return (
    <>
      <div className={styles.cards}>
        {/* ── Live Bids ── */}
        <section className={`${styles.card} ${over > 0 ? styles.cardWarn : ''}`} aria-labelledby="fin-bids">
          <header className={styles.cardHd}>
            <h2 id="fin-bids" className={styles.cardTitle}>Live Bids</h2>
            <span className={styles.cardFig}>
              {winning.length > 0 ? <>{money(me.committed)} <small>Winning</small></> : <small>{bids.length ? 'None Winning' : 'None'}</small>}
            </span>
          </header>
          {over > 0 && (
            <p className={styles.warn} role="status">
              Your winning bids are {money(over)} more than your Club Balance. If they all win, the next bidder takes any player you can&rsquo;t pay for when his auction settles.
            </p>
          )}
          {bids.length === 0 ? (
            <div className={styles.cardEmpty}>
              <p>No live bids. The whole balance is yours to spend.</p>
              <NavigationLink href={`${base}/transfers/free-agents`} className={styles.cardLink}>Browse Free Agents</NavigationLink>
            </div>
          ) : (
            <ul className={styles.rows}>
              {bids.map((b) => (
                <li key={b.playerId} className={styles.row}>
                  <PlayerButton player={b.player} className={styles.rowWho}>
                    <Face player={b.player} />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{b.player ? getPlayerDisplayName(b.player, 'initial_last') : 'Player'}</span>
                      <span className={styles.rowMeta}>
                        <span className={b.winning ? styles.tagWin : styles.tagLose}>{b.winning ? 'Winning' : 'Outbid'}</span>
                        {!b.winning && <> · your bid {money(b.myBid)}</>}
                      </span>
                    </span>
                  </PlayerButton>
                  <span className={styles.rowEnd}>
                    <span className={`${styles.rowFig} ${b.winning ? '' : styles.rowFigQuiet}`}>{money(b.topBid)}</span>
                    <span className={styles.clock}>{clock(b.expiresAt, now)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {bids.length > 0 && (
            <NavigationLink href={`${base}/transfers/auctions`} className={styles.cardFoot}>Open Auctions</NavigationLink>
          )}
        </section>

        {/* ── Money Due ── */}
        <section className={styles.card} aria-labelledby="fin-due">
          <header className={styles.cardHd}>
            <h2 id="fin-due" className={styles.cardTitle}>Money Due</h2>
            {revenue && <span className={styles.cardFig}><small>Next Payout</small> GW{revenue.payAfterGw}</span>}
          </header>
          {due === 0 ? (
            <div className={styles.cardEmpty}><p>Nothing due this season.</p></div>
          ) : (
            <ul className={styles.rows}>
              {revenue && (
                <li className={styles.row}>
                  <span className={styles.rowWho}>
                    <span className={styles.pips} aria-label={`Match Revenue, GW${revenue.pips[0].gameweek} to GW${revenue.payAfterGw}`}>
                      {revenue.pips.map((p) => (
                        <span key={p.gameweek} className={`${styles.pip} ${p.result ? styles[`pip${p.result}`] : ''}`} title={`GW${p.gameweek}`}>
                          {p.result ?? ''}
                        </span>
                      ))}
                    </span>
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>Match Revenue</span>
                      <span className={styles.rowMeta}>
                        GW{revenue.pips[0].gameweek}–{revenue.payAfterGw}
                        {revenue.upside > 0 && <> · up to {signed(revenue.upside)} more</>}
                      </span>
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <span className={`${styles.rowFig} ${styles.in}`}>{signed(revenue.earned)}</span>
                    <span className={styles.rowSub}>so far</span>
                  </span>
                </li>
              )}
              {listings.map((l, i) => (
                <li key={l.player?.id ?? i} className={styles.row}>
                  <PlayerButton player={l.player} className={styles.rowWho}>
                    <Face player={l.player} />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{l.player ? getPlayerDisplayName(l.player, 'initial_last') : 'Listed player'}</span>
                      <span className={styles.rowMeta}>Top bid on your listing · {l.bidCount} {l.bidCount === 1 ? 'bid' : 'bids'}</span>
                    </span>
                  </PlayerButton>
                  <span className={styles.rowEnd}>
                    <span className={`${styles.rowFig} ${styles.in}`}>{signed(l.topBid)}</span>
                    <span className={styles.clock}>{clock(l.expiresAt, now)}</span>
                  </span>
                </li>
              ))}
              {departures.map((d) => (
                <li key={d.id} className={styles.row}>
                  <PlayerButton player={d.player} className={styles.rowWho}>
                    <Face player={d.player} />
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>{d.player ? getPlayerDisplayName(d.player, 'initial_last') : 'Departed player'}</span>
                      <span className={styles.rowMeta}>
                        Compensation if released{d.decideBy && <> · decide by {shortDate(d.decideBy)}</>}
                      </span>
                    </span>
                  </PlayerButton>
                  <span className={styles.rowEnd}>
                    <span className={`${styles.rowFig} ${styles.in}`}>{signed(d.amount)}</span>
                    <NavigationLink href={`${base}/team/roster`} className={styles.rowLink}>Decide</NavigationLink>
                  </span>
                </li>
              ))}
              {prize && (
                <li className={styles.row}>
                  <span className={styles.rowWho}>
                    <span className={styles.place} aria-hidden="true">{ordinal(prize.rank)}</span>
                    <span className={styles.rowText}>
                      <span className={styles.rowName}>Season Prize</span>
                      <span className={styles.rowMeta}>{ordinal(prize.rank)} of {prize.clubs} today · paid at season end</span>
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <span className={`${styles.rowFig} ${styles.in}`}>{signed(prize.amount)}</span>
                    <span className={styles.rowSub}>projected</span>
                  </span>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* ── Club Facilities ── */}
      {facilities && (
        <section className={styles.section} aria-labelledby="fin-fac">
          <div className={styles.sectionHd}>
            <h2 id="fin-fac" className={styles.sectionTitle}>Club Facilities</h2>
            <span className={styles.totals}>
              <span><small>Spendable</small> <b>{money(me.spendable)}</b></span>
            </span>
          </div>
          <div className={styles.facilities}>
            {facilities.map((f) => {
              const short = f.next ? f.next.price - me.spendable : 0;
              return (
                <div key={f.key} className={styles.facility}>
                  <div className={styles.facTop}>
                    <span className={styles.facName}>{f.name}</span>
                    <span className={styles.facSlots}>
                      {Array.from({ length: f.slots }, (_, i) => (
                        <i key={i} className={i < f.used ? styles.slotUsed : styles.slotFree} />
                      ))}
                      {f.next && Array.from({ length: f.next.slots - f.slots }, (_, i) => <i key={`n${i}`} className={styles.slotNext} />)}
                    </span>
                  </div>
                  <span className={styles.facMeta}>{f.used} of {f.slots} in use</span>
                  {!f.next ? (
                    <span className={styles.facDone}>Fully Built</span>
                  ) : short > 0 ? (
                    <span className={styles.facShort}>
                      <b>{money(f.next.price)}</b> · {money(short)} short
                    </span>
                  ) : (
                    <button type="button" className={styles.facBuy} onClick={() => setBuying(f)}>
                      Expand to {f.next.slots} · {money(f.next.price)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <FacilityPurchaseSheet
            leagueId={data.leagueId}
            facility={buying}
            balance={me.balance}
            onClose={() => setBuying(null)}
            onPurchased={() => router.refresh()}
          />
        </section>
      )}

      {/* ── Season ── */}
      <section className={styles.section} aria-labelledby="fin-season">
        <div className={styles.sectionHd}>
          <h2 id="fin-season" className={styles.sectionTitle}>Season</h2>
          <span className={styles.totals}>
            <span><small>In</small> <b className={styles.in}>{signed(ledger.totalIn)}</b></span>
            <span><small>Out</small> <b className={styles.out}>{signed(-ledger.totalOut)}</b></span>
            <span><small>Net</small> <b>{signed(ledger.totalIn - ledger.totalOut)}</b></span>
          </span>
        </div>
        <div className={styles.season}>
          <BalanceChart ledger={ledger} now={data.serverNow} balance={me.balance} />
          <Breakdown ledger={ledger} />
        </div>
      </section>

      <Ledger ledger={ledger} />
    </>
  );
}

function Breakdown({ ledger }: { ledger: FinanceData['ledger'] }) {
  const income = ledger.byCategory.filter((c) => c.in > 0).sort((a, b) => b.in - a.in);
  const spend = ledger.byCategory.filter((c) => c.out > 0).sort((a, b) => b.out - a.out);
  const max = Math.max(1, ...income.map((c) => c.in), ...spend.map((c) => c.out));
  const col = (title: string, rows: typeof income, key: 'in' | 'out') => (
    <div className={styles.bdCol}>
      <h3 className={styles.bdTitle}>{title}</h3>
      {rows.length === 0 ? (
        <p className={styles.bdNone}>None yet</p>
      ) : (
        rows.map((c) => (
          <div key={c.category} className={styles.bdRow}>
            <span className={styles.bdLabel}>{c.category}</span>
            <span className={styles.bdFig}>{money(c[key])}</span>
            <span className={`g-track ${styles.bdTrack}`}>
              <span className={key === 'in' ? styles.bdIn : styles.bdOut} style={{ width: `${Math.max(2, (c[key] / max) * 100)}%` }} />
            </span>
          </div>
        ))
      )}
    </div>
  );
  return (
    <div className={styles.breakdown}>
      {col('Income', income, 'in')}
      {col('Spending', spend, 'out')}
    </div>
  );
}
