/**
 * Gaffa — Departure Resolver
 *
 * The recurring half of the Retained List. Five jobs, all idempotent and all
 * safe to run on a schedule:
 *
 *   1. Detect retained players who are back in the Premier League and open
 *      their reinstatement window.
 *   2. Expire return windows nobody acted on — the player goes to auction.
 *   3. Put loanees who are back in the Premier League straight onto their
 *      holder's roster.
 *   4. Turn loans that outlived their season into ordinary pending decisions.
 *   5. Auto-release mid-season departures whose decision deadline has passed,
 *      so an unresponsive manager never leaves a player in limbo.
 *
 * Offseason departures are deliberately NOT auto-released here. Their deadline
 * is Kickoff, which resolves them in bulk (see seasonKickoff).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications/createNotification';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { loadRosterCapacity } from '@/lib/roster/capacity';
import { getCurrentFplSeason, isFplSeasonKickedOff } from '@/lib/season/currentSeason';
import { fetchFplElements, findStillInPl } from '@/lib/players/plPresence';
import { getDepartureCompensationRate } from '@/lib/transfers/compensation';
import { lapseReturn, releaseDeparture } from './decisions';
import { findLoanAbroad } from './loanAbroad';
import { midseasonDecideBy } from './detect';
import { RETURN_WINDOW_HOURS, type DepartureDecision } from './types';

export interface ResolveSummary {
  returnsOpened: { decisionId: string; playerName: string; teamName: string }[];
  returnsExpired: { decisionId: string; playerName: string }[];
  autoReleased: { decisionId: string; playerName: string; compensation: number }[];
  loansReturned: { decisionId: string; playerName: string; overCap: boolean }[];
  loansConverted: { decisionId: string; playerName: string }[];
  errors: string[];
}

export async function resolveDepartureDecisions(admin: SupabaseClient): Promise<ResolveSummary> {
  const summary: ResolveSummary = {
    returnsOpened: [],
    returnsExpired: [],
    autoReleased: [],
    loansReturned: [],
    loansConverted: [],
    errors: [],
  };

  await openReturnWindows(admin, summary);
  await expireReturnWindows(admin, summary);
  await returnLoanees(admin, summary);
  await convertUnreturnedLoans(admin, summary);
  await autoReleaseOverdue(admin, summary);

  return summary;
}

/**
 * A retained player reappearing in the FPL bootstrap (is_active back to true)
 * is the return signal. That covers every route back — summer transfer, January
 * window, promotion with his club, a loan into the PL — because all of them end
 * with the player in FPL's squad list again.
 */
