/**
 * src/lib/tournaments/createTournaments.ts
 *
 * Core tournament creation logic — extracted from the HTTP route so it can be
 * called directly by the season reset orchestrator (and any future callers)
 * without needing to make an internal HTTP request.
 *
 * The HTTP route at /api/sync/tournaments?action=create delegates to this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  nextPow2,
  seedBracket,
  buildRoundSpecs,
  type SeedEntry,
} from '@/lib/tournaments/engine';
import {
  INAUGURAL_SEASON_CUP_SEED_GW,
  loadArchiveRanks,
  loadSeedTable,
  orderForSeeding,
} from '@/lib/tournaments/seeding';
import type { DrawnTie } from '@/lib/tournaments/draw';
import { notifyDraw } from '@/lib/tournaments/runDraw';
import { createNotification } from '@/lib/notifications/createNotification';
import type { TournamentType } from '@/types';

export interface CreateTournamentResult {
  ok: boolean;
  tournament_id?: string;
  bracket_size?: number;
  teams?: number;
  byes?: number;
  rounds?: number;
  error?: string;
  skipped?: boolean;
}

interface CreateAllTournamentsResult {
  matchupsGenerated: number;
  tournamentsCreated: CreateTournamentResult[];
}

/**
 * Creates a single tournament for a league.
 *
 * @param admin     - Supabase admin client
 * @param leagueId  - The league to create the tournament in
 * @param type      - 'primary_cup' | 'secondary_cup' | 'consolation_cup'
 * @param startGw   - The first gameweek that should be included (usually 1 for new season)
 * @param season    - The season string to tag the tournament with (e.g. '2026-27')
 * @param opts      - `corrected`: this replaces a bracket that was seeded wrongly,
 *                    and the managers' notices say so. `silent`: send no notices;
 *                    announceFirstRound sends them later.
 */
