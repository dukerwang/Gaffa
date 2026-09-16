'use client';

import type { CSSProperties } from 'react';
import NavigationLink from '@/components/ui/NavigationLink';
import CrestBadge from '@/components/crest/CrestBadge';
import PositionBadge from '@/components/players/PositionBadge';
import CutoutPortrait from '@/components/players/CutoutPortrait';
import { usePlayerCard, playerHoverProps } from '@/components/players/PlayerCardProvider';
import type { CrestConfig } from '@/components/crest/types';
import type { GranularPosition } from '@/types';
import type { HomeModel, MarketLot } from '@/lib/home/buildHomeModel';
import Countdown from './Countdown';
import styles from './home.module.css';

/**
 * In the market.
 *
 * A gameweek is roughly three days of football and four days of transfers,
 * and through the longer half this is the only region on the page with
 * anything left to decide. Two things changed when the page was recomposed:
 *
 *   A lot is a player, so it is shown as one. Every row carries the cut-out
 *   on a plinth mixed from his position colour, the same device the dashboard
 *   uses for Top Rated. A name and a position chip described a lot; a face
 *   makes it a signing.
 *
 *   Club Balance moved here. It used to sit in the masthead as the fourth of
 *   four read-only figures, which is the pattern Duke rejected on Transactions
 *   — "a number becomes something to press rather than only to read". Here it
 *   is the money you are bidding with, and it opens Finance.
 */
function Lot({ lot, model }: { lot: MarketLot; model: HomeModel }) {
  const { openPlayerById, prefetchPlayer } = usePlayerCard();
  const pos = lot.position ? lot.position.toLowerCase() : null;

  return (
    <div className={lot.leading ? styles.lotMine : lot.outbid ? styles.lotOutbid : styles.lot}>
      <button
        type="button"
        className={styles.lotFace}
        style={pos ? ({ '--pos': `var(--color-pos-${pos})` } as CSSProperties) : undefined}
        onClick={() => openPlayerById(lot.playerId)}
        {...playerHoverProps(prefetchPlayer, { id: lot.playerId, photo_url: lot.photoUrl })}
        aria-label={`Open ${lot.name}`}
      >
        <CutoutPortrait
          photoUrl={lot.photoUrl}
          photoVersion={lot.photoVersion}
          name={lot.name}
          className={styles.lotFaceImg}
          fallbackClassName={styles.lotFaceFallback}
        />
      </button>

      <div className={styles.lotId}>
        <span className={`g-namerow ${styles.lotName}`}>
          {lot.position && <PositionBadge position={lot.position as GranularPosition} size="sm" />}
          <span>{lot.name}</span>
        </span>
        <span className={styles.lotMeta}>{lot.meta}</span>
      </div>

      <div className={styles.lotBid}>
        <span className={styles.lotMobileK}>{lot.hasBids ? 'Standing Bid' : 'Floor'}</span>
        <span className={lot.hasBids ? styles.lotBidV : styles.lotBidNone}>{lot.bid}</span>
        <span className={styles.lotBidK}>{lot.floor}</span>
      </div>

      <div className={styles.lotWho}>
        <span className={styles.lotMobileK}>Leader</span>
        {lot.leaderTeamId ? (
          <span className={`g-namerow ${styles.lotWhoV}`}>
            <CrestBadge
              config={lot.leaderCrest as CrestConfig | null}
              teamName={lot.leaderName ?? ''}
              teamId={lot.leaderTeamId}
              size={17}
            />
            <span>{lot.leaderName}</span>
          </span>
        ) : (
          <span className={styles.lotWhoNone}>None yet</span>
        )}
        <span className={styles.lotBidK}>
          {lot.bidCount === 0 ? 'no bids yet' : `${lot.bidCount} bid${lot.bidCount === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className={styles.lotClock}>
        <span className={styles.lotMobileK}>Closes</span>
        <Countdown to={lot.expiresAt} serverNow={model.serverNow} />
      </div>

      <NavigationLink
        href={lot.href}
        className={lot.outbid ? styles.btnPrimary : lot.leading ? styles.btnMuted : styles.btn}
      >
        {lot.isMine
          ? 'Your Lot'
          : lot.outbid
            ? `Raise ${lot.nextBid}`
            : lot.leading
              ? 'Leading'
              : `Bid ${lot.nextBid}`}
      </NavigationLink>
    </div>
  );
}

export default function Market({ model }: { model: HomeModel }) {
  if (model.phase === 'closed') return null;
  const ordinalRank = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
  };

  return (
    <section className={styles.section} aria-labelledby="market">
      <div className={styles.head}>
        <h2 id="market" className={styles.headT}>
          In the Market
        </h2>

        {/* The instrument: the money you bid with, and what it ranks. */}
        <NavigationLink href={`/league/${model.leagueId}/finance`} className={styles.purse}>
          <span className={styles.purseV}>{model.money.balance}</span>
          <span className={styles.purseK}>
            Club Balance &middot; {ordinalRank(model.money.balanceRank)}-richest
          </span>
        </NavigationLink>

        <span className={styles.headSub}>{model.marketSummary}</span>

        <NavigationLink href={`/league/${model.leagueId}/transfers`} className={styles.headLink}>
          Transfers &rarr;
        </NavigationLink>
      </div>

      {model.market.length === 0 ? (
        <div className={styles.lotsEmpty}>
          Nothing is on the board. Open an auction to earn a 10% Scout&rsquo;s Fee if another
          manager wins it.
        </div>
      ) : (
        <div className={styles.lots}>
          {model.market.map((lot) => (
            <Lot key={lot.playerId} lot={lot} model={model} />
          ))}
        </div>
      )}
    </section>
  );
}
