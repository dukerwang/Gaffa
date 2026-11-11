'use client';

import { usePathname } from 'next/navigation';
import { Icon, IconButton } from '@/components/ui';
import { CHAPTERS, leagueRoute } from '@/lib/walkthroughs/chapters';
import styles from '@/components/transfers/AuctionTimingHelp.module.css';

export const WALKTHROUGH_EVENT = 'gaffa:walkthrough';

/**
 * The question mark beside a page's title: replays that page's walkthrough.
 * It hides on pages that share a header but have no chapter, such as a rival's
 * club page.
 */
export default function WalkthroughButton({ chapter }: { chapter: string }) {
  const at = leagueRoute(usePathname());
  const target = CHAPTERS.find((c) => c.id === chapter);
  if (!at || !target || target.route !== at.route) return null;
  return (
    <IconButton
      size="sm"
      label="Page Walkthrough"
      tooltip={false}
      aria-haspopup="dialog"
      className={styles.toggle}
      onClick={() => window.dispatchEvent(new CustomEvent(WALKTHROUGH_EVENT, { detail: chapter }))}
      icon={<Icon name="help-circle" size={16} strokeWidth={2} />}
    />
  );
}
