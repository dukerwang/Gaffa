import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
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

const PAGE = 1000;

/**
 * Every active Premier League player, paged. PostgREST stops at 1,000 rows
 * without saying so, and the table is close to that.
 */
async function loadActivePlayers(): Promise<Player[]> {
  const admin = createAdminClient();
  const out: Player[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('players')
      .select(FULL_PLAYER_SELECT)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`lineup builder players: ${error.message}`);
    const rows = (data ?? []) as unknown as Player[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export default async function LineupBuilderPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const initialState = deserializeLineup(resolvedParams);
  const allPlayers = await loadActivePlayers();

  return <LineupBuilderClient allPlayers={allPlayers} initialState={initialState} />;
}
