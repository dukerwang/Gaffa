import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveClub } from '@/lib/clubs/registry';
import { fetchAllPagesOrThrow } from '@/lib/supabase/pagination';

/**
 * Starting lineups as they stood, from the Premier League's own match feed
 * (footballapi.pulselive.com, the API behind premierleague.com).
 *
 * FPL says who started; this says where. Each team list carries a formation
 * label and its players in lines, goalkeeper first, each line listed RIGHT TO
 * LEFT (checked against known sides: van de Ven last in Spurs' back three,
 * Dasilva last in Coventry's back four). They are stored left to right.
 *
 * Players are matched by Opta id: the feed gives each one as "p460842", and
 * that number is the code in our PL photo URLs (.../110x140/460842.png).
 */

const PL = 'https://footballapi.pulselive.com/football';
const HEADERS = { Origin: 'https://www.premierleague.com', Referer: 'https://www.premierleague.com/' };

interface PlTeamRef { team: { id: number; name: string; club?: { name?: string; shortName?: string } } }
interface PlFixture { id: number; gameweek?: { gameweek?: number }; teams: PlTeamRef[]; status: string }
interface PlTeamList {
  teamId: number;
  formation?: { label?: string; players?: number[][] };
  lineup?: { id: number; altIds?: { opta?: string } }[];
}

async function plGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PL}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`pulselive ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

/** The feed's id for a Gaffa season string ("2026-27" is labelled "...2026/2027" or "2026/27"). */
async function compSeasonId(season: string): Promise<number | null> {
  const [start, end] = season.split('-');
  const data = await plGet<{ content: { id: number; label: string }[] }>('/competitions/1/compseasons?page=0&pageSize=10');
  const hit = data.content.find((c) => c.label.includes(`${start}/20${end}`) || c.label.includes(`${start}/${end}`));
  return hit ? Math.round(hit.id) : null;
}

const slugOf = (t: PlTeamRef) =>
  resolveClub(t.team.club?.name)?.slug ?? resolveClub(t.team.name)?.slug ?? resolveClub(t.team.club?.shortName)?.slug ?? null;

export interface LineupTarget {
  id: number; // FPL fixture id
  gameweek: number;
  home: string; // slug
  away: string; // slug
}

/**
 * Stores the lineups for those of `targets` that have kicked off and have no
 * stored lineup yet. One list request, then one request per match. Returns how
 * many matches were written; a match the feed has no team lists for is skipped
 * and tried again next time.
 */
export async function syncPlLineups(
  admin: SupabaseClient,
  season: string,
  targets: LineupTarget[],
): Promise<{ written: number; skipped: number }> {
  if (targets.length === 0) return { written: 0, skipped: 0 };

  const { data: have } = await admin
    .from('pl_match_lineups')
    .select('fpl_fixture_id')
    .eq('season', season)
    .in('fpl_fixture_id', targets.map((t) => t.id));
  const counts = new Map<number, number>();
  for (const r of have ?? []) counts.set(r.fpl_fixture_id, (counts.get(r.fpl_fixture_id) ?? 0) + 1);
  const needed = targets.filter((t) => (counts.get(t.id) ?? 0) < 2);
  if (needed.length === 0) return { written: 0, skipped: 0 };

  const cs = await compSeasonId(season);
  if (!cs) return { written: 0, skipped: needed.length };

  // Matches that have kicked off: completed, and live ones (team lists are out at kickoff).
  const feed: PlFixture[] = [];
  for (const status of ['C', 'L']) {
    for (let page = 0; page < 10; page++) {
      const data = await plGet<{ pageInfo: { numPages: number }; content: PlFixture[] }>(
        `/fixtures?comps=1&compSeasons=${cs}&page=${page}&pageSize=100&statuses=${status}`,
      );
      feed.push(...data.content);
      if (page + 1 >= data.pageInfo.numPages) break;
    }
  }
  const byMatch = new Map<string, PlFixture>();
  for (const f of feed) {
    const [h, a] = f.teams;
    const hs = h && slugOf(h);
    const as = a && slugOf(a);
    if (hs && as) byMatch.set(`${hs}|${as}`, f);
  }

  // Opta code -> Gaffa player id, across every player we have ever stored.
  const players = await fetchAllPagesOrThrow<{ id: string; photo_url: string | null }>((from, to) =>
    admin.from('players').select('id, photo_url').not('photo_url', 'is', null).order('id').range(from, to),
  );
  const byCode = new Map<string, string>();
  for (const p of players) {
    const code = p.photo_url?.match(/(\d+)\.(?:png|jpg)/)?.[1];
    if (code) byCode.set(code, p.id);
  }

  let written = 0;
  let skipped = 0;
  for (const t of needed) {
    const pl = byMatch.get(`${t.home}|${t.away}`);
    if (!pl) {
      skipped++;
      continue;
    }
    const detail = await plGet<{ teams: PlTeamRef[]; teamLists?: PlTeamList[] }>(`/fixtures/${Math.round(pl.id)}?altIds=true`);
    const lists = detail.teamLists ?? [];
    const rows = lists
      .map((list) => {
        const team = detail.teams.find((x) => Math.round(x.team.id) === Math.round(list.teamId));
        const club = team ? slugOf(team) : null;
        const lines = list.formation?.players;
        if (!club || !lines?.length) return null;
        const optaById = new Map((list.lineup ?? []).map((p) => [Math.round(p.id), p.altIds?.opta?.replace(/^p/, '')]));
        const ours = lines.map((line) =>
          [...line]
            .reverse()
            .map((plId) => byCode.get(optaById.get(Math.round(plId)) ?? ''))
            .filter((id): id is string => !!id),
        );
        return { season, fpl_fixture_id: t.id, club_slug: club, formation: list.formation?.label ?? null, lines: ours };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length === 0) {
      skipped++;
      continue;
    }
    const { error } = await admin.from('pl_match_lineups').upsert(rows, { onConflict: 'season,fpl_fixture_id,club_slug' });
    if (error) throw new Error(`pl_match_lineups: ${error.message}`);
    written++;
  }
  return { written, skipped };
}
