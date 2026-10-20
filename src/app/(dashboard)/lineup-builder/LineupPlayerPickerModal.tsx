'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GranularPosition, Player } from '@/types';
import PositionBadge from '@/components/players/PositionBadge';
import Portrait from '@/components/players/Portrait';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { resolveClub } from '@/lib/clubs/registry';
import { fold } from '@/lib/text/fold';
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
  /** Clubs the picker offers, as slugs: every club with an active player, or the two in the chosen match. */
  clubOptions: { slug: string; name: string }[];
  /** True when the XI is one side of a match, so only that club's players are offered. */
  matchOnly: boolean;
}

const PAGE_LIMIT = 50;

const POS_CATEGORIES = ['ALL', 'GK', 'DEF', 'MID', 'ATT'] as const;
type PosCategory = (typeof POS_CATEGORIES)[number];

const DEF_POS: GranularPosition[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const MID_POS: GranularPosition[] = ['DM', 'CM', 'AM'];
const ATT_POS: GranularPosition[] = ['LW', 'RW', 'ST'];

/** A player belongs to every group he can play in, so an AM who also plays LW is an attacker too. */
function inCategory(player: Player, cat: PosCategory): boolean {
  if (cat === 'ALL') return true;
  if (getCategory(player.primary_position) === cat) return true;
  return (player.secondary_positions ?? []).some((pos) => getCategory(pos) === cat);
}

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
  clubOptions,
  matchOnly,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<string>(
    initialClubFilter && clubOptions.some((c) => c.slug === initialClubFilter) ? initialClubFilter : 'all',
  );
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

  // Folded once per pool, not per keystroke: "joao" has to find "João".
  const searchIndex = useMemo(() => {
    const index = new Map<string, { key: string; club: string | null }>();
    for (const p of allPlayers) {
      index.set(p.id, {
        key: [p.name, p.web_name, p.full_name, getPlayerDisplayName(p, 'full')].map(fold).join(' '),
        club: resolveClub(p.pl_team)?.slug ?? null,
      });
    }
    return index;
  }, [allPlayers]);

  const clubSlugs = useMemo(() => new Set(clubOptions.map((c) => c.slug)), [clubOptions]);

  const filteredPlayers = useMemo(() => {
    const q = fold(search);
    const matches = allPlayers.filter((p) => {
      const entry = searchIndex.get(p.id);
      const club = entry?.club ?? null;
      if (matchOnly && (!club || !clubSlugs.has(club))) return false;
      if (selectedClub !== 'all' && club !== selectedClub) return false;
      if (!inCategory(p, posCategory)) return false;
      if (q && !entry?.key.includes(q)) return false;
      return true;
    });
    // Natural fits for the slot first, then players who list it as a secondary; the rest keep A to Z order.
    const fit = (p: Player) =>
      p.primary_position === slotPos ? 2 : (p.secondary_positions ?? []).includes(slotPos) ? 1 : 0;
    return [...matches].sort((a, b) => fit(b) - fit(a));
  }, [allPlayers, searchIndex, clubSlugs, matchOnly, search, selectedClub, posCategory, slotPos]);

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
            {clubOptions.length > 1 && (
            <select
              className={`${styles.input} ${styles.clubSelect}`}
              aria-label="Filter by club"
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
            >
              <option value="all">All Clubs</option>
              {clubOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            )}
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
                const also = (player.secondary_positions ?? []).filter((pos) => pos !== player.primary_position);

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
                        <span className={styles.playerClub}>
                          {clubName}
                          {also.length > 0 && <> &middot; Also {also.join(', ')}</>}
                        </span>
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
