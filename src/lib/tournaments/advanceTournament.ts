/**
 * src/lib/tournaments/advanceTournament.ts
 *
 * Core tournament advancement logic — extracted from the HTTP route so it can
 * be called directly by matchupProcessor after resolving a gameweek, keeping
 * cup brackets in sync without needing an HTTP round-trip.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentFplSeason } from '@/lib/season/currentSeason';
import { calculateMatchRating } from '@/lib/scoring/engine';
import { consolationFeeds, decideTie } from '@/lib/tournaments/draw';
import { runDraw, type DrawRound } from '@/lib/tournaments/runDraw';
import { loadReferenceStats } from '@/lib/scoring/matchups';
import { getEffectiveLineupForTeam } from '@/lib/lineups/carryForward';
import type { GranularPosition, ReferenceStats } from '@/types';

type AdminClient = ReturnType<typeof createAdminClient>;
type RefStatsMap = Record<string, ReferenceStats>;

async function getRefStats(
  admin: AdminClient,
  tournamentId: string,
): Promise<{ refStats: RefStatsMap; season: string }> {
  const { data } = await admin
    .from('tournaments')
    .select('season, league:leagues(current_season)')
    .eq('id', tournamentId)
    .single();
  // A cup is created with its season, so that is the fallback. FPL's season is
  // the last resort: after GW38 it already names next season, which has no
  // reference stats yet.
  const season =
    (data?.league as any)?.current_season ?? data?.season ?? (await getCurrentFplSeason());
  const refStats = (await loadReferenceStats(admin, season)) as RefStatsMap;
  return { refStats, season };
}

/**
 * Records a completed cup's winner in `season_cup_winners_archive`.
 *
 * Keyed (league_id, season, tournament_name) to match the reset's writer in
 * src/lib/offseason/seasonReset.ts, so whichever runs second changes nothing.
 * Failures are logged, never thrown: a cup that cannot be archived must not
 * stop the bracket from completing.
 */
async function archiveCupWinner(
  admin: AdminClient,
  tournament: { league_id: string; season: string; name: string; type: string },
  winnerId: string,
) {
  const { error } = await admin.from('season_cup_winners_archive').upsert(
    {
      league_id: tournament.league_id,
      season: tournament.season,
      tournament_name: tournament.name,
      tournament_type: tournament.type,
      winner_id: winnerId,
    },
    { onConflict: 'league_id,season,tournament_name' },
  );
  if (error) {
    console.error('[advanceTournament] Failed to archive cup winner:', error.message);
  }
}

/** Place a winner into the next round matchup slot. */
async function advanceWinner(
  admin: AdminClient,
  nextMatchupId: string,
  winnerId: string,
  fromBracketPosition: number,
) {
  // Even bracket positions fill team_a, odd fill team_b
  const isTeamA = fromBracketPosition % 2 === 0;

  await admin
    .from('tournament_matchups')
    .update(isTeamA ? { team_a_id: winnerId } : { team_b_id: winnerId })
    .eq('id', nextMatchupId);

  // Activate the matchup once both teams are set
  const { data: next } = await admin
    .from('tournament_matchups')
    .select('team_a_id, team_b_id')
    .eq('id', nextMatchupId)
    .single();

  if (next?.team_a_id && next?.team_b_id) {
    await admin
      .from('tournament_matchups')
      .update({ status: 'active' })
      .eq('id', nextMatchupId);
  }
}

