/** Caption under Futbolpedia in the channel list. Not a manager DM. */
export const FUTBOLPEDIA_ASSISTANT_CAPTION = 'Ask about a trade, XI, or the board';

/**
 * Clubs top-bar routes: own roster, rival club pages, and the team pitch.
 * Opening league chat from these should land on Futbolpedia, not Lobby.
 */
export function isClubChatContext(pathname: string | null | undefined, leagueId: string): boolean {
  if (!pathname || !leagueId) return false;
  const base = `/league/${leagueId}`;
  return pathname === `${base}/team` || pathname.startsWith(`${base}/team/`) || pathname.startsWith(`${base}/clubs/`);
}
