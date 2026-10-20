import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllPages } from '@/lib/supabase/pagination';
import type { Player } from '@/types';
import { deserializeLineup } from '@/lib/lineups/lineupSerializer';
import { loadBuilderFixtures } from '@/lib/lineups/builderFixtures';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';
import LineupBuilderClient from './LineupBuilderClient';

export const metadata: Metadata = {
  title: 'Lineup Builder · Gaffa',
  description: 'Build a starting XI from any Premier League players and share it as an image or a link.',
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LineupBuilderPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const initialState = deserializeLineup(resolvedParams);

  const admin = createAdminClient();

  const [allPlayers, { fixtures, linked }] = await Promise.all([
    fetchAllPages<Player>((from, to) =>
      admin
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    ),
    getCurrentFplSeason().then((season) => loadBuilderFixtures(admin, season, initialState.fixture ?? null)),
  ]);

  return (
    <LineupBuilderClient
      allPlayers={allPlayers}
      initialState={initialState}
      fixtures={fixtures}
      initialFixture={linked}
    />
  );
}
