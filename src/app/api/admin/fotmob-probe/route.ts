/**
 * GET /api/admin/fotmob-probe
 *
 * TEMPORARY: checks whether FotMob answers requests from Vercel's servers
 * before the stats sync is allowed to depend on it (Transfermarkt and SoFIFA
 * both block cloud IPs). Remove once the answer is known.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchFotmobFixtures, fetchFotmobMatch } from '@/lib/fotmob/matchDetails';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function raw(url: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
    const body = await res.text();
    return {
      url, status: res.status, ms: Date.now() - t0, bytes: body.length,
      cfMitigated: res.headers.get('cf-mitigated'), server: res.headers.get('server'),
      looksBlocked: /just a moment|cf-challenge|attention required/i.test(body.slice(0, 5000)),
    };
  } catch (e) {
    return { url, error: (e as Error).message, ms: Date.now() - t0 };
  }
}

async function timed<T>(fn: () => Promise<T>) {
  const t0 = Date.now();
  try { return { ok: true as const, ms: Date.now() - t0, value: await fn() }; }
  catch (e) { return { ok: false as const, ms: Date.now() - t0, error: (e as Error).message }; }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fixtures = await timed(() => fetchFotmobFixtures('2026-27'));
  const finished = fixtures.ok ? fixtures.value.filter((f) => f.finished) : [];
  const recentId = finished[finished.length - 1]?.matchId ?? 5795455;
  const matches = await Promise.all([4813374, recentId].map((id) => timed(() => fetchFotmobMatch(id))));

  return NextResponse.json({
    region: process.env.VERCEL_REGION ?? null,
    raw: await Promise.all([
      raw('https://www.fotmob.com/api/data/matchDetails?matchId=4813374'),
      raw('https://www.fotmob.com/en-GB/leagues/47/matches/premier-league?season=2026-2027'),
      raw('https://www.fotmob.com/en-GB/match/4813374'),
    ]),
    fixtures: fixtures.ok ? { ms: fixtures.ms, total: fixtures.value.length, finished: finished.length } : fixtures,
    matches: matches.map((m) => m.ok ? {
      ms: m.ms, matchId: m.value.matchId, utcTime: m.value.utcTime,
      teams: `${m.value.home.name} v ${m.value.away.name}`, players: m.value.players.length,
      withLineBreaking: m.value.players.filter((p) => p.stats['Line breaking passes']).length,
      withAerials: m.value.players.filter((p) => p.stats['Aerial duels won']).length,
      penaltyGoals: m.value.players.reduce((s, p) => s + p.penaltyGoals, 0),
    } : m),
  });
}