async function openReturnWindows(admin: SupabaseClient, summary: ResolveSummary): Promise<void> {
  const { data: retained, error } = await admin
    .from('departure_decisions')
    .select('id, league_id, team_id, player_id')
    .eq('status', 'retained');

  if (error) {
    summary.errors.push(`load retained: ${error.message}`);
    return;
  }
  if (!retained || retained.length === 0) return;

  const playerIds = [...new Set(retained.map((r) => r.player_id as string))];
  const { data: backInPl } = await admin
    .from('players')
    .select('id, name, full_name, sofifa_common_name, web_name, pl_team')
    .eq('is_active', true)
    .in('id', playerIds);

  if (!backInPl || backInPl.length === 0) return;
  const backById = new Map(backInPl.map((p) => [p.id as string, p]));

  const now = new Date();
  const reinstateBy = new Date(now.getTime() + RETURN_WINDOW_HOURS * 60 * 60 * 1000);

  for (const decision of retained) {
    const player = backById.get(decision.player_id as string);
    if (!player) continue;

    const { error: updErr } = await admin
      .from('departure_decisions')
      .update({
        status: 'return_pending',
        returned_at: now.toISOString(),
        reinstate_by: reinstateBy.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', decision.id)
      .eq('status', 'retained'); // lost race = someone else already moved it

    if (updErr) {
      summary.errors.push(`open return ${decision.id}: ${updErr.message}`);
      continue;
    }

    const { data: team } = await admin
      .from('teams')
      .select('team_name, user_id')
      .eq('id', decision.team_id)
      .single();

    const name = getPlayerDisplayName(player, 'full');
    summary.returnsOpened.push({
      decisionId: decision.id as string,
      playerName: name,
      teamName: team?.team_name ?? 'Unknown',
    });

    if (team?.user_id) {
      try {
        await createNotification(admin, {
          kind: 'club',
          leagueId: decision.league_id as string,
          userId: team.user_id,
          title: 'Player Returned',
          content:
            `**${name}** has returned to the Premier League${player.pl_team ? ` with ${player.pl_team}` : ''}. ` +
            `You hold his rights — reinstate him within **${RETURN_WINDOW_HOURS} hours** or he goes to auction. ` +
            `You will need an open squad place.`,
          url: `/league/${decision.league_id}/team/roster`,
        });
      } catch (err) {
        console.error('[departures] return notification failed:', err);
      }
    }
  }
}

/** Return windows nobody acted on. The player goes to open auction. */
async function expireReturnWindows(admin: SupabaseClient, summary: ResolveSummary): Promise<void> {
  const { data: expired, error } = await admin
    .from('departure_decisions')
    .select('id, player_id')
    .eq('status', 'return_pending')
    .lt('reinstate_by', new Date().toISOString());

  if (error) {
    summary.errors.push(`load expired returns: ${error.message}`);
    return;
  }

  for (const decision of expired ?? []) {
    try {
      await lapseReturn(admin, decision.id as string, 'expired');
      const { data: player } = await admin
        .from('players')
        .select('name, full_name, sofifa_common_name, web_name')
        .eq('id', decision.player_id)
        .single();
      summary.returnsExpired.push({
        decisionId: decision.id as string,
        playerName: getPlayerDisplayName(player, 'full'),
      });
    } catch (err) {
      summary.errors.push(`expire return ${decision.id}: ${String(err)}`);
    }
  }
}

/**
 * Loanees back in the Premier League rejoin their holder's roster at once.
 *
 * No reinstatement window, unlike a retained player. A loan ending is the
 * expected outcome rather than news the holder has to plan around, and the
 * holder never gave up anything for him. If the return pushes them over the
 * squad limit, that is the same over-cap state a loan between managers ending
 * already produces: no new signing until someone leaves.
 */
async function returnLoanees(admin: SupabaseClient, summary: ResolveSummary): Promise<void> {
  const { data: loans, error } = await admin
    .from('departure_decisions')
    .select('id, league_id, team_id, player_id')
    .eq('status', 'on_loan');

  if (error) {
    summary.errors.push(`load loans: ${error.message}`);
    return;
  }
  if (!loans || loans.length === 0) return;

  const { data: backInPl } = await admin
    .from('players')
    .select('id, name, full_name, sofifa_common_name, web_name, pl_team')
    .eq('is_active', true)
    .in('id', [...new Set(loans.map((l) => l.player_id as string))]);

  if (!backInPl || backInPl.length === 0) return;
  const backById = new Map(backInPl.map((p) => [p.id as string, p]));

  for (const loan of loans) {
    const player = backById.get(loan.player_id as string);
    if (!player) continue;

    const { data, error: rpcErr } = await admin.rpc('return_from_loan_rpc', { p_decision_id: loan.id });
    if (rpcErr) {
      summary.errors.push(`return loan ${loan.id}: ${rpcErr.message}`);
      continue;
    }
    const row = (data as { team_id: string; new_status: string }[] | null)?.[0];
    if (!row) continue; // lost race

    const capacity = await loadRosterCapacity(admin, row.team_id, null, loan.league_id as string);
    const name = getPlayerDisplayName(player, 'full');
    summary.loansReturned.push({ decisionId: loan.id as string, playerName: name, overCap: capacity.isOver });

    const { data: team } = await admin.from('teams').select('user_id').eq('id', row.team_id).single();
    if (!team?.user_id) continue;

    try {
      await createNotification(admin, {
        kind: 'club',
        leagueId: loan.league_id as string,
        userId: team.user_id,
        title: 'Back From Loan',
        content:
          `**${name}** is back in the Premier League${player.pl_team ? ` with ${player.pl_team}` : ''} ` +
          `and has rejoined your ${row.new_status === 'taxi' ? 'academy' : 'squad'}.` +
          (capacity.isOver
            ? ` You're over the roster limit, so drop or move a player out before your next signing.`
            : ''),
        url: `/league/${loan.league_id}/team/roster`,
      });
    } catch (err) {
      console.error('[departures] loan return notification failed:', err);
    }
  }
}

/**
 * A loan still unresolved once the next season is under way becomes an
 * ordinary pending decision.
 *
 * That covers a loan made permanent, and a player sold on from his loan club.
 * FPL publishes neither as news on the old element, so the signal is absence:
 * the new season has started and he is neither back nor listed as out on loan
 * again. A second loan just rolls the claim over to the new season.
 *
 * Waits for the new season's first deadline rather than the season string
 * changing, because the string flips as soon as last season's final gameweek
 * finishes, weeks before FPL publishes the squads loanees return to.
 */
async function convertUnreturnedLoans(admin: SupabaseClient, summary: ResolveSummary): Promise<void> {
  const { data: loans, error } = await admin
    .from('departure_decisions')
    .select('id, league_id, team_id, player_id, season_from, loan_season, loan_club')
    .eq('status', 'on_loan');

  if (error) {
    summary.errors.push(`load loans for conversion: ${error.message}`);
    return;
  }
  if (!loans || loans.length === 0) return;

  const liveSeason = await getCurrentFplSeason();
  const stale = loans.filter((l) => l.loan_season !== liveSeason);
  if (stale.length === 0) return;
  if (!(await isFplSeasonKickedOff())) return;

  // Unverifiable means untouched: converting opens a decision that can pay out.
  const elements = await fetchFplElements();
  if (!elements) return;

  const playerIds = [...new Set(stale.map((l) => l.player_id as string))];
  const leagueIds = [...new Set(stale.map((l) => l.league_id as string))];
  const [{ data: players }, { data: leagues }] = await Promise.all([
    admin
      .from('players')
      .select('id, name, full_name, sofifa_common_name, web_name, fpl_id, is_active, market_value')
      .in('id', playerIds),
    admin.from('leagues').select('id, status, current_season').in('id', leagueIds),
  ]);
  const playerById = new Map((players ?? []).map((p) => [p.id as string, p]));
  const leagueById = new Map((leagues ?? []).map((l) => [l.id as string, l]));
  const stillInPl = findStillInPl(
    (players ?? []).map((p) => ({ id: p.id as string, name: (p.name ?? p.web_name ?? '') as string })),
    elements,
  );
  const rateByLeague = new Map<string, number>();

  for (const loan of stale) {
    const player = playerById.get(loan.player_id as string);
    // Active players are returnLoanees' job, and a row that only looks departed
    // because the sync mismatched it is not a departure (plPresence.ts).
    if (!player || player.is_active || stillInPl.has(player.id as string)) continue;

    const nowIso = new Date().toISOString();
    const again = findLoanAbroad(
      { fpl_id: (player.fpl_id as number | null) ?? null, name: (player.name ?? player.web_name ?? '') as string },
      elements,
    );
    if (again) {
      const { error: rollErr } = await admin
        .from('departure_decisions')
        .update({ loan_season: liveSeason, loan_club: again.club ?? loan.loan_club, updated_at: nowIso })
        .eq('id', loan.id)
        .eq('status', 'on_loan');
      if (rollErr) summary.errors.push(`roll loan ${loan.id}: ${rollErr.message}`);
      continue;
    }

    const leagueId = loan.league_id as string;
    if (!rateByLeague.has(leagueId)) {
      rateByLeague.set(leagueId, await getDepartureCompensationRate(admin, leagueId));
    }
    const marketValue = Number(player.market_value ?? 0);
    const offer = Math.round(marketValue * rateByLeague.get(leagueId)! * 100) / 100;
    const league = leagueById.get(leagueId);
    const inSeason = league?.status === 'active' && league.current_season === liveSeason;
    const decideBy = inSeason ? midseasonDecideBy() : null;

    const { data: converted, error: convErr } = await admin
      .from('departure_decisions')
      .update({
        status: 'pending',
        // The holder now is who faces the choice, and nobody has taken cash for
        // this player yet, so the buy-back exclusion belongs to them rather than
        // to whoever held him when the loan began.
        original_team_id: loan.team_id,
        season_from: loan.loan_season ?? loan.season_from,
        market_value_at_departure: marketValue,
        compensation_offered: offer,
        compensation_paid: null,
        decided_at: null,
        decide_by: decideBy ? decideBy.toISOString() : null,
        notes: 'Loan ended without a return to the Premier League.',
        updated_at: nowIso,
      })
      .eq('id', loan.id)
      .eq('status', 'on_loan')
      .select('id');

    if (convErr) {
      summary.errors.push(`convert loan ${loan.id}: ${convErr.message}`);
      continue;
    }
    if (!converted || converted.length === 0) continue;

    const name = getPlayerDisplayName(player, 'full');
    summary.loansConverted.push({ decisionId: loan.id as string, playerName: name });

    const { data: team } = await admin.from('teams').select('user_id').eq('id', loan.team_id).single();
    if (!team?.user_id) continue;
    try {
      await createNotification(admin, {
        kind: 'club',
        leagueId,
        userId: team.user_id,
        title: 'Decision Needed',
        content:
          `**${name}** hasn't come back from his loan, so he's now treated as having left the Premier League. ` +
          `Release him for **€${offer}m**, or retain his rights and keep him if he ever returns.` +
          (decideBy
            ? ` You have until ${decideBy.toUTCString()} to decide.`
            : ' You can decide any time before the season kicks off.'),
        url: `/league/${leagueId}/team/roster`,
      });
    } catch (err) {
      console.error('[departures] loan conversion notification failed:', err);
    }
  }
}

/**
 * Mid-season departures whose decision deadline has passed default to release.
 *
 * Release rather than retain is the safe default in both directions: it pays
 * the manager something rather than silently consuming a scarce retained slot
 * they never asked to spend, and it puts the player back into circulation.
 */
async function autoReleaseOverdue(admin: SupabaseClient, summary: ResolveSummary): Promise<void> {
  const { data: overdue, error } = await admin
    .from('departure_decisions')
    .select('id, player_id')
    .eq('status', 'pending')
    .not('decide_by', 'is', null)
    .lt('decide_by', new Date().toISOString());

  if (error) {
    summary.errors.push(`load overdue: ${error.message}`);
    return;
  }

  for (const decision of overdue ?? []) {
    try {
      const result = await releaseDeparture(admin, decision.id as string);
      if (!result) continue;
      const { data: player } = await admin
        .from('players')
        .select('name, full_name, sofifa_common_name, web_name')
        .eq('id', decision.player_id)
        .single();
      summary.autoReleased.push({
        decisionId: decision.id as string,
        playerName: getPlayerDisplayName(player, 'full'),
        compensation: result.compensation,
      });
    } catch (err) {
      summary.errors.push(`auto-release ${decision.id}: ${String(err)}`);
    }
  }
}

export type { DepartureDecision };
