import type { GwFixture } from '@/lib/fpl/fixtures';
import type { FixtureRow } from './buildDashboardModel';

export function toFixtureRow(f: GwFixture): FixtureRow {
  return {
    id: f.id,
    homeName: f.homeName,
    awayName: f.awayName,
    homeBadge: f.homeBadge,
    awayBadge: f.awayBadge,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    kickoff: f.kickoff,
    state: f.finished ? 'finished' : f.started ? 'live' : 'upcoming',
    minutes: f.minutes,
  };
}
