import { clubByFplCode } from '@/lib/clubs/registry';
import { getBootstrapSlim, type FplTeamSlim } from '@/lib/fpl/bootstrapSlim';

interface FplFixtureRaw {
  id: number;
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

    const rawFixtures = await fixturesRes.json();

    const teamsById = new Map<number, FplTeamSlim>(bootstrap.teams.map((t) => [t.id, t]));
    const badgeFor = (teamId: number): string | null => {
      const team = teamsById.get(teamId);
      const club = team ? clubByFplCode(team.code) : null;
      return club ? `/team-logos/${club.slug}.png` : null;
    };

    const fixtures: GwFixture[] = (rawFixtures as FplFixtureRaw[]).map((f) => ({
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

    return limit ? fixtures.slice(0, limit) : fixtures;
  } catch (error) {
    console.error('Error fetching gameweek fixtures:', error);
    return [];
  }
}
