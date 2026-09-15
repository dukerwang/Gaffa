/**
 * POST /api/leagues/[leagueId]/facilities/upgrade
 *
 * Buys the next Club Facilities slot for the caller's own club. The price,
 * prerequisite and balance checks all happen inside
 * `purchase_facility_upgrade_rpc` (migration 166) under a row lock; this route
 * only establishes who the caller is and which club is theirs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FACILITY_KEYS, type FacilityKey } from '@/lib/facilities/facilities';

interface Props {
  params: Promise<{ leagueId: string }>;
}

const STATUS_BY_CODE: Record<string, number> = {
  TEAM_NOT_FOUND: 404,
  UNKNOWN_FACILITY: 400,
  FULLY_BUILT: 409,
  INSUFFICIENT_BALANCE: 400,
};

export async function POST(req: NextRequest, { params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { facility?: string } | null;
  const facility = body?.facility as FacilityKey | undefined;
  if (!facility || !FACILITY_KEYS.includes(facility)) {
    return NextResponse.json({ error: 'Unknown facility.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: team } = await admin
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!team) return NextResponse.json({ error: 'You do not have a club in this league.' }, { status: 403 });

  const { data, error } = await admin.rpc('purchase_facility_upgrade_rpc', {
    p_team_id: team.id,
    p_facility: facility,
  });

  if (error) {
    console.error('[facilities/upgrade] rpc failed', error);
    return NextResponse.json({ error: 'Could not complete the purchase. Try again.' }, { status: 500 });
  }

  const result = data as
    | { success: true; facility: FacilityKey; slots: number; cost: number; balance: number }
    | { success: false; code: string; error: string };

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: STATUS_BY_CODE[result.code] ?? 400 },
    );
  }

  return NextResponse.json(result);
}
