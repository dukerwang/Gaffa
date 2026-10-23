import type { SelectItem } from '@/components/ui/Select';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import Portrait from '@/components/players/Portrait';
import { clubBadgePath } from '@/lib/clubs/registry';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import styles from './domainItems.module.css';

/**
 * Options for the kit Select that carry a club's badge, a Gaffa club's crest
 * or a player's portrait, built one way everywhere they appear (filter bars,
 * the commissioner handover, the player-to-drop pickers).
 */

/** Holds a crest-less option ("All clubs") in line with the crested ones. */
export function SelectSpacer({ width = 20 }: { width?: number }) {
  return <span className={styles.spacer} style={{ width }} aria-hidden="true" />;
}

/**
 * A plain option, kept in line with its siblings: 20px beside crests, 44px
 * (a small portrait) beside players.
 */
export function plainItem<T extends string>(value: T, label: string, width?: number): SelectItem<T> {
  return { value, label, leading: <SelectSpacer width={width} /> };
}

/** The width a player option's portrait takes, for plainItem beside them. */
export const PORTRAIT_WIDTH = 44;

/** A Premier League club by name, with its badge. */
export function plClubItem(club: string, value: string = club): SelectItem {
  const src = clubBadgePath(club);
  return {
    value,
    label: club,
    leading: src ? <img src={src} alt="" className={styles.badge} /> : <SelectSpacer />,
  };
}

/** A Gaffa club with its crest. Missing crests draw CrestBadge's default. */
export function gaffaClubItem(
  value: string,
  label: string,
  crest: CrestConfig | null | undefined,
  description?: string,
): SelectItem {
  return {
    value,
    label,
    description,
    leading: <CrestBadge config={crest ?? null} size={20} teamName={label} interactive={false} />,
  };
}

interface PickablePlayer {
  id: string;
  name: string;
  web_name?: string | null;
  primary_position?: string | null;
  pl_team?: string | null;
  market_value?: number | string | null;
  photo_url?: string | null;
  photo_version?: string | null;
  portrait_head_top_pct?: number | null;
  portrait_head_width_pct?: number | null;
}

/** A player picked by face: portrait, full name, then position · club · value. */
export function playerItem(p: PickablePlayer): SelectItem {
  const name = getPlayerDisplayName(p, 'full');
  return {
    value: p.id,
    label: name,
    description: [p.primary_position, p.pl_team, `€${Number(p.market_value) || 0}m`].filter(Boolean).join(' · '),
    leading: (
      <Portrait
        photoUrl={p.photo_url}
        photoVersion={p.photo_version}
        name={name}
        club={p.pl_team}
        size="sm"
        headTopPct={p.portrait_head_top_pct}
        headWidthPct={p.portrait_head_width_pct}
      />
    ),
  };
}
