/* eslint-disable @typescript-eslint/no-explicit-any -- untyped PostgREST rows, as in buildDashboardModel */
/**
 * loadShowcase — the real data behind the public home (`/`) and the no-league
 * dashboard: rated players, a match-rating comparison, and the transfer wire.
 *
 * The page sells Gaffa to people who have not joined yet, so each section
 * shows one fixed example with players a fan recognises, chosen by hand in
 * EXAMPLES below. Duke asked for elite examples (2026-10-02), then for fixed
 * ones (2026-10-08): marketing sticks to one example per feature, and a
 * week-by-week pick put whoever happened to fit on the front page. The
 * figures are still the real ratings, auction and departure on record.
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
  /** The defender who didn't score, and the scorer he outrated. */
  hero: ShowcaseRated;
  scorer: ShowcaseRated;
  /** "a clean sheet and 13 clearances, blocks, and interceptions" */
  heroWhy: string;
}

export interface ShowcaseArrival {
  player: ShowcasePlayer;
  value: number;
  winningBid: number;
  bids: number;
  /** The first bid, where the open bidding started. */
  openingBid: number | null;
  /** Every bid's amount, oldest first. */
  bidAmounts: number[];
  /** How many clubs bid. Counted, never named. */
  clubs: number;
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
  'id, web_name, name, full_name, sofifa_common_name, primary_position, pl_team, photo_url, photo_version, portrait_head_top_pct, portrait_head_width_pct';

/**
 * The examples, by player id. Swap one only for a better-known player or a
 * clearer case, and keep each section to a single example.
 */
const EXAMPLES = {
  season: '2026-27',
  /** Matchweek 3: Ødegaard topped the week, Guéhi 10th, Donnarumma 16th. */
  topRated: {
    gameweek: 3,
    players: [
      'c6b67f57-cd94-47d3-968b-1b4c51a07c29', // Ødegaard
      'a20881c6-f003-4871-b984-a0a74a123941', // Guéhi
      'a5a1513a-a62f-4cbc-9c6c-71501c19e6b4', // Donnarumma
    ],
  },
  /** Matchweek 4: Gabriel kept a clean sheet and outrated Haaland, who scored. */
  comparison: {
    gameweek: 4,
    hero: '2fbb2d39-6d2b-4e34-9105-8a938c95ab7d', // Gabriel
    scorer: 'fe617316-7d87-458f-bb22-092d4e181d51', // Haaland
  },
  /** Barcola's arrival auction: valued at €90m, sold for €164m. */
  arrival: '29fcd8ae-49e3-4e30-a256-d747e6e0a567',
  /** Rodri leaving Manchester City. */
  departure: 'bcb75f30-90b4-4805-bb34-e4f24740c95d',
} as const;

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

interface Rated {
  rating: number;
  points: number;
  stats: any;
  player: any;
}

function toRated(r: Rated, rank: number): ShowcaseRated {
  return {
    ...toPlayer(r.player),
    rating: r.rating,
    points: r.points,
    rank,
    line: statLine(r.stats, r.player?.primary_position ?? null),
  };
}

async function loadRatings(admin: AdminClient, gameweek: number, ids: readonly string[]): Promise<Map<string, Rated>> {
  const { data } = await admin
    .from('player_stats')
    .select(`player_id, match_rating, fantasy_points, stats, player:players!player_id!inner(${PLAYER_FIELDS})`)
    .eq('season', EXAMPLES.season)
    .eq('gameweek', gameweek)
    .in('player_id', [...ids]);
  const out = new Map<string, Rated>();
  for (const raw of (data ?? []) as any[]) {
    out.set(raw.player_id, {
      rating: Number(raw.match_rating),
      points: Number(raw.fantasy_points ?? 0),
      stats: raw.stats ?? {},
      player: one(raw.player),
    });
  }
  return out;
}

/** Players rated above `rating` that week, plus one, so ties share a rank. */
async function rankIn(admin: AdminClient, gameweek: number, rating: number): Promise<number> {
  const { count } = await admin
    .from('player_stats')
    .select('id', { count: 'exact', head: true })
    .eq('season', EXAMPLES.season)
    .eq('gameweek', gameweek)
    .gt('match_rating', rating);
  return (count ?? 0) + 1;
}

async function loadTopRated(admin: AdminClient): Promise<Showcase['topRated']> {
  const { gameweek, players } = EXAMPLES.topRated;
  const [ratings, total] = await Promise.all([
    loadRatings(admin, gameweek, players),
    admin
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .eq('season', EXAMPLES.season)
      .eq('gameweek', gameweek)
      .gt('match_rating', 0),
  ]);
  const rows = players.map((id) => ratings.get(id)).filter((r): r is Rated => !!r);
  if (rows.length !== players.length) return null;
  const ranks = await Promise.all(rows.map((r) => rankIn(admin, gameweek, r.rating)));
  return {
    gameweek,
    total: total.count ?? 0,
    players: rows.map((r, i) => toRated(r, ranks[i])).sort((a, b) => b.rating - a.rating),
  };
}

async function loadComparison(admin: AdminClient): Promise<ShowcaseComparison | null> {
  const { gameweek, hero, scorer } = EXAMPLES.comparison;
  const ratings = await loadRatings(admin, gameweek, [hero, scorer]);
  const h = ratings.get(hero);
  const s = ratings.get(scorer);
  if (!h || !s) return null;
  const [hRank, sRank] = await Promise.all([rankIn(admin, gameweek, h.rating), rankIn(admin, gameweek, s.rating)]);
  return { gameweek, hero: toRated(h, hRank), scorer: toRated(s, sRank), heroWhy: heroWhy(h.stats) };
}

/** The example's arrival auction, at its best result in any league. */
async function loadArrival(admin: AdminClient): Promise<ShowcaseArrival | null> {
  const { data } = await admin
    .from('auction_state')
    .select(`highest_bid, bid_count, bids, market_value_at_auction, player:players!player_id(${PLAYER_FIELDS})`)
    .eq('player_id', EXAMPLES.arrival)
    .eq('kind', 'free_agent')
    .eq('status', 'resolved')
    .order('highest_bid', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as any;
  // `bids` is the auction's own history, oldest first. Only the amounts and a
  // count of distinct clubs leave this function.
  const history: any[] = Array.isArray(row.bids) ? row.bids : [];
  return {
    player: toPlayer(one(row.player)),
    value: Number(row.market_value_at_auction),
    winningBid: Number(row.highest_bid),
    bids: Number(row.bid_count ?? 0),
    openingBid: history.length ? Number(history[0].amount) : null,
    bidAmounts: history.map((b) => Number(b.amount)),
    clubs: new Set(history.map((b) => b.team_id)).size,
  };
}

async function loadDeparture(admin: AdminClient): Promise<ShowcaseDeparture | null> {
  const { data } = await admin
    .from('departure_decisions')
    .select(`market_value_at_departure, compensation_offered, player:players!player_id(${PLAYER_FIELDS})`)
    .eq('player_id', EXAMPLES.departure)
    .is('loan_club', null)
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

async function fetchShowcase(): Promise<Showcase> {
  const admin: AdminClient = createAdminClient();
  const [topRated, comparison, arrival, departure] = await Promise.all([
    loadTopRated(admin),
    loadComparison(admin),
    loadArrival(admin),
    loadDeparture(admin),
  ]);
  return { topRated, comparison, arrival, departure };
}

// The examples are settled records, so a day between refreshes is plenty.
const getCachedShowcase = unstable_cache(fetchShowcase, ['public-showcase-examples-v2'], { revalidate: 86_400 });

export async function loadShowcase(): Promise<Showcase> {
  if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) return fetchShowcase();
  return getCachedShowcase();
}
