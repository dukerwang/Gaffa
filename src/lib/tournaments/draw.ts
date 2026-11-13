/**
 * Cup draws and tie decisions, as pure functions.
 *
 * The League Cup is drawn round by round after its seeded first round, and a
 * small league's Consolation Cup is drawn once its Champions Cup losers are in
 * (spec: docs/superpowers/specs/2026-10-25-cups-redesign-design.md). The
 * pairing lives here so it can be tested with a seeded random source; the
 * write goes through the apply_cup_draw RPC, which only guards and records it.
 */
import { resolveTiebreaker } from '@/lib/tournaments/engine';

/** A club in the draw. `rank` is its league_standings.rank at the moment of the draw; 999 if unranked. */
export interface Entrant {
  teamId: string;
  rank: number;
}

/** One tie of a drawn round. `b` is null for a bye. */
export interface DrawnTie {
  a: string;
  b: string | null;
}

const better = (x: Entrant, y: Entrant) => x.rank - y.rank || (x.teamId < y.teamId ? -1 : x.teamId > y.teamId ? 1 : 0);

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draws `entrants` into `ties` ties, returned in bracket_position order.
 *
 * When there are fewer entrants than places, the best-ranked take the byes.
 * The rest are paired at random, and in every tie the better-ranked club is
 * `a`, so the last-resort tie-break (team_a wins a dead-level tie) means
 * "higher league position" in a drawn round.
 */
export function pairDraw(entrants: Entrant[], ties: number, random: () => number): DrawnTie[] {
  if (entrants.length > ties * 2 || entrants.length < ties) {
    throw new Error(`pairDraw: ${entrants.length} entrants cannot fill ${ties} ties`);
  }
  const ranked = [...entrants].sort(better);
  const byes = ties * 2 - entrants.length;
  const drawn: DrawnTie[] = ranked.slice(0, byes).map((e) => ({ a: e.teamId, b: null }));
  const pool = shuffle(ranked.slice(byes), random);
  for (let i = 0; i < pool.length; i += 2) {
    const [x, y] = better(pool[i], pool[i + 1]) <= 0 ? [pool[i], pool[i + 1]] : [pool[i + 1], pool[i]];
    drawn.push({ a: x.teamId, b: y.teamId });
  }
  return shuffle(drawn, random);
}

/**
 * Whether a Champions Cup loser in this round drops into a small league's
 * Consolation Cup. In 4–6 club leagues every club enters the Champions Cup and
 * the Consolation Cup is filled from its losers; larger leagues seed the
 * Consolation Cup from the bottom of the table instead.
 */
export function consolationFeeds(clubCount: number, roundName: string): boolean {
  const name = roundName.toLowerCase();
  const quarter = name.includes('quarter');
  const semi = name.includes('semi');
  if (clubCount === 5 || clubCount === 6) return quarter || semi;
  if (clubCount === 4) return semi;
  return false;
}

export type DecidedBy = 'score' | 'best_performer' | 'position';

/**
 * The winner of a finished cup tie and how it was decided: on score, then on
 * the best individual performer, then on position (team_a, the better seed or
 * the higher-placed club at the draw).
 */
export function decideTie(i: {
  teamA: string;
  teamB: string;
  totalA: number;
  totalB: number;
  playersA: { playerId: string; points: number }[];
  playersB: { playerId: string; points: number }[];
}): { winnerId: string; decidedBy: DecidedBy } {
  if (i.totalA > i.totalB) return { winnerId: i.teamA, decidedBy: 'score' };
  if (i.totalB > i.totalA) return { winnerId: i.teamB, decidedBy: 'score' };
  const byPerformer = resolveTiebreaker(i.playersA, i.playersB, i.teamA, i.teamB);
  if (byPerformer) return { winnerId: byPerformer, decidedBy: 'best_performer' };
  return { winnerId: i.teamA, decidedBy: 'position' };
}
