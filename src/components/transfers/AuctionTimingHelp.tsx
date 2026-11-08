'use client';

import { useState } from 'react';
import { Icon, IconButton } from '@/components/ui';
import Walkthrough from '@/components/walkthrough/Walkthrough';
import { AUCTION_TIMING_STEPS, stepsForFormat } from '@/lib/walkthroughs/chapters';
import styles from './AuctionTimingHelp.module.css';

/** One "?" per page, opening the auction timing steps of the walkthrough. */
export default function AuctionTimingHelp({ isDynasty = true }: { isDynasty?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        size="sm"
        label="Auction Timing"
        tooltip={false}
        aria-haspopup="dialog"
        className={styles.toggle}
        onClick={() => setOpen(true)}
        icon={<Icon name="help-circle" size={16} strokeWidth={2} />}
      />
      {open && <Walkthrough steps={stepsForFormat(AUCTION_TIMING_STEPS, isDynasty ? 'dynasty' : 'redraft')} onExit={() => setOpen(false)} />}
    </>
  );
}
