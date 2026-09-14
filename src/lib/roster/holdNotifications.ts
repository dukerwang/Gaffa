/**
 * The one "Player Held" notice, sent by every path that can hold a player:
 * loan expiry, a loanee back from abroad, a retained return and an auction won
 * with no room. Keeping it in one place keeps the rules it states (what's
 * frozen, when the lineup locks, which bids came off) identical everywhere.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications/createNotification';
import type { HeldEntry } from './holds';

export interface WithdrawnBid {
  claim_id: string;
  player_id: string;
  player_name: string | null;
  faab_bid: number;
}

const WHY: Record<HeldEntry['heldSource'], string> = {
  loan_return: 'is back from his loan',
  loan_abroad_return: 'is back in the Premier League from his loan',
  retained_return: 'is back in the Premier League, and you hold his rights',
  auction: 'is yours from an auction nobody with room bid on',
};

function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  }).format(new Date(iso)) + ' UK time';
}

export async function notifyPlayerHeld(
  admin: SupabaseClient,
  args: {
    leagueId: string;
    teamId: string;
    playerName: string;
    source: HeldEntry['heldSource'];
    withdrawnBids?: WithdrawnBid[] | null;
  },
): Promise<void> {
  try {
    const [{ data: team }, { data: lockAt }] = await Promise.all([
      admin.from('teams').select('user_id').eq('id', args.teamId).single(),
      admin.rpc('held_lineup_lock_at', { p_team_id: args.teamId }),
    ]);
    if (!team?.user_id) return;

    const bids = (args.withdrawnBids ?? []).filter((b) => b.player_name);
    const parts = [
      `**${args.playerName}** ${WHY[args.source]}, but your squad is full, so he's held off it.`,
      `Until you activate or drop him, you can't bid, sign, borrow or take on extra players in a trade.`,
      typeof lockAt === 'string'
        ? `If he's still held at ${formatKickoff(lockAt)}, your lineup locks as well.`
        : `If he's still held when the next gameweek kicks off, your lineup locks as well.`,
    ];
    if (bids.length > 0) {
      parts.push(`Your bids on ${bids.map((b) => `**${b.player_name}**`).join(', ')} were withdrawn.`);
    }

    await createNotification(admin, {
      kind: 'club',
      leagueId: args.leagueId,
      userId: team.user_id,
      title: 'Player Held',
      content: parts.join(' '),
      pushBody: `${args.playerName} is held. Your squad is full.`,
      url: `/league/${args.leagueId}/team/roster`,
    });
  } catch (err) {
    console.error('[holds] Player Held notification failed:', err);
  }
}
