import type { CrestConfig } from '@/components/crest/types';
import type { MatchState, MatchupView } from '@/lib/matchups/matchupView';
import type { TeamMeta } from '@/lib/matchups/roundView';

export interface TeamLite {
  id: string;
  name: string;
  crest: CrestConfig | null;
  /** null for a Caretaker club. */
  manager: string | null;
  /** The club's identity colour, for the scoreboard ground and the worm. */
  color: string;
}

export interface TieLite {
  id: string;
  a: TeamLite;
  b: TeamLite | null;
  scoreA: number;
  scoreB: number;
  state: MatchState;
  /** Scored detail; null for a tie the page did not need to open. */
  view: MatchupView | null;
}

export type Metas = Record<string, TeamMeta>;
