/* eslint-disable @typescript-eslint/no-explicit-any -- untyped PostgREST rows, as in buildHomeModel */
/**
 * buildDashboardModel — the home screen in one server-side read.
 *
 * The dashboard is the app's front door, so it answers three things in order:
 * how each of your clubs is doing right now (the league cards), what is
 * happening in the Premier League this week (ratings and fixtures), and where
 * to go next (create, join, the guide). It deliberately does not repeat League
 * Home: no alerts, standings tables or transaction feeds. Those live one tap
 * away, inside each league.
 *
 * Follows the `buildHomeModel` precedent: the page is a thin renderer over a
 * fully resolved view model.
 */

import type { createAdminClient } from '@/lib/supabase/admin';
import type { FplStatus } from '@/lib/fpl/api';
import type { GwFixture } from '@/lib/fpl/fixtures';
import type { GranularPosition } from '@/types';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { resolveClub } from '@/lib/clubs/registry';
import { isDrawMargin } from '@/lib/scoring/drawBand';
import { resolveEffectiveLineupFromMatchups } from '@/lib/lineups/carryForward';
import { getCrestColor, getInitials } from '@/app/(dashboard)/dashboard/crest';

type AdminClient = ReturnType<typeof createAdminClient>;

// ── Public shapes ─────────────────────────────────────────────

export interface CardSide {
  teamId: string;
  name: string;
  crest: unknown;
  /** Manager username; null for your own side, which reads "You". */
  manager: string | null;
  rank: number | null;
  record: string | null;
}

export type MatchState = 'upcoming' | 'live' | 'provisional' | 'final';

export interface MatchCardModel {
  state: MatchState;
  gameweek: number;
  matchupId: string;
  mine: CardSide;
  theirs: CardSide;
  mineScore: number | null;
  theirScore: number | null;
  /** Your share of the combined score, 0-100. Null before kickoff. */
  sharePct: number | null;
  verdict: string | null;
  tone: 'ahead' | 'behind' | 'level' | null;
  playersLeft: { mine: number; theirs: number } | null;
  deadline: string | null;
}

export interface LeagueCardModel {
  leagueId: string;
  leagueName: string;
  leagueInitials: string;
  leagueColor: string;
  myTeamId: string;
  myTeamName: string;
  myCrest: unknown;
  kind: 'match' | 'drafting' | 'setup' | 'offseason';
  match: MatchCardModel | null;
  drafting: { round: number; totalRounds: number; pick: number; isMyTurn: boolean } | null;
  setup: { joined: number; max: number; isCommissioner: boolean } | null;
  offseason: { rank: number | null } | null;
}

export interface RatedPlayer {
  playerId: string;
  name: string;
  position: GranularPosition | null;
  club: string | null;
  clubBadge: string | null;
  rating: number;
  photoUrl: string | null;
  photoVersion: string | null;
}

export interface RoleRatingPair {
  gameweek: number;
  total: number;
  keeper: RatedPlayer & { rank: number };
  striker: RatedPlayer & { rank: number };
}

export interface FixtureRow {
  id: number;
  homeName: string;
  awayName: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string | null;
  state: 'live' | 'finished' | 'upcoming';
  minutes: number;
}