/** Score a single leg for two teams by reading already-calculated matchup scores. */
async function scoreLeg(
  admin: AdminClient,
  leagueId: string,
  gw: number,
  teamAId: string,
  teamBId: string,
  refStats: RefStatsMap,
  season: string,
): Promise<{
  scoreA: number;
  scoreB: number;
  teamAPlayers: { playerId: string; points: number }[];
  teamBPlayers: { playerId: string; points: number }[];
}> {
  const { data: matchupA } = await admin
    .from('matchups')
    .select('lineup_a, lineup_b, team_a_id, team_b_id, score_a, score_b')
    .eq('league_id', leagueId)
    .eq('gameweek', gw)
    .or(`team_a_id.eq.${teamAId},team_b_id.eq.${teamAId}`)
    .limit(1)
    .single();

  const { data: matchupB } = await admin
    .from('matchups')
    .select('lineup_a, lineup_b, team_a_id, team_b_id, score_a, score_b')
    .eq('league_id', leagueId)
    .eq('gameweek', gw)
    .or(`team_a_id.eq.${teamBId},team_b_id.eq.${teamBId}`)
    .limit(1)
    .single();

  let scoreA = 0;
  let scoreB = 0;

  if (matchupA) {
    scoreA = matchupA.team_a_id === teamAId ? Number(matchupA.score_a) : Number(matchupA.score_b);
  }
  if (matchupB) {
    scoreB = matchupB.team_a_id === teamBId ? Number(matchupB.score_a) : Number(matchupB.score_b);
  }

  const rawLineupA = matchupA
    ? (matchupA.team_a_id === teamAId ? matchupA.lineup_a : matchupA.lineup_b)
    : null;
  const rawLineupB = matchupB
    ? (matchupB.team_a_id === teamBId ? matchupB.lineup_a : matchupB.lineup_b)
    : null;

  const lineupA = await getEffectiveLineupForTeam(admin, {
    teamId: teamAId,
    gameweek: gw,
    currentLineup: rawLineupA,
  });
  const lineupB = await getEffectiveLineupForTeam(admin, {
    teamId: teamBId,
    gameweek: gw,
    currentLineup: rawLineupB,
  });

  const teamAPlayers = await getPlayerScores(admin, lineupA, gw, refStats, season);
  const teamBPlayers = await getPlayerScores(admin, lineupB, gw, refStats, season);

  return { scoreA, scoreB, teamAPlayers, teamBPlayers };
}

async function getPlayerScores(
  admin: AdminClient,
  lineup: any,
  gw: number,
  refStats: RefStatsMap,
  season: string,
): Promise<{ playerId: string; points: number }[]> {
  if (!lineup?.starters) return [];
  const playerIds = lineup.starters.map((s: any) => s.player_id).filter(Boolean);
  if (playerIds.length === 0) return [];

  const { data: stats } = await admin
    .from('player_stats')
    .select('player_id, stats, player:players(primary_position)')
    .eq('season', season)
    .eq('gameweek', gw)
    .in('player_id', playerIds);

  if (!stats) return [];

  return lineup.starters.map((starter: { player_id: string; slot: GranularPosition }) => {
    const playerStat = stats.find((s) => s.player_id === starter.player_id);
    if (playerStat?.stats) {
      const primPos = (playerStat.player as any)?.primary_position;
      const { fantasyPoints } = calculateMatchRating(
        playerStat.stats as any,
        starter.slot,
        refStats as any,
        primPos as GranularPosition,
      );
      return { playerId: starter.player_id, points: fantasyPoints };
    }
    return { playerId: starter.player_id, points: 0 };
  });
}

/** The league's club count, for the small-league Consolation rules. */
async function clubCount(admin: AdminClient, leagueId: string): Promise<number> {
  const { count } = await admin.from('teams').select('id', { count: 'exact', head: true }).eq('league_id', leagueId);
  return count ?? 0;
}

async function consolationFirstRound(admin: AdminClient, leagueId: string) {
  const { data: cup } = await admin
    .from('tournaments')
    .select('id, league_id, name')
    .eq('league_id', leagueId)
    .eq('type', 'consolation_cup')
    .neq('status', 'completed')
    .maybeSingle();
  if (!cup) return null;
  const { data: first } = await admin
    .from('tournament_rounds')
    .select('id, tournament_id, name, round_number, start_gameweek, end_gameweek, is_two_leg')
    .eq('tournament_id', cup.id)
    .order('round_number', { ascending: true })
    .limit(1)
    .maybeSingle();
  return first ? { cup, round: first as DrawRound } : null;
}

/**
 * Puts a Champions Cup loser into a 4–6 club league's Consolation Cup, in the
 * first empty place of its first round. In a 5- or 6-club league those ties
 * are drawn once every loser is in (drawAfterRound), so placement here never
 * activates them; a 4-club league's single final starts once both are in.
 */
