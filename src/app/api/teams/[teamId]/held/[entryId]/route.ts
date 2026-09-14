/**
 * POST /api/teams/[teamId]/held/[entryId]  { target: 'bench' | 'taxi' | 'ir' }
 *
 * Activate a held player: move him off hold into reserves, the academy or IR
 * (held players spec R5–R6). Nothing activates a held player automatically.
 *
 * Closed while a gameweek is under way, from its first kickoff to its last
 * (R6). Room and eligibility are checked by activate_held_rpc under lock.
 *
 * To give him up instead: drop him (normal severance), or Decline a held
 * retained return for nothing via /api/leagues/[leagueId]/departures/[decisionId].
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isGameweekInProgress } from '@/lib/roster/holds';

interface Props {
  params: Promise<{ teamId: string; entryId: string }>;
}

const TARGETS = ['bench', 'taxi', 'ir'] as const;
type Target = (typeof TARGETS)[number];

const REFUSALS: Record<string, { status: number; error: string }> = {
  NO_ROOM: { status: 409, error: 'Your squad is full. Drop or move a player out first.' },
  NOT_ACADEMY_ELIGIBLE: { status: 400, error: 'He’s too old for the academy.' },
  ACADEMY_FULL: { status: 409, error: 'Your academy is full.' },
  NOT_IR_ELIGIBLE: { status: 400, error: 'He isn’t injured, so he can’t go on IR.' },
  IR_FULL: { status: 409, error: 'Your IR places are full.' },
  NOT_HELD: { status: 409, error: 'That player isn’t held.' },
  HELD_NOT_FOUND: { status: 404, error: 'Player not found.' },
};

export async function POST(req: NextRequest, { params }: Props) {
  const { teamId, entryId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const target = body?.target as Target | undefined;
  if (!target || !TARGETS.includes(target)) {
    return NextResponse.json({ error: `target must be one of: ${TARGETS.join(', ')}` }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: team } = await admin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!team) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: entry } = await admin
    .from('roster_entries')
    .select('id, team_id, status')
    .eq('id', entryId)
    .maybeSingle();
  if (!entry || entry.team_id !== teamId) {
    return NextResponse.json({ error: 'Player not found.' }, { status: 404 });
  }

  if (await isGameweekInProgress(admin)) {
    return NextResponse.json(
      { error: 'You can activate him once this gameweek’s last match has kicked off.' },
      { status: 409 },
    );
  }

  const { data, error } = await admin.rpc('activate_held_rpc', { p_entry_id: entryId, p_target: target });
  if (error) {
    const code = Object.keys(REFUSALS).find((c) => error.message.includes(c));
    if (code) return NextResponse.json({ error: REFUSALS[code].error, code }, { status: REFUSALS[code].status });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = (data as { new_status: string }[] | null)?.[0];
  return NextResponse.json({ ok: true, status: row?.new_status ?? target });
}
