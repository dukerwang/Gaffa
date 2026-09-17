import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFplStatus } from '@/lib/fpl/api';
import { getGameweekFixtures, type GwFixture } from '@/lib/fpl/fixtures';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';
import { buildDashboardModel } from '@/lib/dashboard/buildDashboardModel';
import LeagueCard from './LeagueCard';
import TopRated from './TopRated';
import FirstRun from './FirstRun';
import { AboutGaffa, Doors, Matchweek, Shelf } from './Sections';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

/**
 * The home screen. A thin renderer over `buildDashboardModel`: your leagues
 * first, then this week's Premier League, then the ways in.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const [fpl, season] = await Promise.all([getFplStatus(), getCurrentFplSeason()]);
  const fixturesPromise = fpl.displayGw ? getGameweekFixtures(fpl.displayGw) : Promise.resolve([]);
  const model = await buildDashboardModel(admin, user.id, fpl, fixturesPromise, season);

  if (model.cards.length === 0) {
    return (
      <div className={styles.page}>
        <FirstRun model={model} />
      </div>
    );
  }

  const matchCards = model.cards.filter((c) => c.kind === 'match');
  const otherCards = model.cards.filter((c) => c.kind !== 'match');
  const mainCards = matchCards.length ? matchCards : otherCards;
  const railCards = matchCards.length ? otherCards : [];
  const firstActive = matchCards[0]?.leagueId ?? null;

  return (
    <div className={styles.page}>
      <Shelf model={model} />

      <div className={styles.leagueRow}>
        <div className={styles.cardGrid}>
          {mainCards.map((c) => (
            <LeagueCard key={c.leagueId} card={c} />
          ))}
        </div>
        <div className={styles.rail}>
          {railCards.map((c) => (
            <LeagueCard key={c.leagueId} card={c} />
          ))}
          <Doors />
        </div>
      </div>

      <TopRated
        matchweek={model.topRated.matchweek}
        season={model.topRated.season}
        ratingsHref={firstActive ? `/league/${firstActive}/stats` : null}
      />

      <div className={`${styles.section} ${styles.bottomRow}`}>
        <Matchweek model={model} fixturesHref={firstActive ? `/league/${firstActive}/fixtures` : null} />
        <AboutGaffa />
      </div>

      <div className={styles.doorsMobile}>
        <Doors />
      </div>
    </div>
  );
}
