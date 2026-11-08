'use client';

import { useState } from 'react';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import Walkthrough from '@/components/walkthrough/Walkthrough';
import { AUCTION_TIMING_STEPS, stepsForFormat } from '@/lib/walkthroughs/chapters';
import type { GranularPosition } from '@/types';
import type { ShowcaseArrival } from '@/lib/publicHome/loadShowcase';
import styles from './BarcolaTransfer.module.css';

/** Where he came from isn't in the player record, and this is one pinned example. */
const FROM_CLUB = 'PSG';
const W = 240;
const H = 64;

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const money = (n: number) => `€${n}m`;

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : name;
}

function climbPath(hours: number[], amounts: number[]) {
  const end = hours[hours.length - 1] || 1;
  const low = amounts[0];
  const high = Math.max(...amounts);
  const x = (t: number) => 2 + (t / end) * (W - 4);
  const y = (a: number) => 4 + (1 - (a - low) / Math.max(1, high - low)) * (H - 8);
  return amounts.reduce((d, a, i) => d + (i === 0 ? `M${x(hours[i])} ${y(a)}` : `H${x(hours[i])}V${y(a)}`), '');
}

/** The real transfer, from the Premier League to a Gaffa auction, in four stops. */
export default function BarcolaTransfer({ arrival }: { arrival: ShowcaseArrival }) {
  const [timing, setTiming] = useState(false);
  const { player, bidAmounts, bidHours, winningBid, bids, clubs, openingBid } = arrival;
  return (
    <div className={styles.panel}>
      <div className={styles.stop}>
        <div className={styles.head}>Real Life</div>
        <div className={`${styles.body} ${styles.move}`}>
          <Portrait
            size="md"
            photoUrl={player.photoUrl}
            photoVersion={player.photoVersion}
            name={player.name}
            club={player.club}
            headTopPct={player.headTopPct}
            headWidthPct={player.headWidthPct}
          />
          <div className={styles.moveText}>
            <div className={styles.name}>{player.name}</div>
            <div className={styles.route}>
              <span>{FROM_CLUB}</span>
              <Arrow />
              <span>{player.club}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.stop}>
        <div className={styles.head}>In Gaffa</div>
        <div className={styles.body}>
          <div className={styles.lot}>
            {player.position && <PositionBadge position={player.position as GranularPosition} size="sm" />}
            <span className={styles.lotName}>{shortName(player.name)}</span>
            <span className={styles.tag}>Free Agent</span>
          </div>
          <div className={styles.caption}>Up for auction in every league</div>
        </div>
      </div>

      <div className={styles.stop}>
        <div className={styles.head}>Bidding</div>
        <div className={styles.body}>
          <svg className={styles.climb} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={climbPath(bidHours, bidAmounts)} />
          </svg>
          <div className={styles.ends}><span>{openingBid != null ? money(openingBid) : ''}</span><span>{money(winningBid)}</span></div>
          <div className={styles.caption}>{bids} bids from {clubs} clubs</div>
        </div>
      </div>

      <div className={styles.stop}>
        <div className={styles.head}>Signed</div>
        <div className={styles.body}>
          <div className={styles.fee}>{money(winningBid)}</div>
          <div className={styles.caption}>The highest bid signs him</div>
        </div>
      </div>

      <button type="button" className={styles.door} onClick={() => setTiming(true)}>
        <span>How Auctions Work</span>
        <Arrow />
      </button>

      {timing && <Walkthrough steps={stepsForFormat(AUCTION_TIMING_STEPS, 'dynasty')} onExit={() => setTiming(false)} />}
    </div>
  );
}
