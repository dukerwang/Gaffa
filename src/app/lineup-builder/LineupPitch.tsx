'use client';

import type { Formation, GranularPosition, Player } from '@/types';
import { FORMATION_SLOTS } from '@/types';
import Portrait from '@/components/players/Portrait';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { POS_COLOR } from '@/lib/positions/spine';
import styles from './lineup-builder.module.css';

interface Props {
  formation: Formation;
  assignments: Record<number, Player | null>;
  onSelectSlot: (slotIndex: number) => void;
}

type PitchZone = 'ATT' | 'AMZ' | 'CMZ' | 'DMZ' | 'WBZ' | 'DEF' | 'GK';
const ZONE_ORDER: PitchZone[] = ['ATT', 'AMZ', 'CMZ', 'DMZ', 'WBZ', 'DEF', 'GK'];

function getZone(pos: GranularPosition, formation?: Formation): PitchZone {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'DM') return 'DMZ';
  if (pos === 'AM') return 'AMZ';
  if (pos === 'LWB' || pos === 'RWB') {
    if (formation?.startsWith('3-')) return 'CMZ';
    return 'WBZ';
  }
  if (pos === 'CM') return 'CMZ';
  return 'ATT';
}

export default function LineupPitch({ formation, assignments, onSelectSlot }: Props) {
  // SAFETY: FORMATION_SLOTS defines exactly 11 granular positions for every supported formation.
  const slots = FORMATION_SLOTS[formation] as GranularPosition[];

  type SlotEntry = { slotIndex: number; pos: GranularPosition };
  interface ZonedSlots {
    ATT: SlotEntry[];
    AMZ: SlotEntry[];
    CMZ: SlotEntry[];
    DMZ: SlotEntry[];
    WBZ: SlotEntry[];
    DEF: SlotEntry[];
    GK: SlotEntry[];
  }

  const zonedSlots: ZonedSlots = {
    ATT: [],
    AMZ: [],
    CMZ: [],
    DMZ: [],
    WBZ: [],
    DEF: [],
    GK: [],
  };

  slots.forEach((pos, slotIndex) => {
    const zone = getZone(pos, formation);
    zonedSlots[zone].push({ slotIndex, pos });
  });

  const activeZones = ZONE_ORDER.filter((z) => zonedSlots[z].length > 0);

  return (
    <div className={styles.pitchWrapper}>
      <div className={styles.pitchContainer}>
        <div className={styles.pitchField}>
          {/* Pitch Field Markings */}
          <div className={styles.pitchTopBox} />
          <div className={styles.pitchHalfLine} />
          <div className={styles.pitchCenterCircle} />
          <div className={styles.pitchBottomBox} />

          {/* Zones */}
          <div className={styles.pitchZones}>
            {activeZones.map((zone) => {
              const rowSlots = zonedSlots[zone];
              return (
                <div key={zone} className={styles.pitchRow}>
                  {rowSlots.map(({ slotIndex, pos }) => {
                    const player = assignments[slotIndex];
                    const isOop = !!player && player.primary_position !== pos;
                    const badgeBg = POS_COLOR[pos] || '#7B56B9';

                    return (
                      <button
                        key={slotIndex}
                        type="button"
                        className={styles.nodeWrapper}
                        onClick={() => onSelectSlot(slotIndex)}
                        aria-label={player ? `Edit ${pos}: ${player.name}` : `Select player for ${pos}`}
                      >
                        <div className={`${styles.nodeAvatar} ${!player ? styles.emptyAvatar : ''}`}>
                          {player ? (
                            <Portrait
                              photoUrl={player.photo_url}
                              name={player.name}
                              club={player.pl_team}
                              size="sm"
                              headTopPct={player.portrait_head_top_pct}
                              headWidthPct={player.portrait_head_width_pct}
                              photoVersion={player.photo_version}
                            />
                          ) : (
                            <span>+</span>
                          )}

                          {/* Slot Position Tag */}
                          <span className={styles.nodeSlotPos} style={{ backgroundColor: badgeBg }}>
                            {pos}
                          </span>

                          {/* Out-Of-Position Tag */}
                          {isOop && player?.primary_position && (
                            <span className={styles.nodeOopBadge} title={`Natural position: ${player.primary_position}`}>
                              {player.primary_position}
                            </span>
                          )}
                        </div>

                        {/* Name plate */}
                        <div className={styles.nodePlate}>
                          {player ? (
                            <span className={styles.nodeName}>
                              {getPlayerDisplayName(player, 'initial_last')}
                            </span>
                          ) : (
                            <span className={styles.nodeEmptyLabel}>Add {pos}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
