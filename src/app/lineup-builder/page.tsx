import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Player } from '@/types';
import { deserializeLineup } from '@/lib/lineups/lineupSerializer';
import LineupBuilderClient from './LineupBuilderClient';

export const metadata: Metadata = {
  title: 'Lineup Builder · Gaffa',
  description: 'Build and share custom Premier League starting XIs and match predictions.',
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LineupBuilderPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const initialState = deserializeLineup(resolvedParams);

  const admin = createAdminClient();

  // PostgREST caps a single request at 1000 rows; the player pool sits close
  // enough to that (978 as of 2026-09) that a page-by-page fetch is needed
  // now rather than once it silently starts dropping the tail of the
  // alphabet — see sofifa_position_reference for the same trap already hit.
  const allPlayers: Player[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: page } = await admin
      .from('players')
      .select('*')
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1);
    if (!page || page.length === 0) break;
    allPlayers.push(...page);
    if (page.length < pageSize) break;
  }

  return (
    <LineupBuilderClient
      allPlayers={allPlayers}
      initialState={initialState}
    />
  );
}
