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
  const { data: players } = await admin
    .from('players')
    .select('*')
    .order('name', { ascending: true });

  const allPlayers: Player[] = players ?? [];

  return (
    <LineupBuilderClient
      allPlayers={allPlayers}
      initialState={initialState}
    />
  );
}
