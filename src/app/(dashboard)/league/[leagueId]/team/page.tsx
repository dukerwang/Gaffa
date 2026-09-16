import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import NavigationLink from '@/components/ui/NavigationLink';
import { Icon } from '@/components/ui/Icon';
import type { Formation, GranularPosition, MatchupLineup, BenchSlot } from '@/types';
import { FORMATION_SLOTS, POSITION_FLEX_MAP, BENCH_FLEX_MAP } from '@/types';
import PitchUI from './PitchUI';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { getCurrentFplSeason, getLatestReferenceStatsSeason, isFplSeasonKickedOff, resolveDraftStatsSeason } from '@/lib/season/currentSeason';
import { resolveLineupEditMatchup } from '@/lib/lineups/editTarget';
import { getEffectiveLineupForTeam } from '@/lib/lineups/carryForward';
import { getLockedPlTeamIds } from '@/lib/fixtures/lockout';
import { lineupPlayerIds } from '@/lib/lineups/irLock';
import { loadReferenceStats, type RefStatsMap } from '@/lib/scoring/matchups';
import { countBuybackSlots, deriveRosterCapacity } from '@/lib/roster/capacity';
import { buildFacilityViews, effectiveSlots } from '@/lib/facilities/facilities';
import { getHoldState } from '@/lib/roster/holds';
import { buildProjectionMap } from '@/lib/projections/currentProjection';
import type { RawStats } from '@/types';
import styles from './my-team.module.css';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function MyTeamPage({ params }: Props) {
  const { leagueId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const admin = createAdminClient();

  // Wave 1: the club, and FPL's season, kickoff state and current gameweek.
  // None of these reads needs another.
  const [{ data: team }, currentFpl, kickedOff, currentFplGw] = await Promise.all([
    admin
      .from('teams')
      .select(`
      id, team_name, league_id, crest_config, faab_budget, academy_slots, ir_slots, loan_out_slots,
      league:leagues(id, name, season, current_season, previous_season, status, scoring_rules, bench_size, ir_size, taxi_size, taxi_age_limit, roster_size, max_loan_outs)
    `)
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    getCurrentFplSeason(),
    isFplSeasonKickedOff(),
    latestStartedGameweek(),
  ]);

  if (!team) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyIcon}>&#128085;</p>
        <h2 className={styles.emptyTitle}>No team found</h2>
        <p className={styles.emptyText}>You do not have a team in this league.</p>
        <a href="/dashboard" className={styles.backLink}>
          &larr; Back to dashboard
        </a>
      </div>
    );
  }

  // Wave 2: everything keyed on the club and the gameweek alone. The roster
  // has to land before the enrichment reads, which are scoped to it.
  const [
    { data: rosterData },
    { data: listings },
    holdState,
    buybackSlots,
    matchup,
    { data: scoringMatchup },
    season,
    statsSeason,
    refSeason,
  ] = await Promise.all([
    admin
      .from('roster_entries')
      .select(
        `
      id, team_id, player_id, status, acquisition_type, acquisition_value, acquired_at, on_trade_block,
      player:players(${FULL_PLAYER_SELECT})
    `
      )
      .eq('team_id', team.id)
      .order('status', { ascending: true }),
    admin
      .from('player_sale_listings')
      .select('id, player_id, status, min_bid, buy_now_price')
      .eq('league_id', leagueId)
      .in('status', ['pending', 'active']),
    getHoldState(admin, team.id),
    // The cap is not simply `roster_size`: a loan-out that paid its buyback fee
    // holds a slot open, which is why capacity needs the loans table too.
    countBuybackSlots(admin, team.id),
    // This week until its last kickoff; next week after that — not until scores lock.
    resolveLineupEditMatchup(admin, team.id, currentFplGw),
    admin
      .from('matchups')
      .select('id, team_a_id, team_b_id, gameweek, status, lineup_a, lineup_b')
      .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
      .in('status', ['scheduled', 'live'])
      .order('gameweek', { ascending: true })
      .limit(1)
      .maybeSingle(),
    (async () => {
      const fromLeague = (team.league as any).current_season ?? (team.league as any).season ?? currentFpl;
      return fromLeague === currentFpl && !kickedOff
        ? resolveDraftStatsSeason(admin, team.league as any)
        : fromLeague;
    })(),
    currentFplGw ? getCurrentFplSeason(undefined, true) : Promise.resolve(null),
    currentFplGw ? getLatestReferenceStatsSeason(admin) : Promise.resolve(null),
  ]);

  const rosterPlayerIds = (rosterData ?? [])
    .map((e: any) => e.player_id)
    .filter((id: string | null): id is string => !!id);

  // Build a set of active (non-IR) player IDs for sanitization
  const nonIrPlayerIds = new Set(
    (rosterData ?? [])
      .filter((e: any) => e.status === 'active' || e.status === 'bench')
      .map((e: any) => e.player?.id),
  );

  const sameWeek = !!(scoringMatchup && matchup && scoringMatchup.gameweek === matchup.gameweek);
  const displayMatchup = scoringMatchup ?? matchup;
  const opponentId = displayMatchup
    ? displayMatchup.team_a_id === team.id
      ? displayMatchup.team_b_id
      : displayMatchup.team_a_id
    : null;

  // Wave 3: the enrichment reads, this gameweek's points, the lineup being
  // edited, both lockouts and the opponent's name. Each waits only on wave 2.
  const [
    { data: rankings },
    { data: archives },
    liveScoring,
    existingLineup,
    editLocked,
    scoringLocked,
    { data: oppTeam },
  ] = await Promise.all([
    rosterPlayerIds.length > 0
      ? admin.from('player_rankings').select('*').in('player_id', rosterPlayerIds)
      : Promise.resolve({ data: [] as any[] }),
    rosterPlayerIds.length > 0
      ? admin
          .from('season_player_stats_archive')
          .select('player_id, ppg, form_rating, overall_rank, position_ranks')
          .eq('season', season)
          .in('player_id', rosterPlayerIds)
      : Promise.resolve({ data: [] as any[] }),
    // Current GW player points for the score overlay. Non-critical: any failure
    // leaves the overlay without scoring context rather than breaking the page.
    (async () => {
      if (!currentFplGw || !statsSeason || !refSeason) return null;
      try {
        const [{ data: statsRows }, fetchedRefStats] = await Promise.all([
          admin
            .from('player_stats')
            .select('player_id, fantasy_points, stats')
            .eq('season', statsSeason)
            .eq('gameweek', currentFplGw)
            .in('player_id', (rosterData ?? []).map((e: any) => e.player.id)),
          loadReferenceStats(admin, refSeason),
        ]);
        return { statsRows: statsRows ?? [], refStats: fetchedRefStats };
      } catch {
        return null;
      }
    })(),
    (async (): Promise<MatchupLineup | null> => {
      if (!matchup) return null;
      const isTeamA = (matchup as any).team_a_id === team.id;
      const stored = (isTeamA ? matchup.lineup_a : matchup.lineup_b) as MatchupLineup | null;
      if (stored) return stored;

      const carried = await getEffectiveLineupForTeam(admin, {
        teamId: team.id,
        gameweek: (matchup as any).gameweek,
        currentLineup: null,
      });
      // If a past lineup was found, persist it to the matchup row so the DB stays populated
      if (carried) {
        const col = isTeamA ? 'lineup_a' : 'lineup_b';
        await admin.from('matchups').update({ [col]: carried }).eq('id', (matchup as any).id);
      }
      return carried;
    })(),
    matchup ? getLockedPlTeamIds(admin, matchup.gameweek) : Promise.resolve(new Set<number>()),
    scoringMatchup && !sameWeek ? getLockedPlTeamIds(admin, scoringMatchup.gameweek) : Promise.resolve(null),
    opponentId
      ? admin.from('teams').select('team_name').eq('id', opponentId).single()
      : Promise.resolve({ data: null as { team_name: string } | null }),
  ]);

  const archiveMap = new Map((archives ?? []).map((a: any) => [a.player_id, a]));
  const rankMap = new Map((rankings ?? []).map((r: any) => [r.player_id, r]));
  const listingsMap = new Map((listings ?? []).map((l: any) => [l.player_id, l]));

  const rosterEntries = (rosterData ?? []).map((e: any) => {
    const player = e.player as any;
    if (player) {
      const ranks = rankMap.get(player.id);
      const arch = archiveMap.get(player.id);
      player.overall_rank = arch ? arch.overall_rank : ranks?.overall_rank;
      player.position_ranks = arch ? arch.position_ranks : ranks?.position_ranks;
      player.ppg = arch ? Number(arch.ppg) : player.ppg;
      player.form_rating = arch ? Number(arch.form_rating) : player.form_rating;
    }
    e.listing = listingsMap.get(e.player_id) ?? null;
    return e;
  });
  const starters = rosterEntries.filter((e) => e.status === 'active');
  const bench = rosterEntries.filter((e) => e.status === 'bench');
  const ir = rosterEntries.filter((e) => e.status === 'ir');
  const taxi = rosterEntries.filter((e) => e.status === 'taxi');
  // Lineup pool: active + bench status only (excludes IR and taxi — neither can be slotted into the lineup)
  const nonIrEntries = rosterEntries.filter((e) => e.status === 'active' || e.status === 'bench');

  // One derivation for every count on this page and inside the rail.
  const slots = effectiveSlots(team, team.league as any);
  const capacity = deriveRosterCapacity({
    statuses: rosterEntries.map((e) => e.status),
    rosterSize: (team.league as any)?.roster_size,
    irSize: slots.ir,
    taxiSize: slots.academy,
    buybackSlots,
  });
  const maxRosterSize = capacity.limit;
  const loanInCount = capacity.loanedIn;
  const activeRosterCount = capacity.active;

  const scoreMap: Record<string, number> = {};
  const rawStatsMap: Record<string, RawStats> = {};
  let refStats: RefStatsMap | undefined;
  // Minutes played this GW — undefined until the GW is known, so the pitch can
  // tell "no scoring context yet" apart from "played 0 minutes" (DNP).
  let minutesMap: Record<string, number> | undefined;
  if (liveScoring) {
    refStats = liveScoring.refStats;
    minutesMap = {};
    for (const s of liveScoring.statsRows) {
      scoreMap[s.player_id] = (scoreMap[s.player_id] ?? 0) + Number(s.fantasy_points);
      if (s.stats) rawStatsMap[s.player_id] = s.stats as RawStats;
      const minutes = Number((s.stats as { minutes_played?: number } | null)?.minutes_played ?? 0);
      minutesMap[s.player_id] = (minutesMap[s.player_id] ?? 0) + minutes;
    }
  }

  // Determine initial formation and assignments from upcoming matchup lineup
  let initialFormation: Formation = '4-3-3';
  const initialAssignments: Record<number, string> = {};
  const initialBench: Record<string, string | null> = {
    DEF: null,
    MID: null,
    ATT: null,
    FLEX: null,
  };

  if (existingLineup) {
    initialFormation = existingLineup.formation;
    const formationSlots = FORMATION_SLOTS[existingLineup.formation];
    for (let i = 0; i < formationSlots.length; i++) {
      const starter = existingLineup.starters[i];
      // Skip players who have since been moved to IR
      if (starter && nonIrPlayerIds.has(starter.player_id)) {
        initialAssignments[i] = starter.player_id;
      }
    }
    for (const b of existingLineup.bench || []) {
      // Skip players who have since been moved to IR
      if (b.slot && b.player_id && nonIrPlayerIds.has(b.player_id)) {
        initialBench[b.slot] = b.player_id;
      }
    }
  }

  const lockedTeamIds = editLocked;
  const scoringLockedTeamIds = sameWeek ? lockedTeamIds : (scoringLocked ?? new Set<number>());

  const editingAhead = !!(
    matchup && scoringMatchup && matchup.gameweek !== scoringMatchup.gameweek
  );
  const scoringLineupPlayerIds = scoringMatchup
    ? lineupPlayerIds(
        (scoringMatchup.team_a_id === team.id ? scoringMatchup.lineup_a : scoringMatchup.lineup_b) as MatchupLineup | null,
      )
    : [];

  const opponentTeamName: string | null = opponentId ? oppTeam?.team_name ?? null : null;
  const isMatchupLive = scoringLockedTeamIds.size > 0;

  // If no existing lineup, auto-assign starters based on current roster statuses
  if (Object.keys(initialAssignments).length === 0 && starters.length > 0) {
    const slots = FORMATION_SLOTS[initialFormation];
    const used = new Set<string>();

    for (let i = 0; i < slots.length; i++) {
      const slotPos = slots[i];
      const allowed = POSITION_FLEX_MAP[slotPos];
      const candidate = starters.find((e) => {
        if (used.has(e.player.id)) return false;
        const positions: GranularPosition[] = [
          e.player.primary_position,
          ...(e.player.secondary_positions ?? []),
        ];
        return positions.some((p) => allowed.includes(p));
      });
      if (candidate) {
        initialAssignments[i] = candidate.player.id;
        used.add(candidate.player.id);
      }
    }

    // Auto-assign bench slots (must match BENCH_FLEX_MAP so POST /lineup validation succeeds)
    const benchUsed = new Set<string>();
    const benchPool = bench;
    for (const slot of ['DEF', 'MID', 'ATT', 'FLEX'] as BenchSlot[]) {
      const allowed = BENCH_FLEX_MAP[slot];
      const candidate = benchPool.find((e) => {
        if (benchUsed.has(e.player.id)) return false;
        const positions: GranularPosition[] = [
          e.player.primary_position,
          ...(e.player.secondary_positions ?? []),
        ];
        return positions.some((p) => allowed.includes(p));
      });
      if (candidate) {
        initialBench[slot] = candidate.player.id;
        benchUsed.add(candidate.player.id);
      }
    }
  }

  const league = team.league as any;
  const taxiAgeLimit: number = league?.taxi_age_limit ?? 21;

  // Projections are for the round this lineup is being SET for, which is the
  // edit target rather than the scoring week when those differ. Rows stamped
  // for any other round are dropped by buildProjectionMap rather than shown —
  // the sync is hand-run, so a week nobody ran it for must read as no
  // projection, not as last week's number.
  const projectionGameweek = matchup?.gameweek ?? currentFplGw ?? null;
  const projMap = buildProjectionMap(
    rosterEntries.map((e) => e.player as any),
    currentFpl,
    projectionGameweek,
  );

  return (
    <div className={`${styles.page} g-page`}>
      {holdState.holding && (
        <div className={styles.capacityNote}>
          <span className={styles.capacityIcon}><Icon name="alert" size={16} /></span>
          <span>
            {holdState.lineupLocked
              ? `Your lineup is locked while ${holdState.held.length === 1 ? 'a player is' : 'players are'} held, so your last saved lineup is used. Activate or drop ${holdState.held.length === 1 ? 'him' : 'them'} to pick your own lineup.`
              : `${holdState.held.length} player${holdState.held.length === 1 ? '' : 's'} held. Activate or drop ${holdState.held.length === 1 ? 'him' : 'them'}${holdState.lineupLockAt ? ` before ${new Date(holdState.lineupLockAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })} UK time` : ' before the next gameweek kicks off'}, or your lineup locks.`}
          </span>
          <NavigationLink href={`/league/${leagueId}/team/roster`} className={styles.capacityLink}>
            Go to Roster →
          </NavigationLink>
        </div>
      )}

      <PitchUI
        teamId={team.id}
        teamName={team.team_name}
        allEntries={nonIrEntries}
        irEntries={ir}
        taxiEntries={taxi}
        taxiAgeLimit={taxiAgeLimit}
        season={league?.season ?? null}
        initialFormation={initialFormation}
        initialAssignments={initialAssignments}
        initialBench={initialBench as Record<BenchSlot, string | null>}
        scoreMap={scoreMap}
        minutesMap={minutesMap}
        rawStatsMap={rawStatsMap}
        refStats={refStats}
        gameweek={currentFplGw || undefined}
        projMap={projMap}
        projectionGameweek={projectionGameweek}
        lockedTeamIds={lockedTeamIds}
        scoringLockedTeamIds={scoringLockedTeamIds}
        scoringLineupPlayerIds={scoringLineupPlayerIds}
        editingAhead={editingAhead}
        lineupWeekLabel={editingAhead && matchup ? `GW${matchup.gameweek} lineup` : undefined}
        activeRosterCount={activeRosterCount}
        maxRosterSize={maxRosterSize}
        capacity={capacity}
        leagueId={leagueId}
        facilityOffers={(() => {
          const [academy, irView] = buildFacilityViews(slots, { academy: capacity.academy, ir: capacity.ir, loansOut: 0 });
          return { balance: Number((team as any).faab_budget ?? 0), academy, ir: irView };
        })()}
        lineupLocked={holdState.lineupLocked}
        masthead={{
          leagueName: league.name,
          crestConfig: (team as any).crest_config ?? null,
          gameweek: displayMatchup?.gameweek ?? null,
          opponentTeamName: opponentTeamName ?? null,
          isLive: isMatchupLive,
          settingGameweek: editingAhead && matchup ? matchup.gameweek : null,
          loanInCount,
        }}
      />
    </div>
  );
}

/**
 * The latest gameweek whose deadline has passed, or 0 before the season starts
 * or when FPL is unreachable. Hoisted out of the page body so it can join the
 * first wave instead of waiting behind the roster reads.
 */
async function latestStartedGameweek(): Promise<number> {
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: { 'User-Agent': 'FantasyFutbol/1.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const now = new Date();
    let gw = 0;
    for (const ev of data.events as { id: number; deadline_time: string | null }[]) {
      if (ev.deadline_time && new Date(ev.deadline_time) <= now) gw = Math.max(gw, ev.id);
    }
    return gw;
  } catch {
    return 0;
  }
}