export async function createTournament(
  admin: SupabaseClient,
  leagueId: string,
  type: TournamentType,
  startGw: number,
  season: string,
  opts: { corrected?: boolean; silent?: boolean } = {},
): Promise<CreateTournamentResult> {
  // --- Idempotency check ---
  const { data: existingTournament } = await admin
    .from('tournaments')
    .select('id')
    .eq('league_id', leagueId)
    .eq('type', type)
    .eq('season', season)
    .maybeSingle();

  if (existingTournament) {
    return {
      ok: true,
      skipped: true,
      tournament_id: existingTournament.id,
    };
  }

  // Fetch teams
  const { data: allTeams, error: teamsErr } = await admin
    .from('teams')
    .select('id, team_name, total_points')
    .eq('league_id', leagueId);

  if (teamsErr || !allTeams || allTeams.length < 4) {
    return { ok: false, error: 'Need at least 4 teams in the league' };
  }

  // Seed from last season's archived table, else from this season's table
  // after gameweek 7. With neither, any seed would be arbitrary (see
  // seeding.ts), so no bracket is made yet.
  const [archiveRanks, seedTable] = await Promise.all([
    loadArchiveRanks(admin, leagueId),
    loadSeedTable(admin, leagueId, allTeams),
  ]);
  const { basis, ordered: orderedTeams } = orderForSeeding(allTeams, archiveRanks, seedTable);
  if (basis === 'none') {
    return {
      ok: true,
      skipped: true,
      error: `Skipped: ${type} has nothing to seed from yet (no archived table, gameweek ${INAUGURAL_SEASON_CUP_SEED_GW} not finished)`,
    };
  }

  // Filter eligible teams by tournament type & league size
  let eligible = orderedTeams;
  if (type === 'primary_cup' || type === 'consolation_cup') {
    if (orderedTeams.length >= 7) {
      eligible = type === 'primary_cup'
        ? orderedTeams.slice(0, orderedTeams.length - 2)
        : orderedTeams.slice(orderedTeams.length - 2);
    } else {
      // 4-6 teams: all enter primary_cup; consolation_cup gets empty placeholder slots
      if (type === 'consolation_cup') {
        const emptyCount = orderedTeams.length === 4 ? 2 : 4;
        eligible = new Array(emptyCount).fill({ id: null });
      }
    }
  }

  const seeds: SeedEntry[] = eligible.map((t, i) => ({ teamId: t.id, seed: i + 1 }));
  const bracketSize = nextPow2(seeds.length);
  const bracketSlots = seedBracket(seeds, bracketSize);
  const roundSpecs = buildRoundSpecs(bracketSize, type, orderedTeams.length);

  // Skip if the tournament schedule has already passed
  const minGwRequired = Math.min(...roundSpecs.map((r) => r.startGameweek));
  if (minGwRequired < startGw) {
    return {
      ok: true,
      skipped: true,
      error: `Skipped: ${type} requires GW${minGwRequired} but league starts at GW${startGw}`,
    };
  }

  const names = {
    primary_cup: 'Champions Cup',
    secondary_cup: 'League Cup',
    consolation_cup: 'Consolation Cup',
  } satisfies Record<TournamentType, string>;

  // 1. Insert tournament row
  const { data: tournament, error: tErr } = await admin
    .from('tournaments')
    .insert({ league_id: leagueId, name: names[type], type, status: 'pending', season })
    .select()
    .single();

  if (tErr || !tournament) {
    return { ok: false, error: `Failed to create tournament: ${tErr?.message}` };
  }

  // 2. Insert rounds
  const { data: rounds, error: rErr } = await admin
    .from('tournament_rounds')
    .insert(
      roundSpecs.map((r) => ({
        tournament_id: tournament.id,
        name: r.name,
        round_number: r.roundNumber,
        start_gameweek: r.startGameweek,
        end_gameweek: r.endGameweek,
        is_two_leg: r.isTwoLeg,
      })),
    )
    .select()
    .order('round_number', { ascending: true });

  if (rErr || !rounds) {
    return { ok: false, error: `Failed to create rounds: ${rErr?.message}` };
  }

  // 3. Build matchup rows (round 1 from bracket, later rounds as empty TBD)
  const allMatchupRows: {
    roundId: string;
    roundNumber: number;
    teamA: string | null;
    teamB: string | null;
    bracketPos: number;
  }[] = [];

  for (let i = 0; i < bracketSlots.length; i += 2) {
    allMatchupRows.push({
      roundId: rounds[0].id,
      roundNumber: 1,
      teamA: bracketSlots[i],
      teamB: bracketSlots[i + 1],
      bracketPos: i / 2,
    });
  }
  for (let r = 1; r < rounds.length; r++) {
    for (let m = 0; m < roundSpecs[r].matchCount; m++) {
      allMatchupRows.push({
        roundId: rounds[r].id,
        roundNumber: r + 1,
        teamA: null,
        teamB: null,
        bracketPos: m,
      });
    }
  }

  const { data: insertedMatchups, error: mErr } = await admin
    .from('tournament_matchups')
    .insert(
      allMatchupRows.map((m) => ({
        round_id: m.roundId,
        team_a_id: m.teamA,
        team_b_id: m.teamB,
        bracket_position: m.bracketPos,
        status: m.roundNumber === 1 && m.teamA && m.teamB ? 'active' : ('pending' as const),
      })),
    )
    .select()
    .order('created_at', { ascending: true });

  if (mErr || !insertedMatchups) {
    return { ok: false, error: `Failed to create matchups: ${mErr?.message}` };
  }

  // 4. Link next_matchup_id (winner progression). The League Cup has no fixed
  // path: each round after the first is drawn (src/lib/tournaments/runDraw.ts).
  const matchupsByRound = new Map<string, typeof insertedMatchups>();
  for (const m of insertedMatchups) {
    const arr = matchupsByRound.get(m.round_id) ?? [];
    arr.push(m);
    matchupsByRound.set(m.round_id, arr);
  }

  // The rows above were read before the links exist, so the links are kept
  // here for the bye step below rather than read off those rows.
  const nextOf = new Map<string, string>();
  for (let r = 0; type !== 'secondary_cup' && r < rounds.length - 1; r++) {
    const cur = (matchupsByRound.get(rounds[r].id) ?? []).sort(
      (a, b) => a.bracket_position - b.bracket_position,
    );
    const nxt = (matchupsByRound.get(rounds[r + 1].id) ?? []).sort(
      (a, b) => a.bracket_position - b.bracket_position,
    );
    for (const cm of cur) {
      const nextPos = Math.floor(cm.bracket_position / 2);
      const nextMatchup = nxt.find((nm) => nm.bracket_position === nextPos);
      if (nextMatchup) {
        await admin
          .from('tournament_matchups')
          .update({ next_matchup_id: nextMatchup.id })
          .eq('id', cm.id);
        nextOf.set(cm.id, nextMatchup.id);
      }
    }
  }

  // 5. Auto-advance byes in round 1
  const firstRoundMatchups = matchupsByRound.get(rounds[0].id) ?? [];
  for (const m of firstRoundMatchups) {
    if (!m.team_a_id && !m.team_b_id) continue;
    if (!m.team_a_id || !m.team_b_id) {
      const winnerId = m.team_a_id || m.team_b_id;
      await admin
        .from('tournament_matchups')
        .update({ winner_id: winnerId, status: 'completed' })
        .eq('id', m.id);
      const nextId = nextOf.get(m.id);
      if (nextId && winnerId) {
        await advanceWinner(admin, nextId, winnerId, m.bracket_position);
      }
    }
  }

  // 6. Activate tournament
  await admin.from('tournaments').update({ status: 'active' }).eq('id', tournament.id);

  // 7. Tell each manager who they drew. Later rounds are announced by runDraw
  // (League Cup) or follow from the bracket (Champions Cup).
  if (!opts.silent) {
    try {
      await announceFirstRound(admin, tournament.id, { corrected: opts.corrected });
    } catch (err) {
      console.error(`[createTournament] Failed to send ${type} draw notifications:`, err);
    }
  }

  return {
    ok: true,
    tournament_id: tournament.id,
    bracket_size: bracketSize,
    teams: seeds.length,
    byes: bracketSize - seeds.length,
    rounds: rounds.length,
  };
}

