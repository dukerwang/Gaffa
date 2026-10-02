/* eslint-disable @typescript-eslint/no-explicit-any -- untyped PostgREST rows, as in buildDashboardModel */
/**
 * loadShowcase — the real data behind the public home (`/`) and the no-league
 * dashboard: rated players, a match-rating comparison, and the transfer wire.
 *
 * The page sells Gaffa to people who have not joined yet, so every section is
 * picked to show names a fan recognises. "Recognisable" is read off
 * `players.market_value`: the season's actual leaders are often mid-table
 * players (Tarkowski led every centre-back after five matchweeks), and Duke
 * asked for elite examples instead (2026-10-02). Each pick still comes from a
 * real, recent rating; only which week and which players are chosen is
 * curated.
 *
 * Nothing here names a league, a club or a manager inside Gaffa. The transfer
 * wire reports an auction's result, never who won it.
 */

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveClub } from '@/lib/clubs/registry';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import type { GranularPosition } from '@/types';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ShowcasePlayer {
  playerId: string;
  name: string;
  position: GranularPosition | null;
  club: string | null;
  clubBadge: string | null;
  photoUrl: string | null;
  photoVersion: string | null;
  headTopPct: number | null;
  headWidthPct: number | null;
}

export interface ShowcaseRated extends ShowcasePlayer {
  rating: number;
  points: number;
  rank: number;
  /** What earned the rating, in a few words: "2 goals", "5 saves", "Clean sheet". */
  line: string;
}

export interface ShowcaseComparison {
  gameweek: number;
  /** The defender who didn't score, then the scorers he outrated, best first. */
  hero: ShowcaseRated;
  scorers: ShowcaseRated[];
  /** "a clean sheet and 13 clearances, blocks, and interceptions" */
  heroWhy: string;
}

export interface ShowcaseArrival {
  player: ShowcasePlayer;
  value: number;
  winningBid: number;
  bids: number;
}

export interface ShowcaseDeparture {
  player: ShowcasePlayer;
  value: number;
  compensation: number;
}

export interface Showcase {
  topRated: { gameweek: number; total: number; players: ShowcaseRated[] } | null;
  comparison: ShowcaseComparison | null;
  arrival: ShowcaseArrival | null;
  departure: ShowcaseDeparture | null;
}

const PLAYER_FIELDS =
  'id, web_name, name, full_name, sofifa_common_name, primary_position, pl_team, photo_url, photo_version, market_value, portrait_head_top_pct, portrait_head_width_pct, created_at';

