'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Formation, GranularPosition, Player } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import { serializeLineup, VALID_FORMATIONS, type SerializedLineup } from '@/lib/lineups/lineupSerializer';
import { exportLineupToBlob, type LineupExportSlot } from '@/lib/lineups/lineupImageExport';
import ReadOnlyFormationBoard, { type FormationBoardSlot } from '@/components/formation/ReadOnlyFormationBoard';
import Portrait from '@/components/players/Portrait';
import { Icon } from '@/components/ui/Icon';
import PositionBadge from '@/components/players/PositionBadge';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { clubBadgePath, resolveClub } from '@/lib/clubs/registry';
import {
  fixtureKey,
  fixtureTitle,
  kickoffDay,
  type BuilderFixture,
  type MatchLineups,
  type MatchSide,
  type SideSource,
} from '@/lib/lineups/builderFixtures';
import { fitFormation } from '@/lib/lineups/fitFormation';
import LineupPlayerPickerModal from './LineupPlayerPickerModal';
import { ClubPicker, MatchPicker } from './BuilderPickers';
import styles from './lineup-builder.module.css';

/* eslint-disable @next/next/no-img-element */

interface Props {
  allPlayers: Player[];
  initialState: SerializedLineup;
  /** Two matchweeks either side of the one in progress. */
  fixtures: BuilderFixture[];
  /** The match a shared link names, when it names one that exists. */
  initialFixture: BuilderFixture | null;
  /** Each listed match's opening XIs: its starters once played, otherwise each club's last XI. */
  lineups: MatchLineups;
}

const FORMATIONS: readonly Formation[] = VALID_FORMATIONS;

const BACK_LINES = ['3', '4', '5'] as const;

const SIDES: readonly MatchSide[] = ['home', 'away'];

/** One XI: a shape and who fills each of its eleven slots. */
interface XI {
  formation: Formation;
  assignments: Record<number, Player | null>;
}

function xiFromIds(formation: Formation, ids: (string | null)[], playerById: Map<string, Player>): XI {
  const assignments: Record<number, Player | null> = {};
  for (let i = 0; i < 11; i++) {
    const id = ids[i];
    assignments[i] = id ? playerById.get(id) ?? null : null;
  }
  return { formation, assignments };
}

/** A side's opening XI, laid out on the formation its starters fit best. Empty when there is none. */
function xiFromSource(source: SideSource | null, playerById: Map<string, Player>): XI {
  if (!source) return xiFromIds('4-3-3', [], playerById);
  const players = source.playerIds.map((id) => playerById.get(id)).filter((p): p is Player => !!p);
  const fit = fitFormation(players);
  return xiFromIds(fit.formation, fit.playerIds, playerById);
}

/**
 * What a side opens with. A played match opens on its real starters. A match not
 * yet played opens empty, for your own prediction; its last XI is one tap away
 * (Use Last XI) rather than filled in, so an upcoming match never reads as if
 * its lineup were already known.
 */
function openingXI(source: SideSource | null, playerById: Map<string, Player>): XI {
  return source?.kind === 'started' ? xiFromSource(source, playerById) : xiFromSource(null, playerById);
}

const idsOf = (xi: XI) => Array.from({ length: 11 }, (_, i) => xi.assignments[i]?.id ?? null);
const sameXI = (a: XI, b: XI) => a.formation === b.formation && idsOf(a).join() === idsOf(b).join();

