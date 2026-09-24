/**
 * src/lib/outlook/labels.ts
 *
 * Display labels for a Futbolpedia outlook's sidecar values. One copy, read by
 * the player hub, the players index and the player card's Scouting view: these
 * were duplicated per page, and a third copy is how they drift.
 */

export const QUALITY_LABEL: Record<string, string> = {
  elite: 'Elite',
  high: 'High',
  solid: 'Solid',
  squad: 'Squad',
};

export const FACET_LABEL: Record<string, string> = {
  nailed: 'Nailed',
  likely_starter: 'Likely starter',
  rotation_risk: 'Rotation risk',
  fringe: 'Fringe',
  emerging: 'Emerging',
  peak: 'Peak',
  plateau: 'Plateau',
  decline_risk: 'Decline risk',
  unknown: 'Unknown',
  cornerstone: 'Cornerstone',
  long_term_hold: 'Long-term hold',
  win_now: 'Win now',
  declining_asset: 'Declining asset',
  stable: 'Stable',
  recent_pl_arrival: 'New to the league',
  linked_exit: 'Linked with an exit',
  confirmed_exit: 'Leaving',
  linked_pl_move: 'Linked with a move',
  injury_prone: 'Injury prone',
  minutes_competition: 'Minutes competition',
  contract_year: 'Contract year',
  tactical_misfit: 'Tactical misfit',
  penalties: 'Penalties',
  direct_free_kicks: 'Direct free kicks',
  corners_wide: 'Corners',
};

/** A sidecar value as display text, falling back to the value itself. */
export function humanise(value: string): string {
  return FACET_LABEL[value] ?? value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
