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
  slotIndex: number;
  slotPos: GranularPosition;
  currentPlayer: Player | null;
  allPlayers: Player[];
  assignedPlayerIds: Set<string>;
  onSelectPlayer: (player: Player) => void;
  onRemovePlayer: () => void;
  onClose: () => void;
  initialClubFilter?: string | null;
}

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
  slotIndex,
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
  const [posCategory, setPosCategory] = useState<PosCategory>('ALL');

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
    return allPlayers.filter((p) => {
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
  }, [allPlayers, search, selectedClub, posCategory]);

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalShell} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Assign Slot {slotIndex + 1} ({slotPos})
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {currentPlayer && (
              <button
                type="button"
                className={styles.actionBtn}
                style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                onClick={onRemovePlayer}
              >
                Clear Slot
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
              ✕
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className={styles.searchSection}>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder={`Search all Premier League players for ${slotPos}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Club select */}
            <select
              className={styles.clubFilterSelect}
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
            >
              <option value="all">All Premier League Clubs</option>
              {clubsData.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Position tabs */}
            <div className={styles.filterTabs}>
              {POS_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.filterTab} ${posCategory === cat ? styles.filterTabActive : ''}`}
                  onClick={() => setPosCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Player List */}
        <div className={styles.playerList}>
          {filteredPlayers.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No players found matching your filters.
            </div>
          ) : (
            filteredPlayers.slice(0, 50).map((player) => {
              const isAssigned = assignedPlayerIds.has(player.id);
              const isCurrent = currentPlayer?.id === player.id;
              const isOop = player.primary_position !== slotPos;
              const clubName = resolveClub(player.pl_team)?.name ?? player.pl_team ?? '';

              return (
                <button
                  key={player.id}
                  type="button"
                  className={`${styles.playerRow} ${isCurrent ? styles.playerRowActive : ''}`}
                  onClick={() => onSelectPlayer(player)}
                >
                  <div className={styles.playerInfo}>
                    <Portrait
                      photoUrl={player.photo_url}
                      name={player.name}
                      club={player.pl_team}
                      size="sm"
                      headTopPct={player.portrait_head_top_pct}
                      headWidthPct={player.portrait_head_width_pct}
                      photoVersion={player.photo_version}
                    />
                    <div>
                      <div className={styles.playerName}>{getPlayerDisplayName(player, 'full')}</div>
                      <div className={styles.playerClub}>{clubName}</div>
                    </div>
                  </div>

                  <div className={styles.playerTags}>
                    {isOop && player.primary_position && (
                      <span className={styles.assignedTag} title="Natural position">
                        Nat: {player.primary_position}
                      </span>
                    )}
                    {isAssigned && !isCurrent && (
                      <span className={styles.assignedTag}>In Lineup</span>
                    )}
                    {player.primary_position && (
                      <PositionBadge position={player.primary_position} />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
