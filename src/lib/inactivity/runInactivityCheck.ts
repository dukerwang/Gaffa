import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications/createNotification';
import { sendEmailToUsers } from '@/lib/email/sendEmailToUsers';
import { getInactiveManagerEmail, getInactivityWarningEmail } from '@/lib/email/templates';

/**
 * The inactivity alert (migration 171, spec 2026-10-04-expansion-and-takeovers).
 *
 * A manager who hasn't opened their league for five full gameweeks is warned.
 * If they still haven't after one more gameweek, the commissioner is told.
 * Nothing happens to the club: removing the manager is the commissioner's call.
 * Opening the league at any point resets both.
 */
export const WARN_AFTER_GAMEWEEKS = 5;
export const REPORT_AFTER_GAMEWEEKS = 6;

export interface InactiveMember {
  league_id: string;
  league_name: string;
  commissioner_id: string;
  user_id: string;
  username: string | null;
  team_id: string;
  team_name: string;
  last_active_at: string;
  inactive_gameweeks: number;
  gameweeks_since_warning: number | null;
  warned_at: string | null;
  reported_at: string | null;
}

export type InactivityAction = 'warn' | 'report' | null;

/**
 * What to do about one manager today. The commissioner is only told once the
 * manager has been warned and a full gameweek has passed since, so nobody is
 * reported without a chance to respond, even if the warning went out late. A
 * commissioner who goes quiet is warned like anyone else, but there's nobody
 * above them to tell.
 */
export function decideInactivityAction(m: InactiveMember): InactivityAction {
  if (m.inactive_gameweeks < WARN_AFTER_GAMEWEEKS) return null;
  if (!m.warned_at) return 'warn';
  if (m.reported_at) return null;
  if (m.user_id === m.commissioner_id) return null;
  if (m.inactive_gameweeks >= REPORT_AFTER_GAMEWEEKS && (m.gameweeks_since_warning ?? 0) >= 1) return 'report';
  return null;
}

export interface InactivityReport {
  warned: string[];
  reported: string[];
}

/** Runs the daily check across every active league. */
export async function runInactivityCheck(admin: SupabaseClient): Promise<InactivityReport> {
  const { data, error } = await admin.rpc('inactive_league_members', { p_min_gameweeks: WARN_AFTER_GAMEWEEKS });
  if (error) throw error;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gaffa.live';
  const report: InactivityReport = { warned: [], reported: [] };

  for (const m of (data ?? []) as InactiveMember[]) {
    const action = decideInactivityAction(m);
    if (!action) continue;
    const managerName = m.username ?? 'A manager';

    if (action === 'warn') {
      const leagueUrl = `${baseUrl}/league/${m.league_id}`;
      await createNotification(admin, {
        leagueId: m.league_id,
        userId: m.user_id,
        kind: 'club',
        title: 'Inactivity Warning',
        content: `You haven't opened ${m.league_name} for ${m.inactive_gameweeks} gameweeks. Open it before the next gameweek finishes, or your commissioner will be told ${m.team_name} looks inactive.`,
        url: `/league/${m.league_id}`,
      });
      await sendEmailToUsers(admin, {
        userIds: [m.user_id],
        kind: 'club',
        subject: 'Inactivity Warning',
        html: getInactivityWarningEmail(m.league_name, m.team_name, leagueUrl),
        leagueId: m.league_id,
      });
      await markMember(admin, m, { inactivity_warned_at: new Date().toISOString() });
      report.warned.push(`${m.league_name}: ${managerName}`);
      continue;
    }

    const settingsUrl = `${baseUrl}/league/${m.league_id}/settings`;
    await createNotification(admin, {
      leagueId: m.league_id,
      userId: m.commissioner_id,
      kind: 'club',
      title: 'Inactive Manager',
      content: `${managerName} hasn't opened the league for ${m.inactive_gameweeks} gameweeks and didn't respond to a warning. Remove them in Settings to hand ${m.team_name} to the Caretaker, or leave them in place.`,
      url: `/league/${m.league_id}/settings`,
    });
    await sendEmailToUsers(admin, {
      userIds: [m.commissioner_id],
      kind: 'club',
      subject: 'Inactive Manager',
      html: getInactiveManagerEmail(m.league_name, managerName, m.team_name, m.inactive_gameweeks, settingsUrl),
      leagueId: m.league_id,
    });
    await markMember(admin, m, { inactivity_reported_at: new Date().toISOString() });
    report.reported.push(`${m.league_name}: ${managerName}`);
  }

  return report;
}

async function markMember(admin: SupabaseClient, m: InactiveMember, fields: Record<string, string>) {
  const { error } = await admin
    .from('league_members')
    .update(fields)
    .eq('league_id', m.league_id)
    .eq('user_id', m.user_id);
  if (error) console.error('[inactivity] failed to record notice:', error.message);
}
