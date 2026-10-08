'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Formation, GranularPosition, Player } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import clubsData from '@/lib/clubs/clubs.json';
import { serializeLineup, VALID_FORMATIONS, type SerializedLineup } from '@/lib/lineups/lineupSerializer';
import { exportLineupToBlob, type LineupExportSlot } from '@/lib/lineups/lineupImageExport';
import ReadOnlyFormationBoard, { type FormationBoardSlot } from '@/components/formation/ReadOnlyFormationBoard';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { resolveClub } from '@/lib/clubs/registry';
import LineupPlayerPickerModal from './LineupPlayerPickerModal';
import styles from './lineup-builder.module.css';

interface Props {
  allPlayers: Player[];
  initialState: SerializedLineup;
}

const FORMATIONS: readonly Formation[] = VALID_FORMATIONS;

const BACK_LINES = ['3', '4', '5'] as const;

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

  const boardSlots = useMemo<FormationBoardSlot[]>(
    () =>
      (FORMATION_SLOTS[formation] as GranularPosition[]).map((slot, index) => {
        const p = assignments[index];
        return {
          slot,
          index,
          player: p
            ? {
                id: p.id,
                name: p.name,
                club: p.pl_team,
                photoUrl: p.photo_url,
                photoVersion: p.photo_version,
                headTopPct: p.portrait_head_top_pct,
                headWidthPct: p.portrait_head_width_pct,
              }
            : null,
        };
      }),
    [formation, assignments],
  );
  const filledCount = assignedPlayerIds.size;

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

  const slotPositions = FORMATION_SLOTS[formation] as GranularPosition[];
  const caption = feedbackNotice ?? `${filledCount} of 11 picked`;

  return (
    <div className={styles.page}>
      <div className={`g-panel ${styles.board}`}>
        <div className={styles.head}>
          <div className={styles.titleBlock}>
            <input
              type="text"
              className={styles.titleInput}
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name Your Lineup"
              aria-label="Lineup name"
            />
            <div className={styles.meterRow}>
              <div
                className={styles.meter}
                role="progressbar"
                aria-label="Players picked"
                aria-valuemin={0}
                aria-valuemax={11}
                aria-valuenow={filledCount}
              >
                {Array.from({ length: 11 }, (_, i) => (
                  <i key={i} className={i < filledCount ? styles.meterOn : undefined} />
                ))}
              </div>
              <span className={styles.caption} role="status" aria-live="polite">
                {caption}
              </span>
            </div>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={handleCopyLink}>
              Copy Link
            </button>
            <button type="button" className={styles.primaryBtn} onClick={handleShare} disabled={isExporting}>
              {isExporting ? 'Generating…' : 'Share XI'}
            </button>
          </div>
        </div>

        <div className={styles.formationBar}>
          <div className={styles.formationGroups} role="group" aria-label="Formation">
            {BACK_LINES.map((line) => (
              <div key={line} className={styles.formationGroup}>
                <span className={styles.formationGroupLabel} aria-hidden>
                  Back {line}
                </span>
                <div className={styles.formationPills}>
                  {FORMATIONS.filter((f) => f.charAt(0) === line).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`${styles.formationPill} ${formation === f ? styles.formationPillActive : ''}`}
                      onClick={() => setFormation(f)}
                      aria-pressed={formation === f}
                      aria-label={`${f}, ${line} at the back`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.pitchCol}>
            <ReadOnlyFormationBoard
              formation={formation}
              slots={boardSlots}
              emptyLabel="Pick a formation to start"
              ariaLabel={`${formation} starting XI`}
              variant="standard"
              onSelectSlot={handleOpenSlot}
            />
          </div>

          <aside className={styles.rail} aria-label="Starting XI">
            <div className={styles.railHead}>
              <div className={styles.railTitleRow}>
                <h2 className={styles.railH}>Starting XI</h2>
                <button type="button" className={styles.textBtn} onClick={handleReset} disabled={filledCount === 0}>
                  Clear XI
                </button>
              </div>
              <label className={styles.pickFrom}>
                <span className="g-label">Pick From</span>
                <select
                  className={styles.select}
                  value={clubFilter || ''}
                  onChange={(e) => setClubFilter(e.target.value || null)}
                >
                  <option value="">All Clubs</option>
                  {clubsData.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ol className={styles.railList}>
              {slotPositions.map((pos, i) => {
                const p = assignments[i];
                return (
                  <li key={i}>
                    <button type="button" className={styles.railRow} onClick={() => handleOpenSlot(i)}>
                      <PositionBadge position={pos} size="sm" />
                      {p ? (
                        <>
                          <Portrait
                            photoUrl={p.photo_url}
                            name={p.name}
                            club={p.pl_team}
                            size="sm"
                            headTopPct={p.portrait_head_top_pct}
                            headWidthPct={p.portrait_head_width_pct}
                            photoVersion={p.photo_version}
                          />
                          <span className={styles.railText}>
                            <span className={styles.railName}>{getPlayerDisplayName(p, 'full')}</span>
                            <span className={styles.railClub}>{resolveClub(p.pl_team)?.name ?? p.pl_team}</span>
                          </span>
                          <span className={styles.railAction}>Change</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.railEmptyDot} aria-hidden="true" />
                          <span className={styles.railEmpty}>Add {pos}</span>
                          <span className={styles.railAdd} aria-hidden="true">+</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      </div>

      {/* Player Picker Modal */}
      {activeSlot && (
        <LineupPlayerPickerModal
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
