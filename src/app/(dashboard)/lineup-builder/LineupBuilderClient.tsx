'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Formation, GranularPosition, Player } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import { resolveClub } from '@/lib/clubs/registry';
import { serializeLineup, isFormation, type SerializedLineup } from '@/lib/lineups/lineupSerializer';
import { exportLineupToBlob, type LineupExportSlot } from '@/lib/lineups/lineupImageExport';
import LineupPitch from './LineupPitch';
import LineupPlayerPickerModal from './LineupPlayerPickerModal';
import styles from './lineup-builder.module.css';

interface Props {
  allPlayers: Player[];
  initialState: SerializedLineup;
}

const FORMATIONS: Formation[] = [
  '4-3-3',
  '4-2-1-3',
  '4-2-2-2',
  '3-4-1-2',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '3-4-2-1',
  '4-3-1-2',
  '4-3-2-1',
  '4-2-4',
  '5-2-3',
];

export default function LineupBuilderClient({ allPlayers, initialState }: Props) {
  const [formation, setFormation] = useState<Formation>(initialState.formation);
  const [title, setTitle] = useState<string>(initialState.title);
  const [clubFilter, setClubFilter] = useState<string | null>(initialState.clubFilter ?? null);

  // Map of all players by ID for fast lookup
  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of allPlayers) map.set(p.id, p);
    return map;
  }, [allPlayers]);

  // Only clubs that have a player in the pool, so relegated clubs don't appear.
  const clubOptions = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const p of allPlayers) {
      const club = resolveClub(p.pl_team);
      if (club) bySlug.set(club.slug, club.name);
    }
    return [...bySlug].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlayers]);

  // Slot assignments (0..10)
  const [assignments, setAssignments] = useState<Record<number, Player | null>>(() => {
    const initial: Record<number, Player | null> = {};
    for (let i = 0; i < 11; i++) {
      const pid = initialState.playerIds[i];
      initial[i] = pid ? playerById.get(pid) ?? null : null;
    }
    return initial;
  });

  // Active slot being edited in modal
  const [activeSlot, setActiveSlot] = useState<{ slotIndex: number; pos: GranularPosition } | null>(null);

  // Status feedback message (e.g. "Copied to clipboard")
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Clear notice after 3 seconds
  useEffect(() => {
    if (!feedbackNotice) return;
    const t = setTimeout(() => setFeedbackNotice(null), 3000);
    return () => clearTimeout(t);
  }, [feedbackNotice]);

  // Sync URL query params whenever state changes
  useEffect(() => {
    const playerIds = Array(11)
      .fill(null)
      .map((_, i) => assignments[i]?.id ?? null);

    const serialized = serializeLineup({
      formation,
      title,
      clubFilter,
      playerIds,
    });

    const newUrl = `${window.location.pathname}?${serialized}`;
    window.history.replaceState(null, '', newUrl);
  }, [formation, title, clubFilter, assignments]);

  // Set of player IDs currently assigned to avoid duplicates
  const assignedPlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < 11; i++) {
      const p = assignments[i];
      if (p) set.add(p.id);
    }
    return set;
  }, [assignments]);

  const handleOpenSlot = useCallback(
    (slotIndex: number) => {
      // SAFETY: FORMATION_SLOTS maps every supported Formation to an array of 11 GranularPositions.
      const slots = FORMATION_SLOTS[formation] as GranularPosition[];
      const pos = slots[slotIndex];
      setActiveSlot({ slotIndex, pos });
    },
    [formation]
  );

  const handleSelectPlayer = useCallback(
    (player: Player) => {
      if (!activeSlot) return;

      setAssignments((prev) => {
        const next = { ...prev };
        // If this player was already in another slot, clear that slot (swap/move)
        for (let i = 0; i < 11; i++) {
          if (next[i]?.id === player.id) {
            next[i] = null;
          }
        }
        next[activeSlot.slotIndex] = player;
        return next;
      });

      setActiveSlot(null);
    },
    [activeSlot]
  );

  const handleRemovePlayer = useCallback(() => {
    if (!activeSlot) return;
    setAssignments((prev) => ({
      ...prev,
      [activeSlot.slotIndex]: null,
    }));
    setActiveSlot(null);
  }, [activeSlot]);

  const handleReset = useCallback(() => {
    const empty: Record<number, Player | null> = {};
    for (let i = 0; i < 11; i++) empty[i] = null;
    setAssignments(empty);
    setFeedbackNotice('Lineup cleared');
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedbackNotice('Link copied to clipboard');
    } catch {
      setFeedbackNotice('Failed to copy link');
    }
  }, []);

  const handleShare = useCallback(async () => {
    setIsExporting(true);
    try {
      // SAFETY: FORMATION_SLOTS maps every supported Formation to an array of 11 GranularPositions.
      const slotsList: LineupExportSlot[] = (FORMATION_SLOTS[formation] as GranularPosition[]).map(
        (pos, slotIndex) => ({
          slotIndex,
          pos,
          player: assignments[slotIndex] ?? null,
        })
      );

      const blob = await exportLineupToBlob({
        title: title || 'Starting XI',
        formation,
        slots: slotsList,
      });

      if (!blob) {
        setFeedbackNotice('Could not generate image');
        setIsExporting(false);
        return;
      }

      const file = new File([blob], 'lineup.png', { type: 'image/png' });

      // If Web Share API with files is supported (mobile iOS/Android)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: title || 'Starting XI',
            text: `Check out my ${title || 'Starting XI'} on Gaffa:`,
          });
          setIsExporting(false);
          return;
        } catch (shareErr) {
          // If user cancelled, just exit gracefully
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            setIsExporting(false);
            return;
          }
        }
      }

      // Fallback: Copy image to clipboard
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        setFeedbackNotice('Lineup image copied to clipboard');
      } catch {
        // If clipboard write failed, trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(title || 'lineup').toLowerCase().replace(/\s+/g, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setFeedbackNotice('Lineup image downloaded');
      }
    } catch (err) {
      console.error('Share export error:', err);
      setFeedbackNotice('Error generating share image');
    } finally {
      setIsExporting(false);
    }
  }, [assignments, formation, title]);

  return (
    <div className={styles.container}>
      {/* Header Bar */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleInputWrapper}>
            <input
              type="text"
              className={styles.titleInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your lineup (e.g. Chelsea vs Hull)..."
              aria-label="Lineup Title"
            />
          </div>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.primaryBtn}`}
              onClick={handleShare}
              disabled={isExporting}
            >
              {isExporting ? 'Generating...' : 'Share XI'}
            </button>

            <button type="button" className={`${styles.actionBtn} ${styles.secondaryBtn}`} onClick={handleCopyLink}>
              Copy Link
            </button>

            <button type="button" className={`${styles.actionBtn} ${styles.secondaryBtn}`} onClick={handleReset}>
              Reset Pitch
            </button>
          </div>
        </div>

        {/* Formation & Club Quick Filters */}
        <div className={styles.controlsRow}>
          <div className={styles.formationGroup}>
            <span className={styles.groupLabel}>Formation</span>
            <select
              className={styles.formationSelect}
              value={formation}
              onChange={(e) => {
                if (isFormation(e.target.value)) setFormation(e.target.value);
              }}
              aria-label="Select Formation"
            >
              {FORMATIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formationGroup}>
            <span className={styles.groupLabel}>Club Filter</span>
            <select
              className={styles.clubFilterSelect}
              value={clubFilter || ''}
              onChange={(e) => setClubFilter(e.target.value || null)}
              aria-label="Filter Squad by Club"
            >
              <option value="">All Clubs</option>
              {clubOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {feedbackNotice && (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' }}>
              {feedbackNotice}
            </div>
          )}
        </div>
      </header>

      {/* Main Pitch */}
      <main>
        <LineupPitch
          formation={formation}
          assignments={assignments}
          onSelectSlot={handleOpenSlot}
        />
      </main>

      {/* Player Picker Modal */}
      {activeSlot && (
        <LineupPlayerPickerModal
          slotIndex={activeSlot.slotIndex}
          slotPos={activeSlot.pos}
          currentPlayer={assignments[activeSlot.slotIndex]}
          allPlayers={allPlayers}
          assignedPlayerIds={assignedPlayerIds}
          onSelectPlayer={handleSelectPlayer}
          onRemovePlayer={handleRemovePlayer}
          onClose={() => setActiveSlot(null)}
          initialClubFilter={clubFilter}
        />
      )}
    </div>
  );
}
