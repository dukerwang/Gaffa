import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import {
  buildRegister,
  type RegisterPlayer,
  type RawTransaction,
  type RawTrade,
  type RawLoan,
  type RawBidEvent,
  type RegisterTeam,
} from '@/lib/transactions/buildRegister';
import TransactionsClient, { type SeasonWindow } from './TransactionsClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

/**
 * The register is a union of three tables, so the fetch is a union too. See
 * `src/lib/transactions/buildRegister.ts` for why `transactions` on its own
 * cannot answer this page.
 */
export default async function TransactionsPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();

  const { data: league } = await admin
    .from('leagues')
    .select('name, commissioner_id, season, current_season')
    .eq('id', leagueId)
    .single();

  if (!league) notFound();

  const { data: myTeam } = await admin
    .from('teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single();

  if (!myTeam && league.commissioner_id !== user.id) redirect('/dashboard');

  /**
   * PostgREST caps a response at 1,000 rows, and a dynasty league runs
   * indefinitely — Dynasty Dragoon is already 62 transactions into its first
   * season. Page rather than take the first thousand and silently drop the rest,
   * which is how the register would start losing its oldest seasons.
   */
  async function allTransactions() {
    const rows: RawTransaction[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await admin
        .from('transactions')
        .select('id, type, team_id, player_id, faab_bid, compensation_amount, notes, processed_at')
        .eq('league_id', leagueId)
        .order('processed_at', { ascending: false })
        .range(from, from + 999);
      const page = (data ?? []) as RawTransaction[];
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }

  const [txResult, teamsResult, tradesResult, loansResult, bidsResult, transitionsResult] =
    await Promise.all([
      allTransactions(),
      admin.from('teams').select('id, team_name').eq('league_id', leagueId).order('team_name'),
      admin
        .from('trade_proposals')
        .select(
          `id, status, team_a_id, team_b_id, offered_players, requested_players,
           offered_rights, requested_rights, offered_faab, requested_faab, created_at, updated_at`,
        )
        .eq('league_id', leagueId)
        .in('status', ['accepted', 'accepted_deferred']),
      admin
        .from('player_loans')
        .select(
          `id, status, lender_team_id, borrower_team_id, player_id, loan_fee,
           end_gameweek, recall_penalty, recall_activated, created_at, updated_at`,
        )
        .eq('league_id', leagueId),
      admin
        .from('auction_bid_events')
        .select('player_id, team_id, amount, created_at')
        .eq('league_id', leagueId)
        .limit(2000),
      admin
        .from('season_transitions')
        .select('season_from, season_to, processed_at')
        .eq('league_id', leagueId)
        .order('processed_at', { ascending: true }),
    ]);

  const transactions = txResult;
  const trades = (tradesResult.data ?? []) as RawTrade[];
  const loans = (loansResult.data ?? []) as RawLoan[];
  const bidEvents = (bidsResult.data ?? []) as RawBidEvent[];
  const teams = (teamsResult.data ?? []) as RegisterTeam[];

  // Every player named anywhere in the union, fetched once.
  const playerIds = new Set<string>();
  for (const tx of transactions) if (tx.player_id) playerIds.add(tx.player_id);
  for (const l of loans) if (l.player_id) playerIds.add(l.player_id);
  for (const t of trades) {
    for (const id of [
      ...(t.offered_players ?? []),
      ...(t.requested_players ?? []),
      ...(t.offered_rights ?? []),
      ...(t.requested_rights ?? []),
    ]) {
      playerIds.add(id);
    }
  }

  const players: Record<string, RegisterPlayer> = {};
  if (playerIds.size) {
    const ids = Array.from(playerIds);
    // PostgREST truncates at 1,000 rows, so page rather than assume one batch.
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await admin
        .from('players')
        .select('id, name, web_name, primary_position, pl_team')
        .in('id', ids.slice(i, i + 500));
      for (const p of (data ?? []) as RegisterPlayer[]) players[p.id] = p;
    }
  }

  const entries = buildRegister({ transactions, trades, loans, bidEvents, teams, players });

  /**
   * Season windows, derived rather than stored: `transactions` has no season
   * column, so the boundary between one season and the next is the moment the
   * league rolled over. A league that has never rolled over has exactly one
   * window, and the picker renders as a plain label instead of a menu.
   */
  const currentSeason = league.current_season ?? league.season ?? '';
  const transitions = (transitionsResult.data ?? []) as {
    season_from: string | null;
    season_to: string | null;
    processed_at: string;
  }[];

  const cuts: { season: string; endsAt: string }[] = [];
  for (const t of transitions) {
    if (!t.season_from) continue;
    if (cuts.some((c) => c.season === t.season_from)) continue;
    cuts.push({ season: t.season_from, endsAt: t.processed_at });
  }

  const seasons: SeasonWindow[] = [];
  let startsAt: string | null = null;
  for (const c of cuts) {
    seasons.push({ season: c.season, startsAt, endsAt: c.endsAt });
    startsAt = c.endsAt;
  }
  seasons.push({ season: currentSeason, startsAt, endsAt: null });
  seasons.reverse();

  return (
    <TransactionsClient
      leagueName={league.name}
      myTeamId={myTeam?.id ?? null}
      entries={entries}
      teams={teams}
      seasons={seasons}
    />
  );
}
