'use client';

import type { TransfersTarget, TransfersListing, TransfersAuction } from '@/lib/transfers/buildTransfersModel';
import type { GranularPosition } from '@/types';
import PositionBadge from '@/components/players/PositionBadge';
import CrestBadge from '@/components/crest/CrestBadge';
import { targetStance } from '@/lib/transfers/targetStance';
import { targetRoleTitle, TARGET_ROLE_OPTIONS } from '@/lib/transfers/targetRole';
import { useTick, formatAuctionClock } from './useTick';
import styles from './TargetRow.module.css';

/**
 * One target on the board.
 *
 * Never add an action of its own here. Press any button on a row and you land
 * in machinery that already exists — the offer composer, the listing editor,
 * the bid dialog, chat — because you cannot transact a target, only a listing.
 * Let a manager accept a row outright and you have rebuilt
 * `roster_entries.on_trade_block`: a signal shaped like a mechanism.
 *
 * Do not work out here which actions to show. `canAnswer` arrives from
 * `canAnswerTarget`, the same call that picks the section, so a heading and
 * its buttons can never contradict each other.
 */

interface Props {
  target: TransfersTarget;
  isMine: boolean;
  /** True when I hold a player who answers this. Drives the actions AND the section. */
  canAnswer: boolean;
  /** The live listing answering one of MY targets, if the owner has posted one. */
  matchedListing?: TransfersListing | null;
  matchedAuction?: TransfersAuction | null;
  /** True when this target was sent to me directly rather than posted to the board. */
  sentToMe?: boolean;
  /** Club that currently rosters the named player, for the sub-line. */
  ownerName?: string | null;
  last?: boolean;

  onOpenPlayer?: () => void;
  onOffer?: () => void;
  onList?: () => void;
  onMessage?: () => void;
  onBid?: () => void;
  onEdit?: () => void;
  onWithdraw?: () => void;
}

const ROLE_HINT = new Map(TARGET_ROLE_OPTIONS.map((o) => [o.role, o.hint]));

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3 21 21" />
    <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.4 17.4 0 0 1-3.2 3.9M6.6 6.7A17.2 17.2 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.2-.9" />
  </svg>
);

