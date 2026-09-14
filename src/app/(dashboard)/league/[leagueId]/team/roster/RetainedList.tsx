'use client';

import NavigationLink from '@/components/ui/NavigationLink';
import type { DepartureView, ClubProps } from './ClubClient';
import type { DecisionRequest } from '@/components/teams/DepartureDecisionModal';
import { PosBadge } from './SquadViews';
import { money, countdown } from './clubDerive';
import { getPlayerDisplayName, playerInitial } from '@/lib/players/displayName';
import styles from './club.module.css';

export default function RetainedList({
  leagueId, departures, viewerIsOwner, onDecision, teamId, serverNow,
}: {
  leagueId: string;
  /** Clock-skew anchor from the server; see `countdown` in clubDerive. */
  serverNow: string;
  departures: ClubProps['departures'];
  /** False on a rival's club: held rights are public (they're tradeable), the decisions on them are not. */
  viewerIsOwner: boolean;
  onDecision: (r: DecisionRequest) => void;
  teamId?: string;
}) {
  const { pending, held, slots, error } = departures;
  if (!error && pending.length === 0 && held.length === 0 && slots.total === 0) return null;
  // A rival with no held rights has nothing to say here — the empty state below
  // is written to the owner ("No retained players yet…") and slot usage alone
  // isn't worth a panel.
  if (!viewerIsOwner && held.length === 0) return null;

  // Loanees are held rights too, but they use no slot and come back on their
  // own, so they get their own group rather than sitting among the claims the
  // slot count above describes.
  const retained = held.filter((d) => d.status !== 'on_loan');
  const onLoan = held.filter((d) => d.status === 'on_loan');
  const groupCount = [pending, retained, onLoan].filter((g) => g.length > 0).length;

  return (
    <section className={`${styles.panel} ${styles.retained} g-panel`}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Retained List</h2>
        <span className="g-label">{slots.used} / {slots.total} slots</span>
      </div>

      {error && viewerIsOwner && (
        <div className={styles.retError}>
          Couldn’t load your retained rights right now — this list may be incomplete. Try refreshing.
        </div>
      )}

      {pending.length > 0 && (
        <div className={styles.retGroup}>
          <div className={styles.retGroupH}>Awaiting Your Decision</div>
          {pending.map((d) => <PendingRow key={d.id} d={d} onDecision={onDecision} serverNow={serverNow} />)}
        </div>
      )}

      {retained.length > 0 && (
        <div className={styles.retGroup}>
          {groupCount > 1 && <div className={styles.retGroupH}>Held Rights</div>}
          {retained.map((d) => (
            <HeldRow
              key={d.id}
              leagueId={leagueId}
              d={d}
              viewerIsOwner={viewerIsOwner}
              teamId={teamId}
              onDecision={onDecision}
            />
          ))}
        </div>
      )}

      {onLoan.length > 0 && (
        <div className={styles.retGroup}>
          <div className={styles.retGroupH}>On Loan Abroad</div>
          {onLoan.map((d) => (
            <HeldRow
              key={d.id}
              leagueId={leagueId}
              d={d}
              viewerIsOwner={viewerIsOwner}
              teamId={teamId}
              onDecision={onDecision}
            />
          ))}
        </div>
      )}

      {held.length === 0 && pending.length === 0 ? (
        <p className={styles.retEmpty}>
          No retained players yet. When one of your players leaves the Premier League you can keep his
          rights here instead of taking the cash — he reverts to you free if he ever returns.
        </p>
      ) : null}

      <div className={styles.retFoot}>
        {viewerIsOwner
          ? 'Rights never expire and can’t be cashed out — relinquish one to free its slot. They’re tradeable from the Transfer Market’s Deals page.'
          : 'Rights never expire and can’t be cashed out, but they can be traded — make an offer from the Deals page.'}
        {viewerIsOwner && onLoan.length > 0 &&
          ' Players on loan abroad don’t use a slot or a squad place, and rejoin your squad when they’re back in the Premier League.'}
      </div>
    </section>
  );
}

