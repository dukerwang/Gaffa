import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { futbolpediaOrigin } from '@/lib/integrations/futbolpediaChat';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface Props {
  params: Promise<{ leagueId: string; teamId: string }>;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Session-authenticated proxy to Futbolpedia Gaffa-mode chat.
 * Uses the logged-in owner's club — callers do not paste league/club IDs.
 * Read-only: no lineup, bid, or trade writes.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { leagueId, teamId } = await params;
  if (!UUID.test(leagueId) || !UUID.test(teamId)) {
    return NextResponse.json({ error: 'Invalid league or club' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: team } = await admin
    .from('teams')
    .select('id, user_id, league_id')
    .eq('id', teamId)
    .eq('league_id', leagueId)
    .maybeSingle();
  if (!team) return NextResponse.json({ error: 'Club not found' }, { status: 404 });
  if (team.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const origin = futbolpediaOrigin();
  const secret = process.env.FUTBOLPEDIA_READ_SECRET;
  if (!origin || !secret) {
    return NextResponse.json(
      { error: 'Futbolpedia chat is not configured (FUTBOLPEDIA_URL / FUTBOLPEDIA_READ_SECRET)' },
      { status: 503 },
    );
  }

  let body: {
    message?: unknown;
    history?: unknown;
    speed?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message : '';
  if (!message.trim()) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${origin}/api/gaffa/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-futbolpedia-secret': secret,
      },
      body: JSON.stringify({
        message,
        history: Array.isArray(body.history) ? body.history : [],
        leagueId,
        clubId: teamId,
        speed: body.speed === 'fast' ? 'fast' : 'default',
      }),
      signal: AbortSignal.timeout(110_000),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error || `Futbolpedia error (${upstream.status})` },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('[futbolpedia-chat]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not reach Futbolpedia' }, { status: 502 });
  }
}
