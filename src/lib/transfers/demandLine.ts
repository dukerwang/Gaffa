/**
 * "Who wants this player?" — the line a listing gains from the Targets board.
 *
 * This is the single most useful thing the feature produces for a seller, and
 * the reason Targets is not just a tag. `roster_entries.on_trade_block` (029)
 * failed because nothing ever honoured it; what makes this different is that
 * demand shows up ON the supply, where somebody deciding whether to sell is
 * already looking.
 *
 * Two shapes, and the named one always wins. A club that has named your player
 * has made a specific statement about him; a club looking for a left-back has
 * made a statement about a slot he happens to fill. Reporting the second while
 * the first exists would bury the better news.
 *
 * Counts are spelled out to three ("One club", "Two clubs") and numeric after,
 * which is the Google style rule and also just how the line reads aloud.
 */

import { roleArticle } from '@/lib/scoring/perfBand';
import type { TargetStanceInput } from './targetStance';

export interface DemandTarget extends TargetStanceInput {
  team_id: string;
  team_name: string | null;
  target_kind: 'player' | 'profile';
  player_id: string | null;
  position: string | null;
}

export interface DemandPlayer {
  id: string;
  primary_position?: string | null;
  secondary_positions?: string[] | null;
}

export interface DemandLine {
  /** The headline — who wants him. */
  title: string;
  /** What they'd give, in one clause. Empty when nobody stated anything. */
  detail: string;
  /** How many clubs the line is reporting. */
  clubs: number;
  /** True when at least one club named this player rather than his position. */
  named: boolean;
}

const WORDS = ['no', 'One', 'Two', 'Three'];

function clubCount(n: number): string {
  return n <= 3 ? `${WORDS[n]} club${n === 1 ? '' : 's'}` : `${n} clubs`;
}

/** Lowercase form, for the middle of a sentence. */
function clubCountLower(n: number): string {
  return n <= 3 ? `${WORDS[n].toLowerCase()} club${n === 1 ? '' : 's'}` : `${n} clubs`;
}

/**
 * What this group of clubs is offering, as one clause.
 *
 * Deliberately not a list of every stance: a seller reading a card wants to
 * know whether there is cash in the room, and the detail of who would swap
 * what belongs in the conversation that follows, not on the card.
 */
function detailFor(targets: DemandTarget[], single: boolean): string {
  if (targets.length === 1) {
    const t = targets[0];
    const named = t.budget != null && t.budget > 0;
    if (t.open_to_sale && !t.open_to_trade && !t.open_to_loan) {
      return named ? `They'll pay cash, up to €${t.budget}m` : "They'll pay cash";
    }
    if (t.open_to_trade && !t.open_to_sale && !t.open_to_loan) return "They're offering players";
    if (t.open_to_loan && !t.open_to_sale && !t.open_to_trade) return "They'd take him on loan";
    return named ? `Open to approaches, up to €${t.budget}m` : 'Open to approaches';
  }

  const cash = targets.filter((t) => t.open_to_sale).length;
  const players = targets.filter((t) => t.open_to_trade).length;

  const parts: string[] = [];
  if (cash > 0) parts.push(`${clubCountLower(cash)} will pay cash`);
  if (players > 0) parts.push(`${clubCountLower(players)} ${players === 1 ? 'is' : 'are'} offering players`);
  if (parts.length === 0) return 'All open to approaches';

  // Sentence case: the first clause starts the sentence.
  const line = parts.join(', ');
  void single;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * The demand line for one player, or null when nobody is asking.
 *
 * `targets` should be the set the reader is allowed to see — the model already
 * scopes it that way, and this function does no filtering of its own beyond
 * excluding the holder's own targets. `excludeTeamId` is the club that holds
 * him: a seller must never be told his own search answers his own listing.
 */
export function demandLine(
  targets: readonly DemandTarget[],
  player: DemandPlayer,
  excludeTeamId?: string | null,
): DemandLine | null {
  const eligible = targets.filter((t) => t.team_id !== excludeTeamId);

  const named = eligible.filter((t) => t.target_kind === 'player' && t.player_id === player.id);

  if (named.length > 0) {
    // One club per statement: a club cannot hold two live named targets on the
    // same player (the partial unique index in 179 sees to that), so this is a
    // club count already.
    const who = named.length === 1
      ? `${named[0].team_name ?? 'A club'} want him`
      : `${clubCount(named.length)} want him`;
    return { title: who, detail: detailFor(named, named.length === 1), clubs: named.length, named: true };
  }

  const slots = new Set(
    [player.primary_position, ...(player.secondary_positions ?? [])].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    ),
  );

  const profiles = eligible.filter(
    (t) => t.target_kind === 'profile' && t.position && slots.has(t.position),
  );

  if (profiles.length === 0) return null;

  // Name the position the LISTED player actually plays, not whichever profile
  // happened to sort first — "looking for a left-back" has to be true of him.
  const spoken = player.primary_position && profiles.some((t) => t.position === player.primary_position)
    ? player.primary_position
    : profiles[0].position;

  const clubs = new Set(profiles.map((t) => t.team_id)).size;

  return {
    title: `${clubCount(clubs)} ${clubs === 1 ? 'is' : 'are'} looking for ${roleArticle(spoken)}`,
    detail: detailFor(profiles, clubs === 1),
    clubs,
    named: false,
  };
}