export default function LineupBuilderClient({ allPlayers, initialState, fixtures, initialFixture, lineups }: Props) {
  const [title, setTitle] = useState<string>(initialState.title);
  const [fixture, setFixture] = useState<BuilderFixture | null>(initialFixture);
  const [side, setSide] = useState<MatchSide>(initialState.side ?? 'home');
  const [clubFilter, setClubFilter] = useState<string | null>(initialFixture ? null : initialState.clubFilter ?? null);

  // Map of all players by ID for fast lookup
  const playerById = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of allPlayers) map.set(p.id, p);
    return map;
  }, [allPlayers]);

  // An old link's match can sit outside the window; it still heads the list.
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

  // The free-form XI, and each match's two, kept apart so switching between them loses nothing.
  const [soloXI, setSoloXI] = useState<XI>(() =>
    initialFixture
      ? xiFromIds('4-3-3', [], playerById)
      : xiFromIds(initialState.formation, initialState.playerIds, playerById),
  );
  const [matchXIs, setMatchXIs] = useState<Record<string, Record<MatchSide, XI>>>(() => {
    if (!initialFixture) return {};
    const source = lineups[fixtureKey(initialFixture)];
    const linkedHome = initialState.playerIds.some(Boolean);
    return {
      [fixtureKey(initialFixture)]: {
        home: linkedHome
          ? xiFromIds(initialState.formation, initialState.playerIds, playerById)
          : openingXI(source?.home ?? null, playerById),
        away: initialState.away
          ? xiFromIds(initialState.away.formation, initialState.away.playerIds, playerById)
          : openingXI(source?.away ?? null, playerById),
      },
    };
  });

  const matchKey = fixture ? fixtureKey(fixture) : null;
  const source: SideSource | null = matchKey ? lineups[matchKey]?.[side] ?? null : null;
  const active: XI = (matchKey && matchXIs[matchKey]?.[side]) || soloXI;
  const { formation, assignments } = active;

  const updateActive = useCallback(
    (fn: (xi: XI) => XI) => {
      if (!matchKey) {
        setSoloXI(fn);
        return;
      }
      setMatchXIs((prev) => {
        const pair = prev[matchKey];
        if (!pair) return prev;
        return { ...prev, [matchKey]: { ...pair, [side]: fn(pair[side]) } };
      });
    },
    [matchKey, side],
  );
  const setFormation = useCallback((f: Formation) => updateActive((xi) => ({ ...xi, formation: f })), [updateActive]);
  const setAssignments = useCallback(
    (fn: (prev: Record<number, Player | null>) => Record<number, Player | null>) =>
      updateActive((xi) => ({ ...xi, assignments: fn(xi.assignments) })),
    [updateActive],
  );

  const sideClub = fixture ? { slug: fixture[side], name: side === 'home' ? fixture.homeName : fixture.awayName } : null;
  const clubOptions = useMemo(() => (sideClub ? [sideClub] : leagueClubs), [sideClub?.slug, leagueClubs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each side's opening XI: the way back after edits, and what a link can leave out.
  const sourceXIs = useMemo(() => {
    if (!matchKey) return null;
    const pair = lineups[matchKey];
    return {
      home: openingXI(pair?.home ?? null, playerById),
      away: openingXI(pair?.away ?? null, playerById),
    };
  }, [matchKey, lineups, playerById]);
  const sourceXI = sourceXIs?.[side] ?? null;
  const edited = source?.kind === 'started' && sourceXI !== null && !sameXI(sourceXI, active);
  // For a match not yet played: the club's last XI, offered rather than filled in.
  const lastXI = useMemo(
    () => (source?.kind === 'last' ? xiFromSource(source, playerById) : null),
    [source, playerById],
  );
  const canUseLast = lastXI !== null && !sameXI(lastXI, active);

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
    const pair = matchKey ? matchXIs[matchKey] : null;
    const home = pair?.home ?? soloXI;
    // A side left as the match gave it stays out of the link, which rebuilds it from the match.
    const homeAsGiven = pair && sourceXIs ? sameXI(sourceXIs.home, pair.home) : false;
    const awayAsGiven = pair && sourceXIs ? sameXI(sourceXIs.away, pair.away) : false;
    const serialized = serializeLineup({
      formation: home.formation,
      title,
      clubFilter: fixture ? null : clubFilter,
      fixture: fixture ? { season: fixture.season, id: fixture.id } : null,
      playerIds: homeAsGiven ? [] : idsOf(home),
      away: pair && !awayAsGiven ? { formation: pair.away.formation, playerIds: idsOf(pair.away) } : null,
      side,
    });

    const newUrl = `${window.location.pathname}?${serialized}`;
    window.history.replaceState(null, '', newUrl);
  }, [title, clubFilter, fixture, matchKey, matchXIs, soloXI, side, sourceXIs]);

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
    [activeSlot, setAssignments]
  );

  const handleRemovePlayer = useCallback(() => {
    if (!activeSlot) return;
    setAssignments((prev) => ({
      ...prev,
      [activeSlot.slotIndex]: null,
    }));
    setActiveSlot(null);
  }, [activeSlot, setAssignments]);

  const handleReset = useCallback(() => {
    const empty: Record<number, Player | null> = {};
    for (let i = 0; i < 11; i++) empty[i] = null;
    setAssignments(() => empty);
    setFeedbackNotice('Lineup cleared');
  }, [setAssignments]);

  const handleRestore = useCallback(() => {
    if (!sourceXI) return;
    updateActive(() => sourceXI);
    setFeedbackNotice('Starting XI restored');
  }, [sourceXI, updateActive]);

  const handleUseLast = useCallback(() => {
    if (!lastXI) return;
    updateActive(() => lastXI);
  }, [lastXI, updateActive]);

  const handleSelectFixture = useCallback(
    (key: string) => {
      const next = fixtureOptions.find((f) => fixtureKey(f) === key) ?? null;
      // A match names the lineup unless you've named it yourself.
      setTitle((prev) => {
        const t = prev.trim();
        const auto = !t || (fixture !== null && t === fixtureTitle(fixture));
        return auto ? (next ? fixtureTitle(next) : '') : prev;
      });
      if (next) {
        const k = fixtureKey(next);
        setMatchXIs((prev) =>
          prev[k]
            ? prev
            : {
                ...prev,
                [k]: {
                  home: openingXI(lineups[k]?.home ?? null, playerById),
                  away: openingXI(lineups[k]?.away ?? null, playerById),
                },
              },
        );
      }
      setSide('home');
      setFixture(next);
    },
    [fixture, fixtureOptions, lineups, playerById],
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

  // The image, prepared when the pointer or focus reaches Share, so the click can hand
  // it to the share sheet at once. Safari refuses share() and clipboard writes that
  // arrive long after the click, and drawing eleven portraits takes a moment.
  const shareKey = [title, formation, fixture ? fixtureKey(fixture) : '', side, idsOf(active).join()].join('|');
  const prepared = useRef<{ key: string; blob: Promise<Blob | null> } | null>(null);
  const prepareImage = useCallback((): Promise<Blob | null> => {
    if (prepared.current?.key === shareKey) return prepared.current.blob;
    // SAFETY: FORMATION_SLOTS maps every supported Formation to an array of 11 GranularPositions.
    const slotsList: LineupExportSlot[] = (FORMATION_SLOTS[formation] as GranularPosition[]).map((pos, slotIndex) => ({
      slotIndex,
      pos,
      player: assignments[slotIndex] ?? null,
    }));
    const blob = exportLineupToBlob({
      title: fixture ? fixtureTitle(fixture) : title || 'Starting XI',
      formation,
      slots: slotsList,
      matchweek: fixture?.gameweek ?? null,
      club: sideClub ? { name: sideClub.name, slug: sideClub.slug } : null,
    });
    prepared.current = { key: shareKey, blob };
    // A failed attempt must not stick: the next try draws again.
    blob.catch(() => {
      if (prepared.current?.blob === blob) prepared.current = null;
    });
    return blob;
  }, [shareKey, formation, assignments, title, fixture, sideClub?.name, sideClub?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = useCallback(async () => {
    setIsExporting(true);
    const name = fixture ? fixtureTitle(fixture) : title || 'Starting XI';
    let blob: Blob | null;
    try {
      blob = await prepareImage();
    } catch (err) {
      console.error('Lineup image export failed:', err);
      setFeedbackNotice(`Couldn't create the image (${err instanceof Error ? err.name : 'unknown error'})`);
      setIsExporting(false);
      return;
    }
    if (!blob) {
      setFeedbackNotice("Couldn't create the image");
      setIsExporting(false);
      return;
    }

    const file = new File([blob], 'lineup.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name, text: `Check out my ${name} on Gaffa:` });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.warn('Share sheet unavailable, falling back:', err);
    } finally {
      setIsExporting(false);
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setFeedbackNotice('Lineup image copied to clipboard');
    } catch {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.toLowerCase().replace(/\s+/g, '_')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedbackNotice('Lineup image downloaded');
    }
  }, [prepareImage, title, fixture]);

  const slotPositions = FORMATION_SLOTS[formation] as GranularPosition[];
  const caption = feedbackNotice ?? `${filledCount} of 11 picked`;
  const lastLabel = source?.kind === 'last'
    ? `Last XI · vs. ${source.from.opponentName} (${source.from.atHome ? 'H' : 'A'}) · ${kickoffDay(source.from.kickoff)}`
    : null;
  const provenance = !fixture
    ? null
    : source?.kind === 'started'
      ? `Starting XI · ${kickoffDay(source.from.kickoff)}`
      : lastLabel && !canUseLast
        ? lastLabel
        : fixture.finished
          ? 'No lineup recorded'
          : `Kicks off ${kickoffDay(fixture.kickoff)}`;

  return (
    <div className={styles.page}>
      <div className={`g-panel ${styles.board}`}>
        <div className={styles.head}>
          <div className={styles.titleRow}>
            {fixture ? (
              // A match's title is its two sides; choosing one shows that club's XI.
              <div
                className={styles.matchTitle}
                role="radiogroup"
                aria-label="Side"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const next: MatchSide = e.key === 'ArrowLeft' ? 'home' : 'away';
                    setSide(next);
                    e.currentTarget.querySelector<HTMLButtonElement>(`[data-side="${next}"]`)?.focus();
                  }
                }}
              >
                {SIDES.map((s, i) => {
                  const badge = clubBadgePath(fixture[s]);
                  return (
                    <Fragment key={s}>
                      {i === 1 && <span className={styles.matchVs}>vs.</span>}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={side === s}
                        tabIndex={side === s ? 0 : -1}
                        data-side={s}
                        className={`${styles.matchSide} ${side === s ? styles.matchSideOn : ''}`}
                        onClick={() => setSide(s)}
                      >
                        {badge && <img src={badge} alt="" width={30} height={30} className={styles.matchCrest} />}
                        <span>{s === 'home' ? fixture.homeName : fixture.awayName}</span>
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                className={styles.titleInput}
                value={title}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Name Your Lineup"
                aria-label="Lineup name"
              />
            )}
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
                onPointerEnter={() => void prepareImage().catch(() => {})}
                onFocus={() => void prepareImage().catch(() => {})}
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
                <h2 className={styles.railH}>{sideClub ? `${sideClub.name} XI` : 'Starting XI'}</h2>
                <button type="button" className={styles.textBtn} onClick={handleReset} disabled={filledCount === 0}>
                  Clear XI
                </button>
              </div>
              {fixtureOptions.length > 0 && (
                <div className={styles.pickFrom}>
                  <span className="g-label">Match</span>
                  <MatchPicker weeks={fixturesByWeek} value={fixture} onChange={handleSelectFixture} />
                </div>
              )}
              {fixture ? (
                <div className={styles.provenance}>
                  <span className={styles.provenanceText}>{provenance}</span>
                  {edited && (
                    <button type="button" className={styles.textBtn} onClick={handleRestore}>
                      Restore
                    </button>
                  )}
                  {canUseLast && lastLabel && (
                    <button type="button" className={styles.textBtn} onClick={handleUseLast} title={lastLabel}>
                      Use Last XI
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.pickFrom}>
                  <span className="g-label">Pick From</span>
                  <ClubPicker clubs={clubOptions} value={clubFilter} onChange={setClubFilter} ariaLabel="Pick From" />
                </div>
              )}
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
          initialClubFilter={sideClub ? sideClub.slug : clubFilter}
          clubOptions={clubOptions}
          matchOnly={fixture !== null}
        />
      )}
    </div>
  );
}
