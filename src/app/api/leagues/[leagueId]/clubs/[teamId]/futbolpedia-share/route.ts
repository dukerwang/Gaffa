import { NextRequest, NextResponse } from 'next/server';
import { authorizeFutbolpediaClub } from '@/lib/integrations/futbolpediaProxy';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string; teamId: string }>;
}

/**
 * Continue in Futbolpedia: Futbolpedia turns the panel's thread into a shared conversation with
 * this club attached, and the panel opens it there. Futbolpedia keeps the club attached only for
 * the manager who runs it.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { leagueId, teamId } = await params;
  const auth = await authorizeFutbolpediaClub(leagueId, teamId);
  if ('response' in auth) return auth.response;

  let body: { history?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${auth.origin}/api/gaffa/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-futbolpedia-secret': auth.secret },
      body: JSON.stringify({ history: Array.isArray(body.history) ? body.history : [], leagueId, clubId: teamId }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || typeof data?.path !== 'string') {
      return NextResponse.json(
        { error: data?.error || `Futbolpedia error (${upstream.status})` },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }
    // The path only: the panel puts Futbolpedia's public origin in front of it. `auth.origin` is the
    // address this server reaches Futbolpedia on, which a browser may not.
    return NextResponse.json({ path: data.path });
  } catch (err) {
    console.error('[futbolpedia-share]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not reach Futbolpedia' }, { status: 502 });
  }
}