/**
 * A retained player has left the Premier League, so there is no cut-out to
 * show — this is the portrait's "absence shown, never faked" state by hand,
 * because <Portrait> is keyed on a photo code these rows do not have.
 *
 * It used to paint a position hue at 16% as the ground AND the same hue as the
 * initial on top of it: a tinted ground carrying its own tint's ink, which is
 * both the thing decision 4 forbids and, in dark, below AA. The position is
 * already on the badge in the row beneath.
 */
function Mono({ d }: { d: DepartureView }) {
  return (
    <div className={`${styles.mono} ${styles.monoSm}`}>
      {playerInitial({ name: d.name, web_name: d.webName })}
    </div>
  );
}

function PendingRow({ d, onDecision, serverNow }: { d: DepartureView; onDecision: (r: DecisionRequest) => void; serverNow: string }) {
  const when = countdown(serverNow, d.decideBy);
  return (
    <div className={styles.retRow}>
      <Mono d={d} />
      <div className={styles.retBody}>
        <div className={styles.retName}>{getPlayerDisplayName({ name: d.name, web_name: d.webName }, 'initial_last')}</div>
        <div className={`${styles.retMeta} g-namerow`}>
          <PosBadge pos={d.pos} />
          <span>ex-{d.lastClub} · left {fmtSeason(d.seasonFrom)}</span>
        </div>
      </div>
      <div className={styles.retFig}>
        <div className={styles.retFigV}>{when ? `${when} left` : 'Due now'}</div>
        <div className={styles.retFigK}>to decide</div>
      </div>
      <div className={styles.retActions}>
        <button type="button" className={`${styles.retBtn} ${styles.retBtnPrimary}`} onClick={() => onDecision({ mode: 'decide', dep: d })}>Decide</button>
      </div>
    </div>
  );
}

function HeldRow({
  leagueId, d, viewerIsOwner, teamId, onDecision,
}: {
  leagueId: string;
  d: DepartureView;
  viewerIsOwner: boolean;
  teamId?: string;
  onDecision: (r: DecisionRequest) => void;
}) {
  const returning = d.status === 'return_pending';
  const onLoan = d.status === 'on_loan';
  const meta = returning
    ? `Back with ${d.backClub ?? 'a PL club'}`
    : onLoan
      ? `${d.loanClub ? `At ${d.loanClub}` : 'On loan'} · from ${d.lastClub}`
      : `ex-${d.lastClub} · left ${fmtSeason(d.seasonFrom)}`;
  return (
    <div className={`${styles.retRow} ${returning ? styles.retReturning : ''}`}>
      <Mono d={d} />
      <div className={styles.retBody}>
        <div className={styles.retName}>{getPlayerDisplayName({ name: d.name, web_name: d.webName }, 'initial_last')}</div>
        <div className={`${styles.retMeta} g-namerow`}>
          <PosBadge pos={d.pos} />
          <span>{meta}</span>
        </div>
      </div>

      {returning ? (
        <>
          <span className={styles.retReturned}>Held</span>
          {viewerIsOwner && (
            <div className={styles.retActions}>
              <button type="button" className={`${styles.retBtn} ${styles.retBtnDanger}`} onClick={() => onDecision({ mode: 'returned', dep: d })}>Decline</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={styles.retFig}>
            <div className={styles.retFigV}>{money(d.marketValue)}</div>
            <div className={styles.retFigK}>{onLoan ? 'value when loaned' : 'value at departure'}</div>
          </div>
          <div className={styles.retActions}>
            {viewerIsOwner ? (
              <>
                <NavigationLink href={`/league/${leagueId}/transfers/deals?proposeRight=${d.id}`} className={styles.retBtn}>Trade</NavigationLink>
                <button type="button" className={`${styles.retBtn} ${styles.retBtnDanger}`} onClick={() => onDecision({ mode: 'relinquish', dep: d })}>{onLoan ? 'Drop' : 'Relinquish'}</button>
              </>
            ) : (
              <NavigationLink
                href={`/league/${leagueId}/transfers/deals?proposeTeam=${teamId ?? ''}`}
                className={styles.retBtn}
              >
                Offer
              </NavigationLink>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function fmtSeason(s: string): string {
  return (s ?? '').replace('-', '/');
}