/**
 * Tells each manager in a cup's first round who they play, or that they have a
 * bye. Reads the bracket as stored, so it announces whatever is there now.
 */
export async function announceFirstRound(
  admin: SupabaseClient,
  tournamentId: string,
  opts: { corrected?: boolean } = {},
): Promise<void> {
  const { data: tournament } = await admin
    .from('tournaments')
    .select('id, league_id, name')
    .eq('id', tournamentId)
    .single();
  const { data: round } = await admin
    .from('tournament_rounds')
    .select('id, tournament_id, name, round_number, start_gameweek, end_gameweek, is_two_leg')
    .eq('tournament_id', tournamentId)
    .eq('round_number', 1)
    .single();
  if (!tournament || !round) return;

  const { data: slots } = await admin
    .from('tournament_matchups')
    .select('team_a_id, team_b_id')
    .eq('round_id', round.id)
    .order('bracket_position', { ascending: true });

  const ties: DrawnTie[] = [];
  for (const { team_a_id: a, team_b_id: b } of slots ?? []) {
    if (a && b) ties.push({ a, b });
    else if (a || b) ties.push({ a: (a ?? b) as string, b: null });
  }
  await notifyDraw(admin, createNotification, tournament, round, ties, opts);
}

/**
 * Creates all three tournaments (Champions Cup, League Cup, Consolation Cup)
 * for a league in a single call. Called by the season reset orchestrator.
 */
export async function createAllTournaments(
  admin: SupabaseClient,
  leagueId: string,
  season: string,
  startGw = 1,
): Promise<CreateAllTournamentsResult> {
  const types: TournamentType[] = ['primary_cup', 'secondary_cup', 'consolation_cup'];
  const results: CreateTournamentResult[] = [];

  for (const type of types) {
    const result = await createTournament(admin, leagueId, type, startGw, season);
    results.push(result);
    if (!result.ok && !result.skipped) {
      // Log but don't throw — let the others continue
      console.error(`[createAllTournaments] ${type} failed:`, result.error);
    }
  }

  return {
    matchupsGenerated: results.filter((r) => r.ok && !r.skipped).length,
    tournamentsCreated: results,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function advanceWinner(
  admin: SupabaseClient,
  nextMatchupId: string,
  winnerId: string,
  currentBracketPos: number,
): Promise<void> {
  const { data: nextMatchup } = await admin
    .from('tournament_matchups')
    .select('team_a_id, team_b_id')
    .eq('id', nextMatchupId)
    .single();

  if (!nextMatchup) return;

  // Slot A for even positions, slot B for odd positions
  const field = currentBracketPos % 2 === 0 ? 'team_a_id' : 'team_b_id';
  await admin
    .from('tournament_matchups')
    .update({ [field]: winnerId })
    .eq('id', nextMatchupId);
}
