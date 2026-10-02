import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFplStatus } from '@/lib/fpl/api';
import { getGameweekFixtures } from '@/lib/fpl/fixtures';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';
import { buildFixturesModel } from '@/lib/dashboard/buildDashboardModel';
import { loadShowcase } from '@/lib/publicHome/loadShowcase';
import PublicTopBar from '@/components/home/PublicTopBar';
import PublicHome from '@/components/home/PublicHome';
import shell from './(dashboard)/layout.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Gaffa · The Most Realistic Fantasy Football Game',
  description:
    'Dynasty fantasy football for the Premier League. Players score the way their match went, transfers follow the real Premier League, and every season has four trophies.',
};

/**
 * The front door. Managers go straight to their dashboard; everyone else gets
 * the public home rather than a login form.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  const [fpl, season] = await Promise.all([getFplStatus(), getCurrentFplSeason()]);
  const settledGw = fpl.isFinished && !fpl.isLive ? fpl.currentGw : fpl.currentGw - 1;
  const [fixtures, showcase] = await Promise.all([
    fpl.displayGw ? getGameweekFixtures(fpl.displayGw) : Promise.resolve([]),
    loadShowcase(season, settledGw),
  ]);

  return (
    <>
      <PublicTopBar />
      <div className={shell.ground}>
        <main className={shell.main}>
          <PublicHome
            showcase={showcase}
            fixtures={buildFixturesModel(fixtures)}
            gameweek={fpl.displayGw}
            nextDeadline={fpl.nextDeadline}
            season={season}
            signedIn={false}
          />
        </main>
      </div>
    </>
  );
}
