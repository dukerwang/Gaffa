'use client';

import { useState } from 'react';
import { Icon, IconButton, Popover } from '@/components/ui';
import styles from './AuctionTimingHelp.module.css';

/**
 * One "?" per page explaining auction timing, not one per card.
 *
 * A Popover opened by a press, not a hover tooltip: the old tip opened only on
 * hover or keyboard focus, and iPhone Safari never focuses a tapped button, so
 * on a phone it never opened at all.
 */
export default function AuctionTimingHelp() {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <IconButton
        ref={setAnchor}
        size="sm"
        label="Auction Timing"
        tooltip={false}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={styles.toggle}
        onClick={() => setOpen((o) => !o)}
        icon={<Icon name="help-circle" size={16} strokeWidth={2} />}
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        placement="bottom-start"
        aria-label="Auction timing"
        className={styles.tip}
      >
        <p>Bigger fees get longer minimums.</p>
        <p>Each bid extends the clock.</p>
        <p>Nothing closes overnight.</p>
      </Popover>
    </>
  );
}
