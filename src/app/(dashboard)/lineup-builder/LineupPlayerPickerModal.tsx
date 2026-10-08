'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GranularPosition, Player } from '@/types';
import PositionBadge from '@/components/players/PositionBadge';
import Portrait from '@/components/players/Portrait';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { resolveClub } from '@/lib/clubs/registry';
import clubsData from '@/lib/clubs/clubs.json';
import styles from './lineup-builder.module.css';

interface Props {
  slotPos: GranularPosition;
  currentPlayer: Player | null;
  allPlayers: Player[];
  assignedPlayerIds: Set<string>;
  onSelectPlayer: (player: Player) => void;
  onRemovePlayer: () => void;
  onClose: () => void;
  initialClubFilter?: string | null;
}

const PAGE_LIMIT = 50;

const POS_CATEGORIES = ['ALL', 'GK', 'DEF', 'MID', 'ATT'] as const;
type PosCategory = (typeof POS_CATEGORIES)[number];

const DEF_POS: GranularPosition[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const MID_POS: GranularPosition[] = ['DM', 'CM', 'AM'];
const ATT_POS: GranularPosition[] = ['LW', 'RW', 'ST'];

function getCategory(pos?: GranularPosition | null): PosCategory {
  if (!pos) return 'ALL';
  if (pos === 'GK') return 'GK';
  if (DEF_POS.includes(pos)) return 'DEF';
  if (MID_POS.includes(pos)) return 'MID';
  if (ATT_POS.includes(pos)) return 'ATT';
  return 'ALL';
}

export default function LineupPlayerPickerModal({
  slotPos,
  currentPlayer,
  allPlayers,
  assignedPlayerIds,
  onSelectPlayer,
  onRemovePlayer,
  onClose,
  initialClubFilter,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<string>(initialClubFilter || 'all');
  const [posCategory, setPosCategory] = useState<PosCategory>(getCategory(slotPos));

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filter players
  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = allPlayers.filter((p) => {
      // Club filter
      if (selectedClub !== 'all') {
        const pClub = p.pl_team?.toLowerCase();
        if (pClub !== selectedClub.toLowerCase()) return false;
      }

      // Position category filter
      if (posCategory !== 'ALL') {
        const cat = getCategory(p.primary_position);
        if (cat !== posCategory) return false;
      }

      // Search query
      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q) || (p.web_name && p.web_name.toLowerCase().includes(q));
        if (!nameMatch) return false;
      }

      return true;
    });
    // Players who naturally play the slot come first; the rest keep A to Z order.
    return [...matches].sort(
      (a, b) => Number(b.primary_position === slotPos) - Number(a.primary_position === slotPos),
    );
  }, [allPlayers, search, selectedClub, posCategory, slotPos]);

  const visible = filteredPlayers.slice(0, PAGE_LIMIT);

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalShell}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Select ${slotPos}`}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Select <PositionBadge position={slotPos} size="sm" />
          </h2>
          <div className={styles.modalHeaderActions}>
            {currentPlayer && (
              <button type="button" className={styles.textBtn} onClick={onRemovePlayer}>
                Clear Slot
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className={styles.searchSection}>
          <div className={styles.searchRow}>
            <input
              ref={inputRef}
              type="search"
              className={styles.input}
              placeholder="Search Players"
              aria-label="Search players"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={`${styles.input} ${styles.clubSelect}`}
              aria-label="Filter by club"
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
            >
              <option value="all">All Clubs</option>
              {clubsData.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterTabs}>
            {POS_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.formationPill} ${posCategory === cat ? styles.formationPillActive : ''}`}
                aria-pressed={posCategory === cat}
                onClick={() => setPosCategory(cat)}
              >
                {cat === 'ALL' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.playerList}>
          {filteredPlayers.length === 0 ? (
            <div className={styles.emptyList}>No players match those filters.</div>
          ) : (
            <>
              {visible.map((player) => {
                const isAssigned = assignedPlayerIds.has(player.id);
                const isCurrent = currentPlayer?.id === player.id;
                const clubName = resolveClub(player.pl_team)?.name ?? player.pl_team ?? '';

                return (
                  <button
                    key={player.id}
                    type="button"
                    className={`${styles.playerRow} ${isCurrent ? styles.playerRowActive : ''}`}
                    onClick={() => onSelectPlayer(player)}
                  >
                    <span className={styles.playerInfo}>
                      <Portrait
                        photoUrl={player.photo_url}
                        name={player.name}
                        club={player.pl_team}
                        size="sm"
                        headTopPct={player.portrait_head_top_pct}
                        headWidthPct={player.portrait_head_width_pct}
                        photoVersion={player.photo_version}
                      />
                      <span className={styles.playerText}>
                        <span className={styles.playerName}>{getPlayerDisplayName(player, 'full')}</span>
                        <span className={styles.playerClub}>{clubName}</span>
                      </span>
                    </span>
                    <span className={styles.playerTags}>
                      {isAssigned && !isCurrent && <span className={styles.assignedTag}>In XI</span>}
                      {player.primary_position && <PositionBadge position={player.primary_position} size="sm" />}
                    </span>
                  </button>
                );
              })}
              {filteredPlayers.length > PAGE_LIMIT && (
                <div className={styles.listNote}>
                  Showing {PAGE_LIMIT} of {filteredPlayers.length}. Search to narrow the list.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
