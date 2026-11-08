/**
 * The walkthroughs: one chapter per page, each a short list of steps that
 * spotlight a part of the real page and explain it in a sentence.
 *
 * KEEP THESE IN STEP WITH THE PAGES. Each `at` names a `data-tour` attribute on
 * the page it explains; `__tests__/chapters.test.ts` fails if one disappears or
 * a chapter's route stops existing. When a page changes enough that a chapter
 * needs rewriting, bump the chapter's `version`, and everyone sees it once more.
 *
 * Figures come from the constants that enforce the rule wherever one exists, so
 * a rule change can't leave a stale number here.
 */

import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import { DEFAULT_SCOUT_SHARE, DEFAULT_SOLIDARITY_SHARE } from '@/lib/economy/solidarity';
import { BENCH_DEPTH_BONUS_LABEL } from '@/types';

export type LeagueFormat = 'dynasty' | 'redraft';
export type TimingDiagram = 'lengths' | 'countdown' | 'close' | 'overnight';

export interface WalkthroughStep {
  /** The `data-tour` value to spotlight. Absent: a centred card with no spotlight. */
  at?: string;
  title: string;
  body: string;
  /** Replaces `body` in a redraft league, where several systems are switched off. */
  redraftBody?: string;
  diagram?: TimingDiagram;
  only?: LeagueFormat;
}

export interface Chapter {
  id: string;
  title: string;
  /** The page, relative to /league/{id}. Empty for League Home. */
  route: string;
  /** Bump to show the chapter again after the page changes. */
  version: number;
  /** The page must have this anchor before the chapter starts on its own (no lots yet, say). */
  requires?: string;
  only?: LeagueFormat;
  /** A pinned player for the Help tile: the FPL photo code. Absent: the trophy. */
  photoCode?: number;
  steps: WalkthroughStep[];
}

const SCOUT_PCT = Math.round(DEFAULT_SOLIDARITY_SHARE * DEFAULT_SCOUT_SHARE * 100);

/** Also what the `?` beside The Auction Room and the front page's door open. */
export const AUCTION_TIMING_STEPS: WalkthroughStep[] = [
  { diagram: 'lengths', title: 'Minimum Length', body: 'The more a player is worth, the longer his auction stays open.', only: 'dynasty' },
  { diagram: 'countdown', title: 'After Each Bid', body: 'Each bid restarts a countdown so others can answer. The older the auction, the shorter the countdown.', only: 'dynasty' },
  { diagram: 'close', title: 'The Close', body: 'A lot closes when both have run out. Barcola’s last bid came 74 hours in, so he closed 2 hours later.', only: 'dynasty' },
  { diagram: 'overnight', title: 'Overnight', body: 'Nothing closes between 23:00 and midday. A lot due in those hours closes at midday, so nobody loses a player in their sleep.', only: 'dynasty' },
  { title: 'Transfer Day', body: 'Every bid settles together on Transfer Day, 24 hours before the gameweek’s first kickoff.', only: 'redraft' },
];

