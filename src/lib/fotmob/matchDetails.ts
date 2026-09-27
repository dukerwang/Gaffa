/**
 * FotMob Premier League fixtures and per-match player stats.
 *
 * Two traps, both found the hard way:
 *
 * - A fixture's `pageUrl` (`/matches/<clubs-slug>/<code>#<matchId>`) names the
 *   PAIRING of clubs, not the match. Requesting it without the `#matchId`
 *   hash returns the most recent meeting of those two clubs, so every past
 *   season silently comes back as this season's fixture. Fetch by match id
 *   instead, and check the id that comes back.
 * - Player stats are grouped in sections (top_stats, attack, defense, duels,
 *   ...) and some titles repeat across sections. They are flattened by title;
 *   a repeated title carries the same figure in each section.
 *
 * `optaId` on each player equals FPL's per-player `code`, which is how
 * FotMob rows join to FPL rows without name matching.
 */

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};
const PREMIER_LEAGUE_ID = 47;

export interface FotmobFixture {
  matchId: number;
  round: number;
  utcTime: string;
  home: { id: number; name: string };
  away: { id: number; name: string };
  finished: boolean;
}

export interface FotmobStat { value: number; total?: number }

export interface FotmobPlayerMatch {
  fotmobId: number;
  /** Opta player id; equals FPL's per-player `code`. */
  optaId: number | null;
  name: string;
  teamId: number;
  isGoalkeeper: boolean;
  /** Stats keyed by FotMob's display title, e.g. "Line breaking passes". */
  stats: Record<string, FotmobStat>;
}

export interface FotmobMatch {
  matchId: number;
  round: number;
  utcTime: string;
  home: { id: number; name: string };
  away: { id: number; name: string };
  players: FotmobPlayerMatch[];
}

function nextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** "2025-26" → "2025-2026", FotMob's season parameter. */
export function fotmobSeasonParam(season: string): string {
  const [start] = season.split('-');
  return `${start}-${Number(start) + 1}`;
}

export async function fetchFotmobFixtures(season: string): Promise<FotmobFixture[]> {
  const url = `https://www.fotmob.com/en-GB/leagues/${PREMIER_LEAGUE_ID}/matches/premier-league?season=${fotmobSeasonParam(season)}`;
  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`FotMob fixtures ${season}: HTTP ${res.status}`);
  const props = nextData(await res.text())?.props?.pageProps;
  const selected = props?.details?.selectedSeason;
  const expected = fotmobSeasonParam(season).replace('-', '/');
  if (selected !== expected) throw new Error(`FotMob returned season ${selected} for ${season}`);
  const all: any[] = props?.fixtures?.allMatches ?? [];
  return all.map((m) => ({
    matchId: Number(m.id),
    round: Number(m.round),
    utcTime: String(m.status?.utcTime ?? ''),
    home: { id: Number(m.home?.id), name: String(m.home?.name) },
    away: { id: Number(m.away?.id), name: String(m.away?.name) },
    finished: m.status?.finished === true,
  }));
}

function flattenStats(sections: any[]): Record<string, FotmobStat> {
  const out: Record<string, FotmobStat> = {};
  for (const sec of sections ?? []) {
    for (const [title, entry] of Object.entries<any>(sec?.stats ?? {})) {
      const s = entry?.stat;
      if (!s || typeof s.value !== 'number') continue;
      out[title] = typeof s.total === 'number' ? { value: s.value, total: s.total } : { value: s.value };
    }
  }
  return out;
}

function parseMatch(payload: any, expectedId: number): FotmobMatch {
  const general = payload?.general;
  const got = Number(general?.matchId);
  if (got !== expectedId) throw new Error(`FotMob returned match ${got} for ${expectedId}`);
  const players = Object.values<any>(payload?.content?.playerStats ?? {}).map((p) => ({
    fotmobId: Number(p.id),
    optaId: p.optaId != null && p.optaId !== '' ? Number(p.optaId) : null,
    name: String(p.name),
    teamId: Number(p.teamId),
    isGoalkeeper: p.isGoalkeeper === true,
    stats: flattenStats(p.stats),
  }));
  return {
    matchId: got,
    round: Number(general.matchRound),
    utcTime: String(general.matchTimeUTCDate ?? ''),
    home: { id: Number(general.homeTeam?.id), name: String(general.homeTeam?.name) },
    away: { id: Number(general.awayTeam?.id), name: String(general.awayTeam?.name) },
    players,
  };
}

/** Fetches one match by id: the JSON endpoint first, the match page as fallback. */
export async function fetchFotmobMatch(matchId: number): Promise<FotmobMatch> {
  const api = await fetch(`https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`, { headers: HEADERS, cache: 'no-store' });
  if (api.ok) {
    try { return parseMatch(await api.json(), matchId); } catch { /* fall through to the page */ }
  }
  const page = await fetch(`https://www.fotmob.com/en-GB/match/${matchId}`, { headers: HEADERS, cache: 'no-store' });
  if (!page.ok) throw new Error(`FotMob match ${matchId}: HTTP ${api.status} (api), ${page.status} (page)`);
  return parseMatch(nextData(await page.text())?.props?.pageProps, matchId);
}
