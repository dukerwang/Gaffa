/**
 * Gaffa — "Did this player leave on loan, or for good?"
 *
 * FPL marks a loan out of the Premier League and a permanent sale identically:
 * `status: 'u'`. The only thing separating them is the free-text `news` field,
 * which in practice follows two fixed shapes:
 *
 *   "Has joined Juventus on loan for the rest of the season"
 *   "Has joined Al Hilal permanently"
 *
 * A loan gets no Release/Retain decision. The player is held off the roster
 * and rejoins his holder's squad when he is back (migration 160). Everything
 * this module cannot classify confidently falls through to the ordinary
 * decision, which is the safe direction: a real departure mistaken for a loan
 * would hold a player who is never coming back, with no compensation offered.
 */

import { looksLikeSamePlayer, type FplElement } from '@/lib/players/plPresence';

const LOAN = /\bon\s+(?:a\s+)?(?:season[-\s]long\s+|short[-\s]term\s+)?loan\b/i;
const PERMANENT = /\bpermanent(?:ly)?\b/i;
const JOINED_CLUB = /\bjoined\s+(.+?)\s+on\s+(?:a\s+)?(?:season[-\s]long\s+|short[-\s]term\s+)?loan\b/i;

export interface LoanAbroad {
  /** The club he joined, when the news names one. Display only. */
  club: string | null;
}

/** Classifies FPL news text. Null unless it plainly describes a loan. */
export function parseLoanNews(news: string | null | undefined): LoanAbroad | null {
  const text = (news ?? '').trim();
  if (!text || !LOAN.test(text) || PERMANENT.test(text)) return null;
  const club = JOINED_CLUB.exec(text)?.[1]?.trim() ?? null;
  return { club: club || null };
}

/**
 * Finds the live FPL element saying this player is out on loan.
 *
 * Keyed on `fpl_id` and confirmed by name, because element ids are reassigned
 * every season: an id alone can point at a different person after the rollover,
 * and a stored `fpl_news` can be a year stale for a player FPL has dropped from
 * the bootstrap entirely. Only an element FPL is publishing right now counts.
 */
export function findLoanAbroad(
  player: { fpl_id: number | null; name: string },
  elements: FplElement[],
): LoanAbroad | null {
  if (player.fpl_id == null) return null;
  const el = elements.find((e) => e.id === player.fpl_id);
  if (!el || el.status !== 'u') return null;
  if (!looksLikeSamePlayer(player.name, el)) return null;
  return parseLoanNews(el.news);
}