async function dropIntoConsolation(admin: AdminClient, leagueId: string, roundName: string, loserId: string) {
  const clubs = await clubCount(admin, leagueId);
  if (!consolationFeeds(clubs, roundName)) return;
  const target = await consolationFirstRound(admin, leagueId);
  if (!target) return;

  const { data: places } = await admin
    .from('tournament_matchups')
    .select('id, team_a_id, team_b_id')
    .eq('round_id', target.round.id)
    .order('bracket_position', { ascending: true });
  if (!places || places.some((p) => p.team_a_id === loserId || p.team_b_id === loserId)) return;

  for (const p of places) {
    if (!p.team_a_id) {
      await admin.from('tournament_matchups').update({ team_a_id: loserId }).eq('id', p.id);
      return;
    }
    if (!p.team_b_id) {
      await admin
        .from('tournament_matchups')
        .update(clubs === 4 ? { team_b_id: loserId, status: 'active' } : { team_b_id: loserId })
        .eq('id', p.id);
      return;
    }
  }
}

/**
 * After a round's last matchweek: a League Cup draws its next round, and a
 * 5- or 6-club league draws its Consolation Cup once the Champions Cup
 * semi-final losers are in. runDraw does nothing until every tie it depends
 * on is finished, and apply_cup_draw refuses a round that's already drawn.
 */
async function drawAfterRound(
  admin: AdminClient,
  tournament: { id: string; league_id: string; name: string; type: string },
  round: { round_number: number; name: string },
) {
  try {
    if (tournament.type === 'secondary_cup') {
      const { data: next } = await admin
        .from('tournament_rounds')
        .select('id, tournament_id, name, round_number, start_gameweek, end_gameweek, is_two_leg')
        .eq('tournament_id', tournament.id)
        .eq('round_number', round.round_number + 1)
        .maybeSingle();
      if (next) await runDraw(admin, { tournament, round: next as DrawRound });
      return;
    }

    if (tournament.type === 'primary_cup' && round.name.toLowerCase().includes('semi')) {
      const clubs = await clubCount(admin, tournament.league_id);
      if (clubs !== 5 && clubs !== 6) return;
      const target = await consolationFirstRound(admin, tournament.league_id);
      if (target) await runDraw(admin, { tournament: target.cup, round: target.round });
    }
  } catch (err) {
    // A failed draw must not stop the bracket from resolving; the next
    // advance for this matchweek retries it.
    console.error('[advanceTournament] Cup draw failed:', err);
  }
}

/**
 * Advance a single tournament by one gameweek:
 * - Updates in-progress leg scores
 * - Finalizes rounds whose end_gameweek === gw (determines winner, advances bracket)
 * - Handles consolation cup dropout cascades (4–6 team leagues)
 * - Marks the tournament complete if all matchups are done
 *
 * Idempotent: safe to call multiple times for the same (tournamentId, gameweek).
 */