export const CHAPTERS: Chapter[] = [
  {
    id: 'home',
    title: 'League Home',
    route: '',
    version: 1,
    photoCode: 462424,
    steps: [
      { at: 'home-fixture', title: 'This Week', body: 'Your match this gameweek. Your score moves as the real matches play.' },
      { at: 'home-market', title: 'In the Market', body: 'What’s for sale in your league right now.' },
      { at: 'home-fronts', title: 'Competitions', body: 'Where you stand in the league and each cup.' },
      { at: 'home-standings', title: 'League Table', body: `Each week you play one club, head to head. A gap of ${DRAW_THRESHOLD} points or less is a draw.` },
    ],
  },
  {
    id: 'lineup',
    title: 'Lineups',
    route: '/team',
    version: 1,
    photoCode: 226597,
    steps: [
      { at: 'lineup-formation', title: 'Formation', body: 'Choose a shape. It locks as soon as any player in your squad kicks off.' },
      { at: 'lineup-pitch', title: 'Starting XI', body: 'Select a player, then the slot you want him in. He can only play a position he’s listed for, so a centre-back can’t cover left-back.' },
      { at: 'lineup-bench', title: 'Bench', body: `If a starter doesn’t play, the first eligible sub comes on. Subs who played but weren’t needed add ${BENCH_DEPTH_BONUS_LABEL} of their points.` },
      { at: 'lineup-save', title: 'Save Lineup', body: 'Save before kickoff. Each player locks when his own club kicks off.' },
    ],
  },
  {
    id: 'club',
    title: 'My Club',
    route: '/team/roster',
    version: 1,
    photoCode: 184029,
    steps: [
      { at: 'club-figures', title: 'Your Club', body: 'Club Balance, squad value and your season so far.' },
      { at: 'club-facilities', title: 'Club Facilities', body: 'Spend Club Balance on more Academy, IR and Loans Out slots.' },
      { at: 'club-toolbar', title: 'Squad Views', body: 'See your squad on the pitch, as a depth chart or as a table.' },
      { at: 'club-squad', title: 'Your Squad', body: 'Select any player to see what you can do with him.' },
      { at: 'club-inspector', title: 'Player Options', body: 'Move him to the Academy or IR, list him for transfer, or drop him. Dropping costs a severance fee.', redraftBody: 'Move him to IR or drop him.' },
    ],
  },
  {
    id: 'gameweeks',
    title: 'Gameweeks',
    route: '/matchups',
    version: 1,
    photoCode: 223340,
    steps: [
      { at: 'gw-bar', title: 'Gameweeks', body: 'Move between weeks here, past and future.' },
      { at: 'gw-scoreboard', title: 'Your Match', body: `Your score is your XI’s points, plus ${BENCH_DEPTH_BONUS_LABEL} of what your unused subs scored. Within ${DRAW_THRESHOLD} points, it’s a draw.` },
      { at: 'gw-fixtures', title: 'Fixtures', body: 'Every match in your league. Scores stay provisional until the morning after the last real match.' },
    ],
  },
  {
    id: 'market',
    title: 'Transfer Market',
    route: '/transfers',
    version: 1,
    photoCode: 482616,
    steps: [
      { at: 'market-nav', title: 'Transfer Market', body: 'Every way to sign a player has its own page here.' },
      { at: 'market-new', title: 'New Transfers', body: 'Players who just arrived in the Premier League. The biggest go straight to auction in every league.' },
      { at: 'market-wire', title: 'The Wire', body: 'Every bid, signing and deal in your league, as it happens.' },
    ],
  },
  {
    id: 'auctions',
    title: 'Auctions',
    route: '/transfers/auctions',
    version: 1,
    requires: 'auction-standing',
    photoCode: 232413,
    steps: [
      { at: 'auction-board', title: 'The Board', body: 'Every player up for sale, free agents and listed players alike, sits here.', redraftBody: 'Every free agent with a bid on him sits here.' },
      { at: 'auction-standing', title: 'Standing Bid', body: 'The highest bid so far. Everyone can see it and who made it.' },
      { at: 'auction-bid', title: 'Bid', body: 'Press Bid, choose an amount and confirm. You need to beat the standing bid, and you can only spend what’s in your Club Balance.' },
      { at: 'auction-balance', title: 'Club Balance', body: 'Your transfer budget. What you don’t spend this season carries into the next.', redraftBody: 'Your transfer budget for the season.' },
      { at: 'auction-closes', title: 'Closes', body: 'When the clock runs out, the highest bidder signs him. How long that takes comes next.' },
      ...AUCTION_TIMING_STEPS,
    ],
  },
  {
    id: 'free-agents',
    title: 'Free Agency',
    route: '/transfers/free-agents',
    version: 1,
    photoCode: 244850,
    steps: [
      { at: 'fa-tools', title: 'Find a Player', body: 'Search and sort every player nobody owns.' },
      { at: 'fa-row', title: 'Open an Auction', body: `Bid on any free agent to open his auction. You earn the Scout’s Fee, ${SCOUT_PCT}% of the winning bid, even if someone else signs him.`, redraftBody: 'Bid on any free agent. Every bid settles together on Transfer Day.' },
    ],
  },
  {
    id: 'listings',
    title: 'Listings',
    route: '/transfers/listings',
    version: 1,
    only: 'dynasty',
    photoCode: 244851,
    steps: [
      { at: 'list-cta', title: 'List a Player', body: 'Set a minimum bid to open an auction, a release clause to sell him outright, or an asking price to invite offers.' },
      { at: 'list-board', title: 'The Board', body: 'Players other managers are selling. Bid, pay the clause or send an offer.' },
    ],
  },
  {
    id: 'deals',
    title: 'Deals',
    route: '/transfers/deals',
    version: 1,
    photoCode: 475168,
    steps: [
      { at: 'deals-propose', title: 'Make an Offer', body: 'Offer cash, players or both for anyone in the league, listed or not.', redraftBody: 'Propose a trade with any club in the league.' },
    ],
  },
  {
    id: 'players',
    title: 'Players',
    route: '/players',
    version: 1,
    photoCode: 244851,
    steps: [
      { at: 'players-tools', title: 'Find a Player', body: 'Search and filter every player in the game.' },
      { at: 'players-views', title: 'Views', body: 'Browse cards, read the full table, or compare players in the Explorer.' },
    ],
  },
  {
    id: 'cups',
    title: 'Cups',
    route: '/tournaments',
    version: 1,
    steps: [
      { at: 'cups-shelf', title: 'Trophies', body: 'Four to win every season: the league title and three cups. Select a cup to see its draw.' },
      { at: 'cups-next', title: 'Your Next Tie', body: 'Who you play next, and when.' },
      { at: 'cups-rounds', title: 'The Draw', body: 'Cup ties can’t end level. The best individual performer settles it, then the higher seed.' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    route: '/finance',
    version: 1,
    photoCode: 226597,
    steps: [
      { at: 'fin-hero', title: 'Spendable', body: 'Your Club Balance, less what your live bids would cost if they all won.' },
      { at: 'fin-view', title: 'My Club and League', body: 'Switch to see every club’s money.' },
      { at: 'fin-ledger', title: 'Ledger', body: 'Every euro in and out of your club.' },
    ],
  },
];

/** The steps a league of this format should see, with the right copy for it. */
export function stepsForFormat(steps: WalkthroughStep[], format: LeagueFormat): WalkthroughStep[] {
  return steps
    .filter((s) => !s.only || s.only === format)
    .map((s) => (format === 'redraft' && s.redraftBody ? { ...s, body: s.redraftBody } : s));
}

/** The chapter for a page, if it has one. Routes match exactly. */
export function chapterForPath(pathname: string, leagueId: string, format: LeagueFormat): Chapter | null {
  const base = `/league/${leagueId}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const route = pathname.slice(base.length).replace(/\/$/, '');
  return CHAPTERS.find((c) => c.route === route && (!c.only || c.only === format)) ?? null;
}

/** Walkthroughs start once there is a squad to explain, so never before the draft. */
export function isPostDraft(status: string | null | undefined): boolean {
  return status === 'active' || status === 'offseason';
}
