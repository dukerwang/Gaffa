'use client';

import type { ClubProps, SquadEntry } from './ClubClient';
import { PosBadge } from './SquadViews';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import styles from './club.module.css';

/**
 * Players who arrived with no squad room and wait off the squad until the
 * manager activates or drops them (held players spec, 2026-09-13). Rows open
 * the Inspector, where the actions live, so there's one place to act on a
 * player however you reached him.
 */

const SOURCE: Record<NonNullable<SquadEntry['heldSource']>, string> = {
  loan_return: 'Back from loan',
  loan_abroad_return: 'Back from loan abroad',
  retained_return: 'Retained player back',
  auction: 'Won at auction',
};

export function formatLockTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HeldList({
  entries, hold, viewerIsOwner, onSelect,
}: {
  entries: SquadEntry[];
  hold: ClubProps['hold'];
  viewerIsOwner: boolean;
  onSelect: (id: string) => void;
}) {
  const held = entries.filter((e) => e.status === 'held');
  if (held.length === 0) return null;

  return (
    <section className={`${styles.panel} ${styles.retained} g-panel`}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Held Players</h2>
        <span className="g-label">{held.length} held</span>
      </div>

      <div className={styles.retGroup}>
        {held.map((e) => (
          <div key={e.id} className={styles.retRow}>
            <div className={styles.retBody}>
              <div className={styles.retName}>{getPlayerDisplayName(e.player, 'initial_last')}</div>
              <div className={`${styles.retMeta} g-namerow`}>
                <PosBadge pos={e.player.primary_position} />
                <span>{e.heldSource ? SOURCE[e.heldSource] : 'Held'}{e.player.pl_team ? ` · ${e.player.pl_team}` : ''}</span>
              </div>
            </div>
            {viewerIsOwner && (
              <div className={styles.retActions}>
                <button type="button" className={`${styles.retBtn} ${styles.retBtnPrimary}`} onClick={() => onSelect(e.id)}>
                  Manage
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {viewerIsOwner && (
        <div className={styles.retFoot}>
          {hold.lineupLocked
            ? 'Your lineup is locked, so your last saved lineup is used each gameweek. '
            : hold.lineupLockAt
              ? `If a player is still held at ${formatLockTime(hold.lineupLockAt)}, your lineup locks. `
              : 'If a player is still held when the next gameweek kicks off, your lineup locks. '}
          Held players don’t count toward your roster limit. Until you activate or drop them, you can’t bid, sign,
          borrow or take on extra players in a trade.
        </div>
      )}
    </section>
  );
}