export default function TargetRow({
  target,
  isMine,
  canAnswer,
  matchedListing = null,
  matchedAuction = null,
  sentToMe = false,
  ownerName = null,
  last = false,
  onOpenPlayer,
  onOffer,
  onList,
  onMessage,
  onBid,
  onEdit,
  onWithdraw,
}: Props) {
  const named = target.target_kind === 'player';
  const stance = targetStance(target);

  // When cash is the only thing on offer the stance headline already spells out
  // the budget ("Will pay cash · up to €62m"). Print that in the figure column
  // too and a manager reads the same number twice on one row, so strip it from
  // the chip and leave it in the column, where budgets line up for comparison.
  const gateLabel = stance.headline.split(' · ')[0];

  // Subscribed only when a matched listing is actually counting down. With no
  // clock on the row this still returns a server-corrected `now`, fixed for the
  // render — which is what the "days left" line below wants, and why that line
  // reads it rather than calling Date.now() mid-render.
  const matchLive = matchedAuction?.expires_at != null;
  const now = useTick(matchLive);
  const clock = matchLive
    ? formatAuctionClock(new Date(matchedAuction!.expires_at!).getTime() - now, true)
    : null;

  const position = (named ? target.player?.primary_position : target.position) as
    | GranularPosition
    | null
    | undefined;

  const title = named
    ? target.player?.web_name ?? target.player?.name ?? 'A player'
    : targetRoleTitle(target.role, target.position);

  // Sub-line. On a named target, whose he is and what he's worth; on a profile,
  // the level sought, which is all a role amounts to.
  const subParts: string[] = [];
  if (named) {
    if (ownerName) subParts.push(ownerName);
    const value = Number(target.player?.market_value);
    if (Number.isFinite(value) && value > 0) subParts.push(`€${Math.round(value)}m`);
  } else if (target.role) {
    const hint = ROLE_HINT.get(target.role);
    if (hint) subParts.push(hint);
  }
  if (sentToMe) subParts.push('sent to you only');
  if (isMine) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(target.expires_at).getTime() - now) / 86_400_000),
    );
    subParts.push(daysLeft === 1 ? '1 day left' : `${daysLeft} days left`);
  }

  const budget = target.budget != null && target.budget > 0 ? `€${target.budget}m` : null;
  const stackTerms = [gateLabel, budget].filter(Boolean).join(' · ');

  // ── Actions.
  //
  // Never on a board row: those are other clubs' statements about players I
  // don't hold, and the only honest response is to read them. Two fixed tracks
  // whatever the row offers, so secondaries line up under secondaries.
  const actions: { label: string; kind?: string; onClick?: () => void }[] = [];

  if (isMine) {
    // A live listing answering my own target is the one place a target row
    // carries a primary action — and it belongs to the listing, not the target.
    if (matchedListing && matchLive) {
      actions.push({ label: 'Edit', kind: styles.btnQuiet, onClick: onEdit });
      actions.push({ label: 'Bid', kind: styles.btnPrimary, onClick: onBid });
    } else {
      actions.push({ label: 'Withdraw', kind: styles.btnQuiet, onClick: onWithdraw });
      actions.push({ label: 'Edit', onClick: onEdit });
    }
  } else if (canAnswer) {
    if (named) {
      // He's mine and they've asked for him: open the composer, or put him on
      // the board so the whole league can bid rather than just this club.
      actions.push({ label: 'Offer', onClick: onOffer });
      actions.push({ label: 'List', kind: styles.btnPrimary, onClick: onList });
    } else {
      // A role: I have somebody who plays there, but which player is the
      // conversation, so talking first is a real option.
      actions.push({ label: 'Message', kind: styles.btnQuiet, onClick: onMessage });
      actions.push({ label: 'Offer', kind: styles.btnPrimary, onClick: onOffer });
    }
  }

  const rowState = matchedListing && matchLive
    ? styles.rowMatched
    : isMine
      ? styles.rowMine
      : '';

  // Audience. Show it instead of the club name on my own rows — otherwise I
  // read my own club ten times over. On anyone else's, show it only when the
  // answer is not "the league", so a public board carries no marks at all.
  const audience = isMine
    ? target.visibility === 'private'
      ? { text: 'You only', closed: true, off: true, title: 'Nobody else can see this target' }
      : target.visibility === 'direct'
        ? {
            text: ownerName ?? 'The owner',
            closed: true,
            off: false,
            title: `Only ${ownerName ?? 'the club that owns him'} can see this target`,
          }
        : { text: 'The league', closed: false, off: false, title: 'Every club in the league can see this target' }
    : sentToMe
      ? { text: 'Sent to you', closed: true, off: false, title: 'This target was sent to you alone' }
      : null;

  return (
    <div className={[styles.row, rowState, last ? styles.rowLast : ''].filter(Boolean).join(' ')}>
      {audience ? (
        <div
          className={`${styles.seen} ${audience.closed ? styles.seenClosed : ''}`}
          title={audience.title}
        >
          <span className={styles.seenIcon}>{audience.off ? <EyeOffIcon /> : <EyeIcon />}</span>
          <span className={styles.seenText}>{audience.text}</span>
        </div>
      ) : (
        <div className={styles.who}>
          <CrestBadge
            config={(target.team_crest ?? null) as never}
            size={26}
            teamName={target.team_name}
            teamId={target.team_id}
            interactive={false}
          />
          <span className={styles.clubName}>{target.team_name ?? 'A club'}</span>
        </div>
      )}

      <div className={styles.want}>
        {named && onOpenPlayer && target.player ? (
          <button type="button" className={`g-namerow ${styles.wantButton}`} onClick={onOpenPlayer}>
            <PositionBadge position={position} size="sm" />
            <span className={styles.wantName}>{title}</span>
          </button>
        ) : (
          <div className="g-namerow">
            <PositionBadge position={position} size="sm" />
            <span className={styles.wantName}>{title}</span>
          </div>
        )}

        {subParts.length > 0 && <div className={styles.wantSub}>{subParts.join(' · ')}</div>}
        {stackTerms && <div className={`${styles.wantSub} ${styles.stackOnly}`}>{stackTerms}</div>}
        {target.note && <div className={styles.note}>“{target.note}”</div>}

        {matchedListing && (
          <div className={styles.hit}>
            <span className={styles.hitTitle}>
              {ownerName ? `${ownerName} have listed him` : 'He has been listed'}
            </span>
            {matchedAuction && matchedAuction.highest_bid > 0 && (
              <span className={styles.hitBid}>€{matchedAuction.highest_bid}m</span>
            )}
            {clock && <span className={styles.hitClock}>{clock}</span>}
          </div>
        )}
      </div>

      <div className={styles.terms}>
        <span
          className={[
            styles.gate,
            stance.tone === 'cash' ? styles.gateCash : '',
            stance.tone === 'open' ? styles.gateOpen : '',
          ].filter(Boolean).join(' ')}
        >
          {gateLabel}
        </span>
      </div>

      <div className={`${styles.fig} ${budget ? '' : styles.figOff}`}>{budget ?? '—'}</div>

      <div className={styles.act}>
        {/* Pad to two cells so the tracks line up whatever a row can offer. */}
        {actions.length === 1 && <span />}
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`${styles.btn} ${a.kind ?? ''}`}
            onClick={a.onClick}
            disabled={!a.onClick}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
