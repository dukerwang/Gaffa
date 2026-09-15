import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadLoanOutSlots } from '@/lib/facilities/server';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { HOLD_FREEZE_MESSAGE, isHolding } from '@/lib/roster/holds';
import { buildEffectivePpgMap } from '@/lib/transfers/effectivePpg';
import { getCurrentFplSeason, previousSeason as seasonBefore } from '@/lib/season/currentSeason';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const { leagueId } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Everything the response needs that does not depend on the caller's team id
  // fetches together; the reads keyed on it follow.
  const [{ data: myTeam }, { data: league }, { data: loans }] = await Promise.all([
    admin
      .from('teams')
      .select('id, team_name, faab_budget')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('leagues')
      .select('loan_slot_buyback_fee, loan_bonus_cap_default, max_loan_outs, max_loan_ins, total_gameweeks, roster_locked, current_season, previous_season')
      .eq('id', leagueId)
      .maybeSingle(),
    admin
      .from('player_loans')
      .select(`
      *,
      lender_team:teams!lender_team_id(id, team_name),
      borrower_team:teams!borrower_team_id(id, team_name),
      player:players(${FULL_PLAYER_SELECT})
    `)
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false }),
  ]);

  if (!myTeam) return NextResponse.json({ error: 'No team in this league' }, { status: 403 });
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  // The season strings used to fall back to hardcoded '2025-26' / '2024-25'.
  // They come from FPL now, like everywhere else.
  const currentSeason = league.current_season || (await getCurrentFplSeason());
  const previousSeason = league.previous_season || seasonBefore(currentSeason);

  const [{ data: myRosterEntries }, maxLoanOuts, { data: allTeams }] = await Promise.all([
    admin
      .from('roster_entries')
      .select(`status, player:players(${FULL_PLAYER_SELECT})`)
      .eq('team_id', myTeam.id),
    // Per team, not per league: a club can buy extra loan-out places (migration 166).
    loadLoanOutSlots(admin, myTeam.id, league.max_loan_outs),
    // Unordered, like it always was, so the same query keeps the same row order.
    admin
      .from('teams')
      .select('id, team_name, user_id, faab_budget')
      .eq('league_id', leagueId)
      .neq('id', myTeam.id),
  ]);

  const playerIds = new Set<string>();
  const playerMarketValueMap: Record<string, number> = {};
  for (const p of [
    ...(myRosterEntries ?? []).map((e) => e.player as any),
    ...(loans ?? []).map((l) => l.player as any),
  ]) {
    if (p?.id) {
      playerIds.add(p.id);
      playerMarketValueMap[p.id] = Number(p.market_value) || 0;
    }
  }

  // The shared model (src/lib/transfers/effectivePpg.ts). This route carried
  // its own copy of it, reading player_stats in one unpaginated request: a
  // squad plus the league's loan players across two seasons runs past
  // PostgREST's 1,000-row cap, and the rows dropped were the oldest — the prior
  // season that thin current-season samples lean on.
  const recentPpgMap = await buildEffectivePpgMap(
    admin,
    Array.from(playerIds),
    currentSeason,
    previousSeason,
    playerMarketValueMap,
  );

  // Enrich player objects with recent_ppg
  const enrichedLoans = (loans ?? []).map((l) => {
    if (l.player) {
      return {
        ...l,
        player: {
          ...l.player,
          recent_ppg: recentPpgMap[l.player.id] ?? Math.max(3.0, l.player.ppg ?? 3.0)
        }
      };
    }
    return l;
  });

  const loansOut = enrichedLoans.filter(l => l.lender_team_id === myTeam.id);
  const loansIn = enrichedLoans.filter(l => l.borrower_team_id === myTeam.id);

  const myRoster = (myRosterEntries ?? []).map((e) => ({
    ...e,
    player: e.player ? {
      ...(e.player as any),
      recent_ppg: recentPpgMap[(e.player as any).id] ?? Math.max(3.0, (e.player as any).ppg ?? 3.0)
    } : null
  }));

  // Map of players involved in loans
  const playerMap: Record<string, any> = {};
  for (const l of enrichedLoans) {
    if (l.player) {
      playerMap[l.player.id] = l.player;
    }
  }

  return NextResponse.json({
    myTeam,
    loansOut,
    loansIn,
    allTeams: allTeams ?? [],
    myRoster,
    playerMap,
    leagueSettings: {
      loan_slot_buyback_fee: league?.loan_slot_buyback_fee ?? 25,
      loan_bonus_cap_default: league?.loan_bonus_cap_default ?? 0,
      max_loan_outs: maxLoanOuts,
      max_loan_ins: league?.max_loan_ins ?? 2,
      total_gameweeks: league?.total_gameweeks ?? 38,
      roster_locked: league?.roster_locked ?? false
    }
  });
}

