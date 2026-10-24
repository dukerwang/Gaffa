import { clubByFplCode } from '@/lib/clubs/registry';
import { getBootstrapSlim, type FplTeamSlim } from '@/lib/fpl/bootstrapSlim';

interface FplFixtureRaw {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  kickoff_time: string | null;
  started: boolean;
  finished: boolean;
  finished_provisional?: boolean;
  minutes: number;
}

export interface GwFixture {
  id: number;
  homeShort: string;
  awayShort: string;
  /** FPL's own display name ("Nott'm Forest", "Spurs"), short enough for a row. */
  homeName: string;
  awayName: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string | null;
  started: boolean;
  finished: boolean;
  minutes: number;
}

function toGwFixtures(teams: FplTeamSlim[], rawFixtures: FplFixtureRaw[]): GwFixture[] {
  const teamsById = new Map<number, FplTeamSlim>(teams.map((t) => [t.id, t]));
  const badgeFor = (teamId: number): string | null => {
    const team = teamsById.get(teamId);
    const club = team ? clubByFplCode(team.code) : null;
    return club ? `/team-logos/${club.slug}.png` : null;
  };

  const fixtures: GwFixture[] = rawFixtures.map((f) => ({
    id: f.id,
    homeShort: teamsById.get(f.team_h)?.short_name ?? '???',
    awayShort: teamsById.get(f.team_a)?.short_name ?? '???',
    homeName: teamsById.get(f.team_h)?.name ?? teamsById.get(f.team_h)?.short_name ?? '???',
    awayName: teamsById.get(f.team_a)?.name ?? teamsById.get(f.team_a)?.short_name ?? '???',
    homeBadge: badgeFor(f.team_h),
    awayBadge: badgeFor(f.team_a),
    homeScore: f.team_h_score,
    awayScore: f.team_a_score,
    kickoff: f.kickoff_time,
    started: !!f.started,
    finished: !!(f.finished || f.finished_provisional),
    minutes: f.minutes ?? 0,
  }));

  fixtures.sort((a, b) => {
    if (!a.kickoff && !b.kickoff) return 0;
    if (!a.kickoff) return 1;
    if (!b.kickoff) return -1;
    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });
  return fixtures;
}

/**
 * Fetches this gameweek's Premier League fixtures with live scores, using
 * the same FPL fixtures endpoint as src/lib/fixtures/lockout.ts. Returns
 * every fixture in the gameweek, ordered by kickoff time (undated fixtures —
 * postponements — sort last), unless `limit` caps the count.
 */
export async function getGameweekFixtures(gameweek: number, limit?: number): Promise<GwFixture[]> {
  try {
    // FPL team ids are seasonal: both reads are of the live season, so the
    // ids in one line up with the other.
    const [bootstrap, fixturesRes] = await Promise.all([
      getBootstrapSlim(),
      fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gameweek}`, { next: { revalidate: 60 } }),
    ]);

    if (!fixturesRes.ok) return [];

    const fixtures = toGwFixtures(bootstrap.teams, (await fixturesRes.json()) as FplFixtureRaw[]);
    return limit ? fixtures.slice(0, limit) : fixtures;
  } catch (error) {
    console.error('Error fetching gameweek fixtures:', error);
    return [];
  }
}

/**
 * Every scheduled fixture of the season, grouped by gameweek and ordered by
 * kickoff inside each. One fetch serves the whole season, so a page that lets
 * the reader step between weeks doesn't pay for a request per week. Fixtures
 * FPL hasn't placed in a gameweek yet are left out.
 */
export async function getSeasonFixtures(): Promise<Map<number, GwFixture[]>> {
  const byWeek = new Map<number, GwFixture[]>();
  try {
    // The slim bootstrap, not the 600-player payload: only team names and codes are read.
    const [bootstrap, fixturesRes] = await Promise.all([
      getBootstrapSlim(),
      fetch('https://fantasy.premierleague.com/api/fixtures/', { next: { revalidate: 60 } }),
    ]);
    if (!fixturesRes.ok) return byWeek;

    const raw = ((await fixturesRes.json()) as FplFixtureRaw[]).filter((f) => f.event);
    const weekOf = new Map(raw.map((f) => [f.id, f.event as number]));
    for (const fx of toGwFixtures(bootstrap.teams, raw)) {
      const gw = weekOf.get(fx.id)!;
      const list = byWeek.get(gw);
      if (list) list.push(fx);
      else byWeek.set(gw, [fx]);
    }
  } catch (error) {
    console.error('Error fetching season fixtures:', error);
  }
  return byWeek;
}