export interface DashboardModel {
  gameweek: number;
  isLive: boolean;
  nextDeadline: string | null;
  cards: LeagueCardModel[];
  counts: { live: number; drafting: number; setup: number; offseason: number };
  topRated: {
    matchweek: { gameweek: number; players: RatedPlayer[] } | null;
    season: RatedPlayer[];
  };
  roleRatings: RoleRatingPair | null;
  fixtures: {
    rows: FixtureRow[];
    finished: number;
    live: number;
    toCome: number;
    firstKickoff: string | null;
    lastKickoff: string | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────

const PLAYER_FIELDS =
  'id, web_name, name, full_name, sofifa_common_name, primary_position, pl_team, photo_url, photo_version';

function snakeDraftOrder(pickNumber: number, numTeams: number): number {
  const round = Math.floor((pickNumber - 1) / numTeams);
  const posInRound = (pickNumber - 1) % numTeams;
  return round % 2 === 0 ? posInRound + 1 : numTeams - posInRound;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function toRated(player: any, rating: number): RatedPlayer {
  const club = player?.pl_team ? resolveClub(player.pl_team) : null;
  return {
    playerId: player?.id ?? '',
    name: getPlayerDisplayName(player, 'full'),
    position: (player?.primary_position as GranularPosition) ?? null,
    club: club?.name ?? player?.pl_team ?? null,
    clubBadge: club ? `/team-logos/${club.slug}.png` : null,
    rating: Number(rating),
    photoUrl: player?.photo_url ?? null,
    photoVersion: player?.photo_version ?? null,
  };
}

const fmt1 = (n: number) => n.toFixed(1);

// ── Builder ───────────────────────────────────────────────────

export async function buildDashboardModel(
  admin: AdminClient,
  userId: string,
  fpl: FplStatus,
  fixtures: GwFixture[],
  season: string,
): Promise<DashboardModel> {
  const serverNow = Date.now();

  const { data: teamRows } = await admin
    .from('teams')
    .select(
      'id, team_name, crest_config, draft_order, league:leagues(id, name, status, max_teams, roster_size, commissioner_id)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const myTeams = ((teamRows ?? []) as any[])
    .map((t) => ({ ...t, league: one(t.league) }))
    .filter((t) => t.league);

  const leagueIds = [...new Set(myTeams.map((t) => t.league.id as string))];
  const matchLeagueIds = myTeams.filter((t) => t.league.status === 'active').map((t) => t.league.id);
  const draftingIds = myTeams.filter((t) => t.league.status === 'drafting').map((t) => t.league.id);
  const maxGw = Math.max(fpl.currentGw, fpl.nextGw ?? fpl.currentGw);

  const ratedGw = fpl.currentGw;

  const [standingsRes, membersRes, matchupsRes, draftTeamsRes, draftPicksRes, gwTopRes, seasonTopRes] =
    await Promise.all([
      leagueIds.length
        ? admin.from('league_standings').select('league_id, team_id, rank, wins, draws, losses').in('league_id', leagueIds)
        : Promise.resolve({ data: [] as any[] }),
      leagueIds.length
        ? admin.from('league_members').select('league_id').in('league_id', leagueIds)
        : Promise.resolve({ data: [] as any[] }),
      matchLeagueIds.length
        ? admin
            .from('matchups')
            .select('id, league_id, gameweek, team_a_id, team_b_id, score_a, score_b, status, lineup_a, lineup_b')
            .in('league_id', matchLeagueIds)
            .lte('gameweek', maxGw)
            .order('gameweek', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      draftingIds.length
        ? admin.from('teams').select('id, league_id').in('league_id', draftingIds)
        : Promise.resolve({ data: [] as any[] }),
      draftingIds.length
        ? admin.from('draft_picks').select('league_id').in('league_id', draftingIds)
        : Promise.resolve({ data: [] as any[] }),
      Promise.all(
        [ratedGw, Math.max(1, ratedGw - 1)].map((gw) =>
          admin
            .from('player_stats')
            .select(`player_id, gameweek, match_rating, player:players!player_id(${PLAYER_FIELDS})`)
            .eq('season', season)
            .eq('gameweek', gw)
            .gt('match_rating', 0)
            .order('match_rating', { ascending: false })
            .limit(12),
        ),
      ).then((res) => ({ data: res.flatMap((r) => (r.data ?? []) as any[]) })),
      admin.rpc('season_top_rated', { p_season: season, p_limit: 6 }),
    ]);

  const standings = (standingsRes.data ?? []) as any[];
  const standingOf = (teamId: string) => standings.find((s) => s.team_id === teamId) ?? null;
  const recordOf = (teamId: string) => {
    const s = standingOf(teamId);
    return s ? `${s.wins}–${s.draws}–${s.losses}` : null;
  };

  // ── Top rated ──────────────────────────────────────────────
  // The current gameweek's list while it has ratings; otherwise the one before
  // it, so the band never goes blank in the days between deadline and kickoff.
  const gwRows = (gwTopRes.data ?? []) as any[];
  const pickGw = gwRows.some((r) => r.gameweek === ratedGw) ? ratedGw : Math.max(1, ratedGw - 1);
  const seen = new Set<string>();
  const matchweekPlayers: RatedPlayer[] = [];
  for (const r of gwRows) {
    if (r.gameweek !== pickGw || seen.has(r.player_id)) continue;
    seen.add(r.player_id);
    matchweekPlayers.push(toRated(one(r.player), r.match_rating));
    if (matchweekPlayers.length === 6) break;
  }

  const seasonRows = (seasonTopRes.data ?? []) as { player_id: string; avg_rating: number }[];
  let seasonPlayers: RatedPlayer[] = [];
  if (seasonRows.length) {
    const { data: seasonPlayerRows } = await admin
      .from('players')
      .select(PLAYER_FIELDS)
      .in('id', seasonRows.map((r) => r.player_id));
    const byId = new Map(((seasonPlayerRows ?? []) as any[]).map((p) => [p.id, p]));
    seasonPlayers = seasonRows
      .filter((r) => byId.has(r.player_id))
      .map((r) => toRated(byId.get(r.player_id), r.avg_rating));
  }

  // ── Fixtures ──────────────────────────────────────────────
  const rows: FixtureRow[] = fixtures.map((f) => ({
    id: f.id,
    homeName: f.homeName,
    awayName: f.awayName,
    homeBadge: f.homeBadge,
    awayBadge: f.awayBadge,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    kickoff: f.kickoff,
    state: f.finished ? 'finished' : f.started ? 'live' : 'upcoming',
    minutes: f.minutes,
  }));
  const order = { live: 0, finished: 1, upcoming: 2 } as const;
  rows.sort((a, b) => order[a.state] - order[b.state]);
  const dated = fixtures.map((f) => f.kickoff).filter((k): k is string => !!k).sort();
  const fixturesModel = {
    rows,
    finished: rows.filter((r) => r.state === 'finished').length,
    live: rows.filter((r) => r.state === 'live').length,
    toCome: rows.filter((r) => r.state === 'upcoming').length,
    firstKickoff: dated[0] ?? null,
    lastKickoff: dated[dated.length - 1] ?? null,
  };

  // ── League cards ──────────────────────────────────────────
  const memberCount = new Map<string, number>();
  for (const r of (membersRes.data ?? []) as any[]) {
    memberCount.set(r.league_id, (memberCount.get(r.league_id) ?? 0) + 1);
  }
  const draftTeamCount = new Map<string, number>();
  for (const r of (draftTeamsRes.data ?? []) as any[]) {
    draftTeamCount.set(r.league_id, (draftTeamCount.get(r.league_id) ?? 0) + 1);
  }
  const pickCount = new Map<string, number>();
  for (const r of (draftPicksRes.data ?? []) as any[]) {
    pickCount.set(r.league_id, (pickCount.get(r.league_id) ?? 0) + 1);
  }

  const allMatchups = (matchupsRes.data ?? []) as any[];

  // FPL only marks a gameweek finished after the post-match review, but once
  // every fixture is over nobody is still playing: the score is provisional,
  // not live.
  const allFixturesDone =
    fpl.displayGw === fpl.currentGw && fixtures.length > 0 && fixtures.every((f) => f.finished);

  // Pick the one matchup each card is about.
  type Chosen = { matchup: any; state: MatchState; myTeamId: string; leagueId: string };
  const chosen: Chosen[] = [];
  for (const t of myTeams.filter((x) => x.league.status === 'active')) {
    const mine = allMatchups.filter(
      (m) => m.league_id === t.league.id && (m.team_a_id === t.id || m.team_b_id === t.id),
    );
    const cur = mine.find((m) => m.gameweek === fpl.currentGw) ?? null;
    const next = fpl.nextGw ? mine.find((m) => m.gameweek === fpl.nextGw) ?? null : null;
    let pick: Chosen | null = null;
    if (cur?.status === 'completed') {
      pick = fpl.nextGwIsClose && next
        ? { matchup: next, state: 'upcoming', myTeamId: t.id, leagueId: t.league.id }
        : { matchup: cur, state: 'final', myTeamId: t.id, leagueId: t.league.id };
    } else if (cur && (cur.status === 'live' || fpl.isLive || fpl.isFinished)) {
      pick = { matchup: cur, state: fpl.isFinished || allFixturesDone ? 'provisional' : 'live', myTeamId: t.id, leagueId: t.league.id };
    } else if (next ?? cur) {
      pick = { matchup: next ?? cur, state: 'upcoming', myTeamId: t.id, leagueId: t.league.id };
    }
    if (pick) chosen.push(pick);
  }

  // Players still to play needs each side's effective lineup, the club each
  // starter plays for, and that gameweek's fixture list.
  const inPlay = chosen.filter((c) => c.state === 'live' || c.state === 'provisional');
  const lineupFor = (c: Chosen, teamId: string) =>
    resolveEffectiveLineupFromMatchups({
      teamId,
      gameweek: c.matchup.gameweek,
      allMatchups: allMatchups.filter((m) => m.league_id === c.leagueId),
    });
  const starterIds = new Set<string>();
  const lineups = new Map<string, any>();
  for (const c of inPlay) {
    for (const teamId of [c.matchup.team_a_id, c.matchup.team_b_id]) {
      const lu = lineupFor(c, teamId);
      lineups.set(`${c.matchup.id}:${teamId}`, lu);
      for (const s of lu?.starters ?? []) if (s.player_id) starterIds.add(s.player_id);
    }
  }

  const oppIds = chosen.map((c) => (c.matchup.team_a_id === c.myTeamId ? c.matchup.team_b_id : c.matchup.team_a_id));

  const [oppRes, starterRes, plFixturesRes] = await Promise.all([
    oppIds.length
      ? admin.from('teams').select('id, team_name, crest_config, user:users(username)').in('id', oppIds)
      : Promise.resolve({ data: [] as any[] }),
    starterIds.size
      ? admin.from('players').select('id, pl_team').in('id', [...starterIds])
      : Promise.resolve({ data: [] as any[] }),
    inPlay.length
      ? admin
          .from('pl_fixtures')
          .select('home_club, away_club, kickoff_time, finished')
          .eq('season', season)
          .eq('gameweek', fpl.currentGw)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const opps = new Map(((oppRes.data ?? []) as any[]).map((o) => [o.id, o]));
  const clubOfPlayer = new Map(((starterRes.data ?? []) as any[]).map((p) => [p.id, p.pl_team]));
  const plFixtures = (plFixturesRes.data ?? []) as any[];

  const countLeft = (lineup: any): number => {
    let n = 0;
    for (const s of lineup?.starters ?? []) {
      const slug = resolveClub(clubOfPlayer.get(s.player_id))?.slug;
      if (!slug) continue;
      const games = plFixtures.filter((f) => f.home_club === slug || f.away_club === slug);
      const unfinished = games.some((f) => {
        if (f.finished) return false;
        if (!f.kickoff_time) return true;
        return serverNow < new Date(f.kickoff_time).getTime() + 125 * 60 * 1000;
      });
      if (unfinished) n++;
    }
    return n;
  };

  const matchCards = new Map<string, MatchCardModel>();
  for (const c of chosen) {
    const m = c.matchup;
    const iAmA = m.team_a_id === c.myTeamId;
    const oppId = iAmA ? m.team_b_id : m.team_a_id;
    const myTeam = myTeams.find((t) => t.id === c.myTeamId);
    const opp = opps.get(oppId);
    const hasScores = c.state !== 'upcoming';
    const mineScore = hasScores ? Number(iAmA ? m.score_a : m.score_b) || 0 : null;
    const theirScore = hasScores ? Number(iAmA ? m.score_b : m.score_a) || 0 : null;

    let verdict: string | null = null;
    let tone: MatchCardModel['tone'] = null;
    let sharePct: number | null = null;
    if (mineScore !== null && theirScore !== null) {
      const total = mineScore + theirScore;
      sharePct = total > 0 ? (mineScore / total) * 100 : 50;
      const margin = mineScore - theirScore;
      const settled = c.state === 'final';
      if (isDrawMargin(mineScore, theirScore)) {
        tone = 'level';
        verdict = settled ? `Drawn, ${fmt1(Math.abs(margin))} apart` : 'Inside the draw band';
      } else if (margin > 0) {
        tone = 'ahead';
        verdict = `${settled ? 'Won' : 'Ahead'} by ${fmt1(margin)}`;
      } else {
        tone = 'behind';
        verdict = `${settled ? 'Lost' : 'Behind'} by ${fmt1(-margin)}`;
      }
    }

    matchCards.set(c.leagueId, {
      state: c.state,
      gameweek: m.gameweek,
      matchupId: m.id,
      mine: {
        teamId: c.myTeamId,
        name: myTeam?.team_name ?? 'Your club',
        crest: myTeam?.crest_config ?? null,
        manager: null,
        rank: standingOf(c.myTeamId)?.rank ?? null,
        record: recordOf(c.myTeamId),
      },
      theirs: {
        teamId: oppId,
        name: opp?.team_name ?? 'Opponent',
        crest: opp?.crest_config ?? null,
        manager: one(opp?.user)?.username ?? null,
        rank: standingOf(oppId)?.rank ?? null,
        record: recordOf(oppId),
      },
      mineScore,
      theirScore,
      sharePct,
      verdict,
      tone,
      playersLeft:
        c.state === 'live'
          ? {
              mine: countLeft(lineups.get(`${m.id}:${c.myTeamId}`)),
              theirs: countLeft(lineups.get(`${m.id}:${oppId}`)),
            }
          : null,
      deadline: c.state === 'upcoming' ? fpl.nextDeadline : null,
    });
  }

  const cards: LeagueCardModel[] = myTeams.map((t) => {
    const league = t.league;
    const base = {
      leagueId: league.id,
      leagueName: league.name,
      leagueInitials: getInitials(league.name),
      leagueColor: getCrestColor(league.id),
      myTeamId: t.id,
      myTeamName: t.team_name as string,
      myCrest: t.crest_config ?? null,
      match: null,
      drafting: null,
      setup: null,
      offseason: null,
    };
    if (league.status === 'active' && matchCards.has(league.id)) {
      return { ...base, kind: 'match' as const, match: matchCards.get(league.id)! };
    }
    if (league.status === 'drafting') {
      const numTeams = draftTeamCount.get(league.id) ?? memberCount.get(league.id) ?? 0;
      const pick = (pickCount.get(league.id) ?? 0) + 1;
      return {
        ...base,
        kind: 'drafting' as const,
        drafting: {
          round: numTeams > 0 ? Math.ceil(pick / numTeams) : 1,
          totalRounds: league.roster_size ?? 0,
          pick,
          isMyTurn: numTeams > 0 && t.draft_order === snakeDraftOrder(pick, numTeams),
        },
      };
    }
    if (league.status === 'setup') {
      return {
        ...base,
        kind: 'setup' as const,
        setup: {
          joined: memberCount.get(league.id) ?? 0,
          max: league.max_teams ?? 0,
          isCommissioner: league.commissioner_id === userId,
        },
      };
    }
    return { ...base, kind: 'offseason' as const, offseason: { rank: standingOf(t.id)?.rank ?? null } };
  });

  const rankKind = { match: 0, drafting: 1, setup: 2, offseason: 3 } as const;
  cards.sort((a, b) => rankKind[a.kind] - rankKind[b.kind]);

  const counts = {
    live: cards.filter((c) => c.match?.state === 'live').length,
    drafting: cards.filter((c) => c.kind === 'drafting').length,
    setup: cards.filter((c) => c.kind === 'setup').length,
    offseason: cards.filter((c) => c.kind === 'offseason').length,
  };

  // ── Role ratings (first run only) ─────────────────────────
  // The product argument made with real players: the best goalkeeper of the
  // last settled gameweek, beside the best striker he finished above.
  let roleRatings: RoleRatingPair | null = null;
  const settledGw = fpl.isFinished && !fpl.isLive ? fpl.currentGw : fpl.currentGw - 1;
  if (cards.length === 0 && settledGw >= 1) {
    roleRatings = await findRolePair(admin, season, settledGw);
  }

  return {
    gameweek: fpl.displayGw,
    isLive: fpl.isLive,
    nextDeadline: fpl.nextDeadline,
    cards,
    counts,
    topRated: {
      matchweek: matchweekPlayers.length ? { gameweek: pickGw, players: matchweekPlayers } : null,
      season: seasonPlayers,
    },
    roleRatings,
    fixtures: fixturesModel,
  };
}

async function findRolePair(admin: AdminClient, season: string, gameweek: number): Promise<RoleRatingPair | null> {
  const bestAt = (position: string, maxRating?: number) => {
    let q = admin
      .from('player_stats')
      .select(`match_rating, player:players!player_id!inner(${PLAYER_FIELDS})`)
      .eq('season', season)
      .eq('gameweek', gameweek)
      .gt('match_rating', 0)
      .eq('player.primary_position', position);
    if (maxRating !== undefined) q = q.lt('match_rating', maxRating);
    return q.order('match_rating', { ascending: false }).limit(1).maybeSingle();
  };
  const rankOf = async (rating: number) => {
    const { count } = await admin
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .eq('season', season)
      .eq('gameweek', gameweek)
      .gt('match_rating', rating);
    return (count ?? 0) + 1;
  };

  const { data: gk } = await bestAt('GK');
  if (!gk) return null;
  const { data: st } = await bestAt('ST', Number(gk.match_rating));
  if (!st) return null;

  const [{ count: total }, gkRank, stRank] = await Promise.all([
    admin
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .eq('season', season)
      .eq('gameweek', gameweek)
      .gt('match_rating', 0),
    rankOf(Number(gk.match_rating)),
    rankOf(Number(st.match_rating)),
  ]);

  return {
    gameweek,
    total: total ?? 0,
    keeper: { ...toRated(one((gk as any).player), gk.match_rating), rank: gkRank },
    striker: { ...toRated(one((st as any).player), st.match_rating), rank: stRank },
  };
}