export async function executeAdvanceTournament(
  tournamentId: string,
  gameweek: number,
  admin: AdminClient = createAdminClient(),
): Promise<{ ok: boolean; advanced: number; gameweek: number }> {

  const { data: tournament } = await admin
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  // Rounds where gameweek falls within [start_gameweek, end_gameweek]
  const { data: rounds } = await admin
    .from('tournament_rounds')
    .select('*')
    .eq('tournament_id', tournamentId)
    .lte('start_gameweek', gameweek)
    .gte('end_gameweek', gameweek);

  if (!rounds || rounds.length === 0) {
    return { ok: true, advanced: 0, gameweek };
  }

  const { refStats, season } = await getRefStats(admin, tournamentId);
  const { data: allRoundRows } = await admin
    .from('tournament_rounds')
    .select('id, round_number')
    .eq('tournament_id', tournamentId);
  const lastRoundNumber = Math.max(0, ...(allRoundRows ?? []).map((r) => r.round_number));
  let advanced = 0;

  for (const round of rounds) {
    const finalizing = gameweek === round.end_gameweek;
    const { data: matchups } = await admin
      .from('tournament_matchups')
      .select('*')
      .eq('round_id', round.id)
      .eq('status', 'active');

    for (const matchup of matchups ?? []) {
      if (!matchup.team_a_id || !matchup.team_b_id) continue;

      const leg1Scores = await scoreLeg(
        admin,
        tournament.league_id,
        round.start_gameweek,
        matchup.team_a_id,
        matchup.team_b_id,
        refStats,
        season,
      );

      let leg2Scores = {
        scoreA: 0,
        scoreB: 0,
        teamAPlayers: [] as { playerId: string; points: number }[],
        teamBPlayers: [] as { playerId: string; points: number }[],
      };
      if (round.is_two_leg) {
        leg2Scores = await scoreLeg(
          admin,
          tournament.league_id,
          round.end_gameweek,
          matchup.team_a_id,
          matchup.team_b_id,
          refStats,
          season,
        );
      }

      // Update interim scores
      await admin
        .from('tournament_matchups')
        .update({
          team_a_score_leg1: leg1Scores.scoreA,
          team_b_score_leg1: leg1Scores.scoreB,
          team_a_score_leg2: leg2Scores.scoreA,
          team_b_score_leg2: leg2Scores.scoreB,
        })
        .eq('id', matchup.id);

      // Only finalize on the end_gameweek of this round
      if (!finalizing) continue;

      const totalA = leg1Scores.scoreA + leg2Scores.scoreA;
      const totalB = leg1Scores.scoreB + leg2Scores.scoreB;

      // Score, then best performer, then team_a: the better seed, or in a
      // drawn round the club placed higher at the draw.
      const { winnerId, decidedBy } = decideTie({
        teamA: matchup.team_a_id,
        teamB: matchup.team_b_id,
        totalA,
        totalB,
        playersA: [...leg1Scores.teamAPlayers, ...leg2Scores.teamAPlayers],
        playersB: [...leg1Scores.teamBPlayers, ...leg2Scores.teamBPlayers],
      });

      await admin
        .from('tournament_matchups')
        .update({ winner_id: winnerId, status: 'completed', decided_by: decidedBy })
        .eq('id', matchup.id);

      // Tell both sides how their tie went. In-app + push only — cup results
      // land automatically off the gameweek cron, so this is the only way a
      // manager finds out short of checking the Tournaments page.
      if (winnerId) {
        try {
          const loserId = winnerId === matchup.team_a_id ? matchup.team_b_id : matchup.team_a_id;
          const winnerScore = winnerId === matchup.team_a_id ? totalA : totalB;
          const loserScore = winnerId === matchup.team_a_id ? totalB : totalA;
          // Not `!next_matchup_id`: League Cup ties have no fixed next tie.
          const isFinal = round.round_number === lastRoundNumber;

          const { data: sides } = await admin
            .from('teams')
            .select('id, user_id, team_name')
            .in('id', [matchup.team_a_id, matchup.team_b_id]);
          const winnerTeam = sides?.find((t) => t.id === winnerId);
          const loserTeam = sides?.find((t) => t.id === loserId);

          const { createNotification } = await import('@/lib/notifications/createNotification');
          if (winnerTeam) {
            await createNotification(admin, {
              kind: 'matchdays',
              leagueId: tournament.league_id,
              userId: winnerTeam.user_id,
              title: isFinal ? 'Cup Won!' : 'Cup Win',
              content: isFinal
                ? `You beat **${loserTeam?.team_name ?? 'your opponent'}** ${winnerScore.toFixed(2)}-${loserScore.toFixed(2)} in the ${round.name} to win the **${tournament.name}**!`
                : `You beat **${loserTeam?.team_name ?? 'your opponent'}** ${winnerScore.toFixed(2)}-${loserScore.toFixed(2)} in the ${round.name} of the **${tournament.name}**. Through to the next round!`,
              url: `/league/${tournament.league_id}/tournaments`,
            });
          }
          if (loserTeam) {
            await createNotification(admin, {
              kind: 'matchdays',
              leagueId: tournament.league_id,
              userId: loserTeam.user_id,
              title: 'Cup Elimination',
              content: `You lost to **${winnerTeam?.team_name ?? 'your opponent'}** ${loserScore.toFixed(2)}-${winnerScore.toFixed(2)} in the ${round.name} of the **${tournament.name}**.`,
              url: `/league/${tournament.league_id}/tournaments`,
            });
          }
        } catch (err) {
          console.error('[advanceTournament] Failed to send cup result notifications:', err);
        }
      }

      if (matchup.next_matchup_id && winnerId) {
        await advanceWinner(admin, matchup.next_matchup_id, winnerId, matchup.bracket_position);
      }

      // A small league's Consolation Cup is filled from Champions Cup losers.
      if (tournament.type === 'primary_cup') {
        const loserId = winnerId === matchup.team_a_id ? matchup.team_b_id : matchup.team_a_id;
        if (loserId) await dropIntoConsolation(admin, tournament.league_id, round.name, loserId);
      }

      advanced++;
    }

    if (finalizing) await drawAfterRound(admin, tournament, round);
  }

  // Check if the entire tournament is now complete
  const { data: allRounds } = await admin
    .from('tournament_rounds')
    .select('id')
    .eq('tournament_id', tournamentId);

  if (allRounds) {
    const allRoundIds = allRounds.map((r) => r.id);
    const { count } = await admin
      .from('tournament_matchups')
      .select('id', { count: 'exact', head: true })
      .in('round_id', allRoundIds)
      .neq('status', 'completed');

    if (count === 0) {
      await admin.from('tournaments').update({ status: 'completed' }).eq('id', tournamentId);

      // Query winner/runner-up details to log activity feed announcements
      try {
        const { data: finalRound } = await admin
          .from('tournament_rounds')
          .select('id')
          .eq('tournament_id', tournamentId)
          .order('round_number', { ascending: false })
          .limit(1)
          .single();

        if (finalRound) {
          const { data: finalMatchup } = await admin
            .from('tournament_matchups')
            .select('team_a_id, team_b_id, winner_id, team_a:teams!team_a_id(team_name), team_b:teams!team_b_id(team_name)')
            .eq('round_id', finalRound.id)
            .eq('status', 'completed')
            .limit(1)
            .single();

          if (finalMatchup && finalMatchup.winner_id) {
            const winnerId = finalMatchup.winner_id;
            const runnerUpId = winnerId === finalMatchup.team_a_id ? finalMatchup.team_b_id : finalMatchup.team_a_id;

            // Archive the winner NOW, not at the season reset. The reset's own
            // archiveCupWinners() used to be the only writer, which meant a cup
            // won in March did not exist as an honour until June — and the club
            // trophy cabinet reads this table. Same upsert key as the reset's,
            // so the reset later passing over this row is a no-op.
            await archiveCupWinner(admin, tournament, winnerId);

            const winnerName = (winnerId === finalMatchup.team_a_id
              ? (finalMatchup.team_a as any)?.team_name
              : (finalMatchup.team_b as any)?.team_name) ?? 'Unknown';

            const runnerUpName = (runnerUpId === finalMatchup.team_a_id
              ? (finalMatchup.team_a as any)?.team_name
              : (finalMatchup.team_b as any)?.team_name) ?? 'Unknown';

            // Log winner announcement transaction (type = prize_payout)
            await admin.from('transactions').insert({
              league_id: tournament.league_id,
              team_id: winnerId,
              type: 'prize_payout',
              notes: `🏆 Winner of the ${tournament.name} (${winnerName})!`,
            });

            // Log runner-up announcement transaction (type = prize_payout)
            if (runnerUpId) {
              await admin.from('transactions').insert({
                league_id: tournament.league_id,
                team_id: runnerUpId,
                type: 'prize_payout',
                notes: `🥈 Runner-Up of the ${tournament.name} (${runnerUpName})!`,
              });
            }
          }
        }
      } catch (logErr) {
        console.error('[advanceTournament] Failed to log tournament completion activity:', logErr);
      }
    }
  }

  return { ok: true, advanced, gameweek };
}
