'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Formation, GranularPosition, Player } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import { serializeLineup, VALID_FORMATIONS, type SerializedLineup } from '@/lib/lineups/lineupSerializer';
import { exportLineupToBlob, type LineupExportSlot } from '@/lib/lineups/lineupImageExport';
import ReadOnlyFormationBoard, { type FormationBoardSlot } from '@/components/formation/ReadOnlyFormationBoard';
import Portrait from '@/components/players/Portrait';
import { Icon } from '@/components/ui/Icon';
import PositionBadge from '@/components/players/PositionBadge';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { resolveClub } from '@/lib/clubs/registry';
import { fixtureDay, fixtureTitle, type BuilderFixture } from '@/lib/lineups/builderFixtures';
import LineupPlayerPickerModal from './LineupPlayerPickerModal';
import styles from './lineup-builder.module.css';

interface Props {
  allPlayers: Player[];
  initialState: SerializedLineup;
  /** This matchweek's and the next two's Premier League matches. */
  fixtures: BuilderFixture[];
  /** The match a shared link names, when it names one that exists. */
  initialFixture: BuilderFixture | null;
}

const FORMATIONS: readonly Formation[] = VALID_FORMATIONS;

const BACK_LINES = ['3', '4', '5'] as const;

const fixtureKey = (f: { season: string; id: number }) => `${f.season}:${f.id}`;

export default function LineupBuilderClient({ allPlayers, initialState, fixtures, initialFixture }: Props) {
  const [formation, setFormation] = useState<Formation>(initialState.formation);
  const [title, setTitle] = useState<string>(initialState.title);
  const [fixture, setFixture] = useState<BuilderFixture | null>(initialFixture);
  const [clubFilter, setClubFilter] = useState<string | null>(() => {
    const c = initialState.clubFilter ?? null;
    // A shared match link only ever narrows to one of its own two clubs.
    if (c && initialFixture && c !== initialFixture.home && c !== initialFixture.away) return null;
    return c;
  });

  // An old link's match can sit outside this matchweek's window; it still heads the list.
  const fixtureOptions = useMemo(
    () =>
      initialFixture && !fixtures.some((f) => fixtureKey(f) === fixtureKey(initialFixture))
        ? [initialFixture, ...fixtures]
        : fixtures,
    [fixtures, initialFixture],
  );
  const fixturesByWeek = useMemo(() => {
    const current = fixtures[0]?.season;
    const weeks = new Map<string, BuilderFixture[]>();
    for (const f of fixtureOptions) {
      const label = !current || f.season === current ? `Matchweek ${f.gameweek}` : `${f.season} Matchweek ${f.gameweek}`;
      weeks.set(label, [...(weeks.get(label) ?? []), f]);
    }
    return [...weeks.entries()];
  }, [fixtureOptions, fixtures]);

  // Every club with an active player, by name. clubs.json also keeps relegated clubs, which have no one to pick.
  const leagueClubs = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const p of allPlayers) {
      const club = resolveClub(p.pl_team);
      if (club) bySlug.set(club.slug, club.name);
    }
    return [...bySlug.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlayers]);
  const clubOptions = useMemo(
    () =>
      fixture
        ? [
            { slug: fixture.home, name: fixture.homeName },
            { slug: fixture.away, name: fixture.awayName },
          ]
        : leagueClubs,
    [fixture, leagueClubs],
  );

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

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
      fixture: fixture ? { season: fixture.season, id: fixture.id } : null,
      playerIds,
    });

    const newUrl = `${window.location.pathname}?${serialized}`;
    window.history.replaceState(null, '', newUrl);
  }, [formation, title, clubFilter, fixture, assignments]);

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
                // Short enough for the pitch chip at every width; 'smart' defaults to 14, which clips at 74px.
                name: getPlayerDisplayName(p, 'smart', 11),
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

  const handleSelectFixture = useCallback(
    (key: string) => {
      const next = fixtureOptions.find((f) => fixtureKey(f) === key) ?? null;
      // A match names the lineup unless you've named it yourself.
      setTitle((prev) => {
        const t = prev.trim();
        const auto = !t || (fixture !== null && t === fixtureTitle(fixture));
        return auto ? (next ? fixtureTitle(next) : '') : prev;
      });
      setClubFilter((prev) => (next && prev && prev !== next.home && prev !== next.away ? null : prev));
      setFixture(next);
    },
    [fixture, fixtureOptions],
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
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
        matchweek: fixture?.gameweek ?? null,
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
  }, [assignments, formation, title, fixture]);

  const slotPositions = FORMATION_SLOTS[formation] as GranularPosition[];
  const caption = feedbackNotice ?? `${filledCount} of 11 picked`;

  return (
    <div className={styles.page}>
      <div className={`g-panel ${styles.board}`}>
        <div className={styles.head}>
          <div className={styles.titleRow}>
            <input
              type="text"
              className={styles.titleInput}
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name Your Lineup"
              aria-label="Lineup name"
            />
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleCopyLink}
                aria-label="Copy Link"
                data-tip={copied ? 'Copied' : 'Copy Link'}
              >
                <Icon name={copied ? 'check' : 'copy'} size={18} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                onClick={handleShare}
                disabled={isExporting}
                aria-busy={isExporting}
                aria-label="Share XI"
                data-tip={isExporting ? 'Generating' : 'Share XI'}
              >
                {isExporting ? (
                  <span className={styles.spinner} aria-hidden="true" />
                ) : (
                  <Icon name="share-out" size={18} strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
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
              {fixtureOptions.length > 0 && (
                <label className={styles.pickFrom}>
                  <span className="g-label">Match</span>
                  <select
                    className={styles.select}
                    value={fixture ? fixtureKey(fixture) : ''}
                    onChange={(e) => handleSelectFixture(e.target.value)}
                  >
                    <option value="">Any Match</option>
                    {fixturesByWeek.map(([week, list]) => (
                      <optgroup key={week} label={week}>
                        {list.map((f) => (
                          <option key={fixtureKey(f)} value={fixtureKey(f)}>
                            {fixtureTitle(f)} · {fixtureDay(f)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              )}
              <label className={styles.pickFrom}>
                <span className="g-label">Pick From</span>
                <select
                  className={styles.select}
                  value={clubFilter || ''}
                  onChange={(e) => setClubFilter(e.target.value || null)}
                >
                  <option value="">{fixture ? 'Both Clubs' : 'All Clubs'}</option>
                  {clubOptions.map((c) => (
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
          clubOptions={clubOptions}
          matchOnly={fixture !== null}
        />
      )}
    </div>
  );
}