export async function POST(req: NextRequest, { params }: Props) {
  const { leagueId } = await params;

  // 1. Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // 2. Caller must have a team in this league
  const { data: myTeam } = await admin
    .from('teams')
    .select('id, team_name, abbreviation, faab_budget')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single();

  if (!myTeam) return NextResponse.json({ error: 'No team in this league' }, { status: 403 });

  // 3. Parse and validate body
  const body = await req.json();
  // requestMode = true means the CALLER is the borrower requesting a player from lenderTeamId.
  // Classic mode (requestMode = false/undefined): caller is the lender proposing to borrowerTeamId.
  const { borrowerTeamId, lenderTeamId, playerId, loanFee, startGameweek, endGameweek, bonusRate, bonusCap: clientBonusCap, hasRecall, message, requestMode, parentLoanId: requestedParentLoanId } = body as {
    borrowerTeamId?: string;
    lenderTeamId?: string;
    playerId: string;
    loanFee: number;
    startGameweek: number;
    endGameweek: number;
    bonusRate: number;
    bonusCap?: number;
    hasRecall: boolean;
    message?: string;
    requestMode?: boolean;
    /** Set when this proposal counters a pending loan — that loan is rejected and chained via parent_loan_id. */
    parentLoanId?: string;
  };

  // Resolve effective lender/borrower based on mode
  const effectiveLenderTeamId = requestMode ? (lenderTeamId ?? '') : myTeam.id;
  const effectiveBorrowerTeamId = requestMode ? myTeam.id : (borrowerTeamId ?? '');
  const proposedBy: 'lender' | 'borrower' = requestMode ? 'borrower' : 'lender';

  if (!effectiveLenderTeamId || !effectiveBorrowerTeamId || !playerId || loanFee === undefined || startGameweek === undefined || endGameweek === undefined || bonusRate === undefined || hasRecall === undefined) {
    return NextResponse.json({ error: 'Missing required loan terms parameters' }, { status: 400 });
  }

  if (effectiveLenderTeamId === effectiveBorrowerTeamId) {
    return NextResponse.json({ error: 'Cannot loan a player to yourself' }, { status: 400 });
  }

  if (requestMode && effectiveLenderTeamId === myTeam.id) {
    return NextResponse.json({ error: 'Cannot request a loan of your own player — use Propose Loan instead' }, { status: 400 });
  }

  if (!Number.isInteger(loanFee) || loanFee < 0) {
    return NextResponse.json({ error: 'loanFee must be a non-negative integer' }, { status: 400 });
  }

  if (typeof bonusRate !== 'number' || bonusRate < 0) {
    return NextResponse.json({ error: 'bonusRate must be a non-negative number' }, { status: 400 });
  }

  if (!Number.isInteger(startGameweek) || !Number.isInteger(endGameweek)) {
    return NextResponse.json({ error: 'Gameweeks must be integers' }, { status: 400 });
  }

  if (endGameweek <= startGameweek) {
    return NextResponse.json({ error: 'endGameweek must be greater than startGameweek' }, { status: 400 });
  }

  const duration = endGameweek - startGameweek;
  if (duration < 4 || duration > 16) {
    return NextResponse.json({ error: 'Loan duration must be between 4 and 16 gameweeks' }, { status: 400 });
  }

  // 4. Fetch league config
  const { data: league } = await admin
    .from('leagues')
    .select('roster_locked, total_gameweeks, loan_slot_buyback_fee, loan_bonus_cap_default, max_loan_outs, max_loan_ins')
    .eq('id', leagueId)
    .single();

  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  if (league.roster_locked) {
    return NextResponse.json({ error: 'Rosters are locked. Loan proposals are not permitted.' }, { status: 403 });
  }

  // 5. Fetch current FPL GW to enforce season timing (loans blocked in final 8 GWs)
  let currentFplGw = 0;
  try {
    const fplRes = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: { 'User-Agent': 'FantasyFutbol/1.0' },
      next: { revalidate: 3600 },
    });
    if (fplRes.ok) {
      const fplData = await fplRes.json();
      const now = new Date();
      for (const ev of fplData.events as any[]) {
        if (ev.deadline_time && new Date(ev.deadline_time) <= now) {
          currentFplGw = Math.max(currentFplGw, ev.id);
        }
      }
    }
  } catch (err) {
    console.error('[loans] Failed to fetch current GW from FPL:', err);
  }

  const totalGws = league.total_gameweeks ?? 38;
  const lastAllowedStartGw = totalGws - 8;
  if (startGameweek > lastAllowedStartGw) {
    return NextResponse.json({ error: `Loans cannot start after GW${lastAllowedStartGw}. The final 8 gameweeks are locked for loans.` }, { status: 400 });
  }

  if (endGameweek > totalGws) {
    return NextResponse.json({ error: `Loan end GW${endGameweek} exceeds this season's ${totalGws} total GWs.` }, { status: 400 });
  }

  // 6. Player ownership and status checks (ownership is always on lender's roster)
  const { data: rosterEntry } = await admin
    .from('roster_entries')
    .select('id, status')
    .eq('team_id', effectiveLenderTeamId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (!rosterEntry) {
    return NextResponse.json({
      error: requestMode ? 'The requested player is not on that team\'s roster' : 'Player is not on your roster'
    }, { status: 400 });
  }

  // Academy (taxi) is loanable — IR and in-progress loans are not.
  if (['ir', 'loan_in', 'loan_out', 'held'].includes(rosterEntry.status)) {
    return NextResponse.json({ error: `Cannot loan out a player who is currently in status '${rosterEntry.status}'` }, { status: 400 });
  }

  // 7. Check if player has an active/pending loan already
  const { data: activeLoanForPlayer } = await admin
    .from('player_loans')
    .select('id')
    .eq('league_id', leagueId)
    .eq('player_id', playerId)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  if (activeLoanForPlayer) {
    return NextResponse.json({ error: 'This player is already involved in an active or pending loan' }, { status: 409 });
  }

  // 7b. A listed player can be loaned unless bidding has started.
  //
  // Only one refusal remains. 'active' means bidding is live: nothing can be
  // arranged privately around an auction other managers have committed budget
  // to, and the listing can no longer be cancelled to make way (see the DELETE
  // handler in listings/[listingId]/route.ts). Hard no.
  //
  // `open_to_loan` used to be the second refusal, and it made listing a player
  // REMOVE a way to reach him — anyone may ask about an unlisted player on any
  // roster, but a listed one was unreachable unless the seller had ticked a box
  // that defaults to false. 088 turned it into intent: it now advertises what
  // the seller wants and sorts the board, and refuses nobody.
  //
  // Otherwise the loan may be proposed: accepting it cancels the still-pending
  // listing, and 080's trg_withdraw_listing_auction_anchor rejects the auction
  // anchor in the same transaction. See the accept handler, which re-checks
  // this — the listing can go live between proposal and acceptance.
  const { data: openListingForPlayer } = await admin
    .from('player_sale_listings')
    .select('id, status')
    .eq('league_id', leagueId)
    .eq('player_id', playerId)
    .in('status', ['pending', 'active'])
    .maybeSingle();

  if (openListingForPlayer?.status === 'active') {
    return NextResponse.json(
      { error: 'Player is in an active auction — cannot propose loans until the auction resolves.' },
      { status: 409 },
    );
  }

  // 8. Check active loan limits (count active + deferred + pending_activation)
  const ACTIVE_LOAN_STATUSES = ['active', 'accepted_deferred', 'pending_activation'];

  const { count: lenderActiveLoans } = await admin
    .from('player_loans')
    .select('id', { count: 'exact', head: true })
    .eq('lender_team_id', effectiveLenderTeamId)
    .in('status', ACTIVE_LOAN_STATUSES);

  const maxOuts = await loadLoanOutSlots(admin, effectiveLenderTeamId, league.max_loan_outs);
  if ((lenderActiveLoans ?? 0) >= maxOuts) {
    return NextResponse.json({ error: `The lender has reached the maximum number of active loan-outs (${maxOuts})` }, { status: 400 });
  }

  const { count: borrowerActiveLoans } = await admin
    .from('player_loans')
    .select('id', { count: 'exact', head: true })
    .eq('borrower_team_id', effectiveBorrowerTeamId)
    .in('status', ACTIVE_LOAN_STATUSES);

  const maxIns = league.max_loan_ins ?? 2;
  if ((borrowerActiveLoans ?? 0) >= maxIns) {
    return NextResponse.json({ error: `The borrower has reached the maximum number of active loan-ins (${maxIns})` }, { status: 400 });
  }

  // Held players (R7): a team holding a player can't borrow. Acceptance
  // re-checks under lock (migration 163).
  if (await isHolding(admin, effectiveBorrowerTeamId)) {
    return NextResponse.json({
      error: requestMode ? HOLD_FREEZE_MESSAGE : 'That club has a held player and can’t take a loan until it’s resolved.',
    }, { status: 409 });
  }

  // 9. Determine bonus cap
  let bonusCap = 0;
  if (bonusRate > 0) {
    if (clientBonusCap !== undefined) {
      bonusCap = clientBonusCap;
    } else if (league.loan_bonus_cap_default > 0) {
      bonusCap = league.loan_bonus_cap_default;
    } else {
      bonusCap = loanFee * 3;
    }

    if (loanFee === 0 && bonusCap === 0) {
      return NextResponse.json({
        error: 'A performance bonus clause on a €0-fee loan is invalid because the bonus cap is calculated as 3x the loan fee (€0). Please set a loan fee of at least €1m or ask the commissioner to configure a default flat cap.'
      }, { status: 400 });
    }
  }

  // Verify the counterparty team is in this league
  const counterpartyTeamId = requestMode ? effectiveLenderTeamId : effectiveBorrowerTeamId;
  const { data: counterpartyTeam } = await admin
    .from('teams')
    .select('id, team_name, user_id')
    .eq('id', counterpartyTeamId)
    .eq('league_id', leagueId)
    .single();

  if (!counterpartyTeam) return NextResponse.json({ error: 'Target team not found in this league' }, { status: 404 });

  // 10. Fetch player details
  const { data: player } = await admin
    .from('players')
    .select('id, name')
    .eq('id', playerId)
    .single();

  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  // 10b. Counter-offer: reject the parent loan (if still pending) and chain this
  // one to it, mirroring trade_proposals.parent_trade_id (029_trade_block.sql).
  let parentLoanId: string | undefined;
  if (requestedParentLoanId) {
    const { data: parentLoan } = await admin
      .from('player_loans')
      .select('id, status, lender_team_id, borrower_team_id')
      .eq('id', requestedParentLoanId)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (!parentLoan) {
      return NextResponse.json({ error: 'The loan you are countering no longer exists.' }, { status: 404 });
    }
    if (parentLoan.status !== 'pending') {
      return NextResponse.json({ error: `That loan proposal is ${parentLoan.status} and can no longer be countered.` }, { status: 409 });
    }
    if (parentLoan.lender_team_id !== myTeam.id && parentLoan.borrower_team_id !== myTeam.id) {
      return NextResponse.json({ error: 'You are not a party to that loan proposal.' }, { status: 403 });
    }

    await admin.from('player_loans').update({ status: 'rejected' }).eq('id', parentLoan.id);
    parentLoanId = parentLoan.id;
  }

  // 11. Create the loan proposal/request
  const { data: loan, error: insertError } = await admin
    .from('player_loans')
    .insert({
      league_id: leagueId,
      lender_team_id: effectiveLenderTeamId,
      borrower_team_id: effectiveBorrowerTeamId,
      player_id: playerId,
      loan_fee: loanFee,
      start_gameweek: startGameweek,
      end_gameweek: endGameweek,
      bonus_rate: bonusRate,
      bonus_cap: bonusCap,
      has_recall: hasRecall,
      status: 'pending',
      origin_status: rosterEntry.status,
      proposed_by: proposedBy,
      message: message ?? null,
      parent_loan_id: parentLoanId ?? null
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 12. Send in-app notification & private DM to the counterparty (the one who
  // needs to accept). In-app + push only — a proposal is routine, pre-decision
  // noise; the completion email still fires once the loan is actually agreed
  // (see loans/[loanId]/route.ts).
  try {
    const { createNotification } = await import('@/lib/notifications/createNotification');
    const { clubAbbr } = await import('@/lib/notifications/clubRef');
    const abbr = clubAbbr(myTeam);
    if (requestMode) {
      await createNotification(admin, {
        kind: 'deals',
        leagueId,
        userId: counterpartyTeam.user_id,
        title: `${abbr} want ${player.name}`,
        pushTitle: `${abbr} want ${player.name}`,
        content: `**${myTeam.team_name}** want **${player.name}** on loan for GW${startGameweek}–GW${endGameweek}. Fee: €${loanFee}m. Waiting on you.${message ? ` Message: "${message}"` : ''}`,
        pushBody: `${player.name} loan. Waiting on you.`,
        url: `/league/${leagueId}/transfers/deals`
      });
    } else {
      await createNotification(admin, {
        kind: 'deals',
        leagueId,
        userId: counterpartyTeam.user_id,
        title: `${abbr} offer ${player.name}`,
        pushTitle: `${abbr} offer ${player.name}`,
        content: `**${myTeam.team_name}** have offered **${player.name}** on loan for GW${startGameweek}–GW${endGameweek}. Fee: €${loanFee}m. Waiting on you.${message ? ` Message: "${message}"` : ''}`,
        pushBody: `${player.name} loan. Waiting on you.`,
        url: `/league/${leagueId}/transfers/deals`
      });
    }

    // Private DM to counterparty manager. The card is driven live off `loan_id`
    // (see ChatClient/LoanOfferCard) — this text is only a plain-language
    // fallback for search/accessibility.
    await admin.from('chat_messages').insert({
      league_id: leagueId,
      sender_id: user.id,
      recipient_id: counterpartyTeam.user_id,
      loan_id: loan.id,
      message: parentLoanId
        ? `${myTeam.team_name} sent a counter loan offer to ${counterpartyTeam.team_name}`
        : requestMode
          ? `${myTeam.team_name} requested to loan ${player.name} from ${counterpartyTeam.team_name}`
          : `${myTeam.team_name} proposed to loan ${player.name} to ${counterpartyTeam.team_name}`,
    });

  } catch (err) {
    console.error('Failed to send loan notifications:', err);
  }

  return NextResponse.json({ loan }, { status: 201 });
}
