import type { Metadata } from 'next';
import { getFplStatus } from '@/lib/fpl/api';
import { getGameweekFixtures } from '@/lib/fpl/fixtures';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';
import { buildFixturesModel } from '@/lib/dashboard/buildDashboardModel';
import { loadShowcase } from '@/lib/publicHome/loadShowcase';
import PublicTopBar from '@/components/home/PublicTopBar';
import PublicHome from '@/components/home/PublicHome';
import JsonLd from '@/components/seo/JsonLd';
import { siteJsonLd } from '@/lib/seo/jsonLd';
import shell from './(dashboard)/layout.module.css';

/**
 * The signed-out front page is the same for every visitor, so it is built once
 * and rebuilt at most about once a minute (the fixtures fetch revalidates every
 * 60 seconds and sets the floor) instead of on every request. Crawlers and
 * link previewers no longer cost a function run each. Managers never reach
 * this render: src/proxy.ts redirects a signed-in visitor from "/" to the
 * dashboard before the cached page is served.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/** The front door. Everyone who gets here is signed out (see the note on `revalidate`). */
export default async function RootPage() {
  const [fpl, season] = await Promise.all([getFplStatus(), getCurrentFplSeason()]);
  const [fixtures, showcase] = await Promise.all([
    fpl.displayGw ? getGameweekFixtures(fpl.displayGw) : Promise.resolve([]),
    loadShowcase(),
  ]);

  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <PublicTopBar heroBrand />
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
