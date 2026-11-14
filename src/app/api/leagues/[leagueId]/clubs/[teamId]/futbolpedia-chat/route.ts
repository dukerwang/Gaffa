import { NextRequest, NextResponse } from 'next/server';
import { authorizeFutbolpediaClub, panelConversationId } from '@/lib/integrations/futbolpediaProxy';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface Props {
  params: Promise<{ leagueId: string; teamId: string }>;
}

/**
 * Session-authenticated proxy to Futbolpedia's chat for the signed-in manager's own club. Futbolpedia
 * runs its full chat with the club attached and streams newline-delimited JSON events
 * (stage, text, scorecard, done, error), which pass straight through. The manager's id goes along
 * for Futbolpedia's daily turn limit. Read-only: no lineup, bid, or trade writes.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { leagueId, teamId } = await params;
  const auth = await authorizeFutbolpediaClub(leagueId, teamId);
  if ('response' in auth) return auth.response;

  let body: { message?: unknown; history?: unknown; conversationId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message : '';
  if (!message.trim()) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

  // The timeout covers only the wait for Futbolpedia to start answering; once it streams, the
  // reply runs to its end (within maxDuration) instead of being cut mid-answer.
  const started = new AbortController();
  const startTimer = setTimeout(() => started.abort(), 30_000);
  try {
    const upstream = await fetch(`${auth.origin}/api/gaffa/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-futbolpedia-secret': auth.secret },
      body: JSON.stringify({
        message,
        history: Array.isArray(body.history) ? body.history : [],
        leagueId,
        clubId: teamId,
        userId: auth.userId,
        conversationId: panelConversationId(body.conversationId),
        stream: true,
      }),
      signal: started.signal,
    });
    clearTimeout(startTimer);
    if (!upstream.ok || !upstream.body) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: data?.error || `Futbolpedia error (${upstream.status})`,
          // A refused turn says how many are left (0 at the daily limit), so the panel can hand over.
          ...(typeof data?.turnsLeft === 'number' ? { turnsLeft: data.turnsLeft } : {}),
        },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }
    // A Futbolpedia that doesn't stream yet answers with one JSON reply; the panel reads either.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    clearTimeout(startTimer);
    console.error('[futbolpedia-chat]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not reach Futbolpedia' }, { status: 502 });
  }
}