const DEFENDERS = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB']);
/** How many recent settled matchweeks the picks may come from. */
const WEEKS = 3;
/** Well-known enough to lead a marketing page. */
const KNOWN_MV = 40;
/** A scorer the hero defender outrated has to be a headline name. */
const STAR_MV = 50;
/** Top Rated picks must have finished this high in their week. */
const TOP_RANK = 40;
/** An auction this soon after a player's first sync is an arrival auction. */
const ARRIVAL_DAYS = 21;

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function toPlayer(p: any): ShowcasePlayer {
  const club = p?.pl_team ? resolveClub(p.pl_team) : null;
  return {
    playerId: p?.id ?? '',
    // Surnames, the way a commentator says them: "Haaland", "Ødegaard".
    name: getPlayerDisplayName(p, 'split').last,
    position: (p?.primary_position as GranularPosition) ?? null,
    club: club?.name ?? p?.pl_team ?? null,
    clubBadge: club ? `/team-logos/${club.slug}.png` : null,
    photoUrl: p?.photo_url ?? null,
    photoVersion: p?.photo_version ?? null,
    headTopPct: p?.portrait_head_top_pct != null ? Number(p.portrait_head_top_pct) : null,
    headWidthPct: p?.portrait_head_width_pct != null ? Number(p.portrait_head_width_pct) : null,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function statLine(stats: any, position: string | null): string {
  const goals = Number(stats?.goals ?? 0);
  const assists = Number(stats?.assists ?? 0);
  const saves = Number(stats?.saves ?? 0);
  if (goals > 0) return plural(goals, 'goal');
  if (position === 'GK' && saves > 0) return plural(saves, 'save');
  if (assists > 0) return plural(assists, 'assist');
  if (stats?.clean_sheet) return 'Clean sheet';
  return 'No goal';
}

function oxford(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function heroWhy(stats: any): string {
  const parts: string[] = [];
  if (stats?.clean_sheet) parts.push('a clean sheet');
  const assists = Number(stats?.assists ?? 0);
  if (assists > 0) parts.push(assists === 1 ? 'an assist' : `${assists} assists`);
  const cbi = Number(stats?.fpl_cbi ?? 0);
  if (cbi > 0) parts.push(`${cbi} clearances, blocks, and interceptions`);
  return oxford(parts);
}

interface Row {
  gameweek: number;
  rating: number;
  points: number;
  stats: any;
  player: any;
  mv: number;
  minutes: number;
  goals: number;
  rank: number;
}

function toRated(r: Row): ShowcaseRated {
  return {
    ...toPlayer(r.player),
    rating: r.rating,
    points: r.points,
    rank: r.rank,
    line: statLine(r.stats, r.player?.primary_position ?? null),
  };
}

async function fetchShowcase(season: string, settledGw: number): Promise<Showcase> {
  const admin: AdminClient = createAdminClient();
  const weeks = Array.from({ length: WEEKS }, (_, i) => settledGw - i).filter((gw) => gw >= 1);

  const [statsRes, totals, arrival, departure] = await Promise.all([
    weeks.length
      ? admin
          .from('player_stats')
          .select(`gameweek, match_rating, fantasy_points, stats, player:players!player_id!inner(${PLAYER_FIELDS})`)
          .eq('season', season)
          .in('gameweek', weeks)
          .gte('match_rating', 6.5)
          .order('match_rating', { ascending: false })
          .order('id', { ascending: true })
          .limit(1000)
      : Promise.resolve({ data: [] as any[] }),
    Promise.all(
      weeks.map(async (gw) => {
        const { count } = await admin
          .from('player_stats')
          .select('id', { count: 'exact', head: true })
          .eq('season', season)
          .eq('gameweek', gw)
          .gt('match_rating', 0);
        return [gw, count ?? 0] as const;
      }),
    ),
    loadArrival(admin),
    loadDeparture(admin),
  ]);

  // Rows arrive best first, so a running count per week is the rank. A tie
  // shares the rank the way the ratings table shows it.
  const rows: Row[] = [];
  const seen = new Map<number, { n: number; last: number; rank: number }>();
  for (const raw of (statsRes.data ?? []) as any[]) {
    const player = one(raw.player);
    const rating = Number(raw.match_rating);
    const s = seen.get(raw.gameweek) ?? { n: 0, last: Infinity, rank: 0 };
    s.n += 1;
    if (rating < s.last) s.rank = s.n;
    s.last = rating;
    seen.set(raw.gameweek, s);
    rows.push({
      gameweek: raw.gameweek,
      rating,
      points: Number(raw.fantasy_points ?? 0),
      stats: raw.stats ?? {},
      player,
      mv: Number(player?.market_value ?? 0),
      minutes: Number(raw.stats?.minutes_played ?? 0),
      goals: Number(raw.stats?.goals ?? 0),
      rank: s.rank,
    });
  }
  const totalOf = new Map(totals);

  return {
    topRated: pickTopRated(rows, weeks, totalOf),
    comparison: pickComparison(rows, weeks),
    arrival,
    departure,
  };
}

/** The week whose best keeper, defender and outfielder are the best-known trio. */
function pickTopRated(rows: Row[], weeks: number[], totalOf: Map<number, number>): Showcase['topRated'] {
  let best: { gw: number; trio: Row[]; worth: number } | null = null;
  for (const gw of weeks) {
    const pool = rows.filter((r) => r.gameweek === gw && r.rank <= TOP_RANK && r.mv >= KNOWN_MV);
    const pos = (r: Row) => r.player?.primary_position as string;
    const gk = pool.find((r) => pos(r) === 'GK');
    const def = pool.find((r) => DEFENDERS.has(pos(r)));
    const out = pool.find((r) => pos(r) !== 'GK' && !DEFENDERS.has(pos(r)));
    if (!gk || !def || !out) continue;
    const worth = gk.mv + def.mv + out.mv;
    if (!best || worth > best.worth) best = { gw, trio: [gk, def, out], worth };
  }
  if (!best) return null;
  return {
    gameweek: best.gw,
    total: totalOf.get(best.gw) ?? 0,
    players: best.trio.sort((a, b) => b.rating - a.rating).map(toRated),
  };
}

/**
 * A well-known defender who didn't score and still outrated a headline
 * scorer the same week, plus the week's lowest-rated scorer for contrast.
 */
function pickComparison(rows: Row[], weeks: number[]): ShowcaseComparison | null {
  let best: { hero: Row; star: Row; worth: number } | null = null;
  for (const gw of weeks) {
    const week = rows.filter((r) => r.gameweek === gw && r.minutes >= 60);
    const heroes = week.filter((r) => DEFENDERS.has(r.player?.primary_position) && r.goals === 0 && r.mv >= KNOWN_MV);
    for (const hero of heroes) {
      const star = week.find((r) => r.goals > 0 && r.mv >= STAR_MV && r.rating < hero.rating);
      if (!star) continue;
      const worth = hero.mv + star.mv;
      if (!best || worth > best.worth || (worth === best.worth && hero.rating > best.hero.rating)) {
        best = { hero, star, worth };
      }
    }
  }
  if (!best) return null;
  const { hero, star } = best;
  const scorers = rows.filter((r) => r.gameweek === hero.gameweek && r.goals > 0 && r.minutes >= 60 && r.rating < star.rating);
  const low = scorers[scorers.length - 1];
  return {
    gameweek: hero.gameweek,
    hero: toRated(hero),
    scorers: [star, ...(low ? [low] : [])].map(toRated),
    heroWhy: heroWhy(hero.stats),
  };
}

/**
 * The most contested recent arrival: a new Premier League signing, auctioned
 * in Gaffa, with its best result in any league. A player counts as an arrival
 * when his auction closed within ARRIVAL_DAYS of his first sync, which keeps
 * out established players re-auctioned after a drop.
 */
async function loadArrival(admin: AdminClient): Promise<ShowcaseArrival | null> {
  const { data } = await admin
    .from('auction_state')
    .select(`player_id, highest_bid, bid_count, market_value_at_auction, expires_at, player:players!player_id(${PLAYER_FIELDS})`)
    .eq('kind', 'free_agent')
    .eq('status', 'resolved')
    .gt('highest_bid', 0)
    .gte('market_value_at_auction', STAR_MV)
    .order('expires_at', { ascending: false })
    .limit(80);
  const arrivals = ((data ?? []) as any[]).filter((r) => {
    const joined = Date.parse(one<any>(r.player)?.created_at ?? '');
    const closed = Date.parse(r.expires_at ?? '');
    return Number.isFinite(joined) && Number.isFinite(closed) && closed - joined <= ARRIVAL_DAYS * 86_400_000;
  });
  if (!arrivals.length) return null;
  const top = arrivals.sort((a, b) => Number(b.highest_bid) - Number(a.highest_bid))[0];
  return {
    player: toPlayer(one(top.player)),
    value: Number(top.market_value_at_auction),
    winningBid: Number(top.highest_bid),
    bids: Number(top.bid_count ?? 0),
  };
}

/** The latest player to leave the Premier League from a Gaffa squad. */
async function loadDeparture(admin: AdminClient): Promise<ShowcaseDeparture | null> {
  const { data } = await admin
    .from('departure_decisions')
    .select(`market_value_at_departure, compensation_offered, detected_at, player:players!player_id(${PLAYER_FIELDS})`)
    .is('loan_club', null)
    .gt('market_value_at_departure', 0)
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as any;
  return {
    player: toPlayer(one(row.player)),
    value: Number(row.market_value_at_departure),
    compensation: Number(row.compensation_offered ?? 0),
  };
}

const getCachedShowcase = unstable_cache(fetchShowcase, ['public-showcase'], { revalidate: 900 });

export async function loadShowcase(season: string, settledGw: number): Promise<Showcase> {
  if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) return fetchShowcase(season, settledGw);
  return getCachedShowcase(season, settledGw);
}
