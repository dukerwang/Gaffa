/**
 * The walkthroughs. WELCOME runs once, the first time a manager opens their
 * league after the draft, and explains what Gaffa is. After that, each page has
 * a chapter: short steps that spotlight part of the real page and cover the
 * rules behind it that the page can't show on its own.
 *
 * KEEP THESE IN STEP WITH THE PAGES. Each `at` names a `data-tour` attribute on
 * the page it explains; `__tests__/chapters.test.ts` fails if one disappears or
 * a chapter's route stops existing. When a page changes enough that a chapter
 * needs rewriting, bump the chapter's `version`, and everyone sees it once more.
 *
 * Step titles name the thing ("Fee Split"), the way a heading does. They never
 * narrate it ("Where the Fee Goes").
 *
 * Figures come from the constants that enforce the rule. The ones in FIGURES
 * live in server-only modules, so the test compares them with the source.
 */

import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import { DEFAULT_SCOUT_SHARE, DEFAULT_SOLIDARITY_SHARE } from '@/lib/economy/solidarity';
import { DEFAULT_MERIT_RATES } from '@/lib/economy/meritPayments';
import { BENCH_DEPTH_BONUS_LABEL } from '@/types';
import type { PinnedKey } from './players';

export type LeagueFormat = 'dynasty' | 'redraft';
export type Diagram =
  | 'lengths'
  | 'countdown'
  | 'close'
  | 'overnight'
  | 'lot-standing'
  | 'lot-bid'
  | 'lot-closes'
  | 'release-retain'
  | 'fee-split'
  | 'player-card'
  | 'ratings'
  | 'match-revenue'
  | 'transfer-flow';

export interface WalkthroughStep {
  /** The `data-tour` value to spotlight. Absent: a centred card. */
  at?: string;
  title: string;
  body: string;
  /** Replaces `body` in a redraft league, where several systems are switched off. */
  redraftBody?: string;
  diagram?: Diagram;
  /** If the page has nothing at `at` (no live lots, say): show this picture, or a plain centred card for `true`. */
  fallback?: Diagram | true;
  only?: LeagueFormat;
  desktopOnly?: boolean;
  phoneOnly?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  /** The page, relative to /league/{id}. Empty for League Home. */
  route: string;
  /** Bump to show the chapter again after the page changes. */
  version: number;
  /** The page must have this anchor before the chapter starts on its own. */
  requires?: string;
  only?: LeagueFormat;
  /** The face on the Help tile. Absent: the trophy. */
  player?: PinnedKey;
  steps: WalkthroughStep[];
}

/** Checked against their sources by the test beside this file. */
export const FIGURES = {
  arrivalAuctionMin: 50,
  bidFloorPct: 60,
  compensationPct: 60,
  severancePct: 20,
  severanceMin: 2,
  meritPeriod: 4,
};

export const SOLIDARITY_PCT = Math.round(DEFAULT_SOLIDARITY_SHARE * 100);
export const SCOUT_PCT = Math.round(DEFAULT_SOLIDARITY_SHARE * DEFAULT_SCOUT_SHARE * 100);
export const MERIT = DEFAULT_MERIT_RATES;

const money = (n: number) => `€${n}m`;
const MATCH_REVENUE = `Match Revenue pays ${money(MERIT.win)} for a win, ${money(MERIT.draw)} for a draw and ${money(MERIT.loss)} for a loss, every ${FIGURES.meritPeriod} gameweeks.`;

/** What Gaffa is, before any page. Not tied to a route. */
export const WELCOME: Chapter = {
  id: 'welcome',
  title: 'Welcome',
  route: '',
  version: 1,
  steps: [
    { title: 'Gaffa', body: 'You run one club against your friends, with real Premier League players. Every player in your squad is yours alone.' },
    { diagram: 'ratings', title: 'Ratings', body: 'Each player is rated against others in his position, so a centre-back’s clean sheet can outscore a striker’s goal.' },
    { title: 'Matchups', body: `Each gameweek your XI plays one club, head to head. Finish within ${DRAW_THRESHOLD} points and it’s a draw.` },
    { title: 'Trophies', body: 'Four every season: the league title and three cups, all won with the same lineup.' },
    { title: 'Club Balance', body: 'Your budget for signings. It carries over from season to season.', redraftBody: 'Your budget for signings this season.' },
    { diagram: 'match-revenue', title: 'Match Revenue', body: `Every result adds to your Club Balance, paid out every ${FIGURES.meritPeriod} gameweeks.`, only: 'dynasty' },
    { diagram: 'transfer-flow', title: 'Real Transfers', body: 'When a player joins the Premier League, he joins Gaffa too, and the biggest names go straight to auction.' },
    { diagram: 'fee-split', title: 'Scout’s Fee', body: `Open an auction on a free agent and you earn ${SCOUT_PCT}% of what he sells for, even if someone else signs him.`, only: 'dynasty' },
    { title: 'Walkthroughs', body: 'Each page explains itself the first time you open it. Press the question mark beside a page’s title to go through it again.' },
  ],
};

/** Also what the `?` on Closing Now and the front page's door open. */
export const AUCTION_TIMING_STEPS: WalkthroughStep[] = [
  { diagram: 'lengths', title: 'Minimum Length', body: 'The more a player is worth, the longer his auction stays open.', only: 'dynasty' },
  { diagram: 'countdown', title: 'Bid Countdown', body: 'Each bid restarts a countdown so others can answer. The older the auction, the shorter the countdown.', only: 'dynasty' },
  { diagram: 'close', title: 'Closing Time', body: 'A lot closes when both have run out. Barcola’s last bid came 74 hours in, so he closed 2 hours later.', only: 'dynasty' },
  { diagram: 'overnight', title: 'Quiet Hours', body: 'Nothing closes between 23:00 and midday. A lot due in those hours closes at midday, so nobody loses a player in their sleep.', only: 'dynasty' },
  { title: 'Transfer Day', body: 'Every bid settles together on Transfer Day, 24 hours before the gameweek’s first kickoff.', only: 'redraft' },
];

const PLAYER_CARD = 'Press a player’s name to open his card. It lists every position he can play, and most pages only show his main one.';

export const CHAPTERS: Chapter[] = [
  {
    id: 'home',
    title: 'League Home',
    route: '',
    version: 4,
    requires: 'home-standings',
    player: 'saliba',
    steps: [
      { at: 'nav-main', title: 'Menu', body: 'Squad has your lineup and club. League has the table and every player. Fixtures has gameweeks and cups. Transfers is the market.' },
      { at: 'nav-menu', title: 'Menu', body: 'Everything is in here: your lineup and club, the table, every player, gameweeks, cups and the market.' },
      { at: 'nav-balance', title: 'Club Balance', body: 'Press it to compare every club’s balance.' },
      { at: 'home-alerts', title: 'Alerts', body: 'Anything that needs you, soonest first.' },
      { at: 'home-fixture', title: 'This Week', body: 'Your matchup this gameweek, moving as the real games play.' },
      { at: 'home-market', title: 'In the Market', body: 'What’s for sale in your league right now.' },
      { at: 'home-fronts', title: 'Competitions', body: 'Where you stand in the league and each cup.' },
      { at: 'home-standings', title: 'League Table', body: 'Everyone’s record, updated each gameweek.' },
    ],
  },
  {
    id: 'lineup',
    title: 'Lineups',
    route: '/team',
    version: 4,
    player: 'gabriel',
    steps: [
      { at: 'lineup-formation', title: 'Formation', body: 'Choose a shape. The pitch changes to match it.' },
      { at: 'lineup-pitch', title: 'Swaps', body: 'Press a player, then press where he should go. Every legal move lights up: another slot, the bench or a reserve.' },
      { at: 'lineup-pitch', title: 'Positions', body: 'A player can only fill a position he’s listed for, so a centre-back can’t cover left-back.' },
      { diagram: 'player-card', title: 'Player Card', body: PLAYER_CARD },
      { at: 'lineup-rail', title: 'Reserves, Academy and IR', body: 'Everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Academy or Injured Reserve to move him there.', redraftBody: 'Everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Injured Reserve to move him there.', desktopOnly: true },
      { at: 'lineup-handle', title: 'Reserves, Academy and IR', body: 'Pull this up to see everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Academy or Injured Reserve to move him there.', redraftBody: 'Pull this up to see everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Injured Reserve to move him there.', phoneOnly: true },
      { at: 'lineup-bench', title: 'Bench', body: 'If a starter doesn’t play, Gaffa tries your bench in order: DEF, MID, ATT, FLEX. The sub has to be listed for the position he’s covering.' },
      { at: 'lineup-bench', title: 'Depth Bonus', body: `Subs who played but weren’t needed add ${BENCH_DEPTH_BONUS_LABEL} of their points to your score.` },
      { at: 'lineup-save', title: 'Save Lineup', body: 'Changes count once you save them.' },
      { title: 'Kickoff Locks', body: 'Each player locks when his own club kicks off, so you can keep changing anyone who hasn’t played. You can still switch formation, as long as the new one has a slot for everyone locked.' },
      { title: 'Next Gameweek', body: 'Once this gameweek’s last match has kicked off, you can start on next week’s lineup.' },
    ],
  },
  {
    id: 'club',
    title: 'My Club',
    route: '/team/roster',
    version: 4,
    player: 'odegaard',
    steps: [
      { at: 'club-figures', title: 'Club Summary', body: 'Club Balance, squad value and your season so far.' },
      { at: 'club-facilities', title: 'Club Facilities', body: 'Buy extra Academy, IR and Loans Out slots. Each one is yours for good.', only: 'dynasty' },
      { at: 'club-toolbar', title: 'Squad Views', body: 'See your squad on the pitch, as a depth chart or as a table.' },
      { at: 'club-squad', title: 'Squad', body: 'Press any player to see what you can do with him.' },
      { diagram: 'player-card', title: 'Player Card', body: 'Each player’s card lists every position he can play. Most pages only show his main one, so check here when you’re building your squad.' },
      { at: 'club-inspector', title: 'Player Options', body: 'List him for transfer, place him on IR, send him to the Academy or drop him. What’s offered depends on his age and fitness.', redraftBody: 'Place him on IR or drop him. IR is offered when he’s injured, doubtful or suspended.', fallback: true },
      { title: 'Drops', body: `Dropping a player costs ${FIGURES.severancePct}% of his value, at least €${FIGURES.severanceMin}m, and sends him to auction.`, only: 'dynasty' },
      { title: 'Academy', body: 'Young prospects wait here, outside your squad limit. When one ages out, promote him to make room for new ones.', only: 'dynasty' },
      { title: 'Injured Reserve', body: 'Injured, doubtful or suspended players can sit on IR, outside your squad limit. You can’t bid while a healthy player is on it.' },
      { title: 'Held Players', body: 'A player who arrives when your squad is full is held off it. Until you activate or drop him, your squad can’t grow, and your lineup locks at the next kickoff.' },
      { diagram: 'release-retain', title: 'Retained Rights', body: 'When your player leaves the Premier League, you get a week to choose. Let it pass and he’s released.', only: 'dynasty' },
      { at: 'club-retained', fallback: true, title: 'Retained List', body: 'Rights you’ve kept live here, and they use up a limited number of slots. You can trade them or give them up, but you can’t cash them in.', only: 'dynasty' },
    ],
  },
  {
    id: 'gameweeks',
    title: 'Gameweeks',
    route: '/matchups',
    version: 4,
    player: 'saka',
    steps: [
      { at: 'gw-bar', title: 'Gameweeks', body: 'Move between weeks here, past and future.' },
      { at: 'gw-scoreboard', title: 'Matchup', body: `Your score is your XI’s points, plus ${BENCH_DEPTH_BONUS_LABEL} of what your unused subs scored. Finish within ${DRAW_THRESHOLD} points and it’s a draw.` },
      { at: 'gw-fixtures', title: 'Fixtures', body: 'Every match in your league. Open one to see each player’s score.' },
      { title: 'Provisional Scores', body: 'Scores stay provisional until the morning after the gameweek’s last real match, once the final match data is in.' },
    ],
  },
  {
    id: 'market',
    title: 'Transfer Market',
    route: '/transfers',
    version: 4,
    player: 'barcola',
    steps: [
      { at: 'market-nav', title: 'Overview', body: 'This page sums up the market. Each way to sign a player has its own page here.' },
      { title: 'Real Transfers', body: `When a player joins the Premier League, he appears in Gaffa. Worth €${FIGURES.arrivalAuctionMin}m or more, he goes to auction in every league.` },
      { at: 'market-closing', title: 'Closing Now', body: 'Auctions about to end. The question mark beside the heading covers auction timing.', redraftBody: 'Free agents with bids on them, ahead of Transfer Day.' },
      { at: 'market-new', title: 'New Transfers', body: 'Players who arrived in the last week and aren’t on the market yet.' },
      { at: 'market-deadlines', title: 'Deadlines', body: 'What closes in the next seven days.' },
      { at: 'market-wire', title: 'The Wire', body: 'Every bid, signing and deal in your league, as it happens.' },
      { title: 'Departures', body: 'When your player leaves the Premier League, you choose between the cash and his rights. My Club has the details.', only: 'dynasty' },
    ],
  },
  {
    id: 'auctions',
    title: 'Auctions',
    route: '/transfers/auctions',
    version: 4,
    player: 'eze',
    steps: [
      { at: 'auction-board', title: 'The Board', body: 'Every player up for sale, free agents and listed players alike, sits here. Everyone can see every bid.', redraftBody: 'Every free agent with a bid on him sits here. Everyone can see every bid.' },
      { at: 'auction-standing', fallback: 'lot-standing', title: 'Standing Bid', body: 'The highest bid so far, and who made it.' },
      { at: 'auction-bid', fallback: 'lot-bid', title: 'Bid', body: 'Press Bid, choose an amount and confirm. You have to beat the standing bid, and you can only spend what’s in your Club Balance.' },
      { title: 'Full Squad', body: 'Name a player to drop as part of your bid. If you win, you pay his severance as well as the fee.', redraftBody: 'Name a player to drop as part of your bid.' },
      { at: 'auction-balance', title: 'Club Balance', body: 'Your transfer budget. What you don’t spend this season carries into the next.', redraftBody: 'Your transfer budget for the season.' },
      { at: 'auction-closes', fallback: 'lot-closes', title: 'Closes', body: 'When the clock runs out, he’s signed. How long that takes comes next.' },
      ...AUCTION_TIMING_STEPS,
      { title: 'Settlement', body: 'The highest bidder with room signs him. If that club has filled up since bidding, the next bidder with room wins at their own bid.' },
      { diagram: 'fee-split', title: 'Fee Split', body: `${SOLIDARITY_PCT}% of every winning bid comes back to the league. The rest leaves the game.`, only: 'dynasty' },
      { title: 'Bidding Freeze', body: 'You can’t bid while a healthy player is on IR, or while you’re holding a player.' },
    ],
  },
  {
    id: 'free-agents',
    title: 'Free Agency',
    route: '/transfers/free-agents',
    version: 4,
    requires: 'fa-row',
    player: 'rogers',
    steps: [
      { at: 'fa-tools', title: 'Search', body: 'Search and sort every player nobody owns.' },
      { at: 'fa-row', title: 'Opening Bid', body: `Bid at least ${FIGURES.bidFloorPct}% of his value to open his auction.`, redraftBody: 'Bid on any free agent. Every bid settles together on Transfer Day.' },
      { at: 'fa-row', title: 'Scout’s Fee', body: `Open an auction and you earn ${SCOUT_PCT}% of the winning bid, even if someone else signs him.`, only: 'dynasty' },
      { diagram: 'player-card', title: 'Player Card', body: PLAYER_CARD },
      { title: 'New Arrivals', body: 'A new arrival can’t be bid on until he has a market value, usually within a day.', only: 'dynasty' },
    ],
  },
  {
    id: 'deals',
    title: 'Deals',
    route: '/transfers/deals',
    version: 4,
    player: 'joaoPedro',
    steps: [
      { at: 'deals-offer', title: 'Offers', body: 'Any mix of your players and Club Balance for any of theirs, listed or not.', redraftBody: 'Propose a trade with any club in the league.' },
      { at: 'deals-loan', title: 'Loans', body: 'Request borrows one of theirs. Propose lends one of yours. A loan runs 4 to 16 gameweeks, for a fee and an optional performance bonus.', only: 'dynasty' },
      { at: 'deals-slots', title: 'Loan Slots', body: 'Loans are capped. Club Facilities can raise the number you lend, but never the number you borrow.', only: 'dynasty' },
      { at: 'deals-incoming', title: 'Incoming', body: 'Offers waiting on you. Accept, reject or counter. A counter cancels the original.' },
      { title: 'Deferred Deals', body: 'If a player in the deal has already kicked off, it goes through when the week finishes.' },
    ],
  },
  {
    id: 'players',
    title: 'Players',
    route: '/players',
    version: 4,
    player: 'palmer',
    steps: [
      { at: 'players-tools', title: 'Search', body: 'Search and filter every player in the game.' },
      { at: 'players-views', title: 'Views', body: 'Browse cards, read the full table, or compare players in the Explorer.' },
      { diagram: 'player-card', title: 'Player Card', body: 'Press any player to open his card: his ratings, his form, who owns him and every position he can play. Most pages only show his main one.' },
    ],
  },
  {
    id: 'cups',
    title: 'Cups',
    route: '/tournaments',
    version: 4,
    steps: [
      { at: 'cups-shelf', title: 'Trophies', body: 'Four to win every season: the league title and three cups. Select a cup to see its draw.' },
      { at: 'cups-next', title: 'Next Tie', body: 'Who you play next, and when.' },
      { at: 'cups-rounds', title: 'Draw', body: 'Every round of this cup.' },
      { title: 'One Lineup', body: 'You don’t pick a cup team. Your gameweek score counts for your league matchup and any cup tie that week.' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    route: '/finance',
    version: 4,
    player: 'haaland',
    steps: [
      { at: 'fin-hero', title: 'Spendable', body: 'Your Club Balance, less what your live bids would cost if they all won.' },
      { at: 'fin-view', title: 'League View', body: 'Switch to see every club’s money.' },
      { at: 'fin-due', title: 'Money Due', body: MATCH_REVENUE, only: 'dynasty' },
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

/** The part of a league URL after /league/{id}, or null outside a league. */
export function leagueRoute(pathname: string): { leagueId: string; route: string } | null {
  const m = /^\/league\/([^/]+)(\/.*)?$/.exec(pathname);
  return m ? { leagueId: m[1], route: (m[2] ?? '').replace(/\/$/, '') } : null;
}

/** The chapter for a page, if it has one. Routes match exactly. */
export function chapterForPath(pathname: string, leagueId: string, format: LeagueFormat): Chapter | null {
  const at = leagueRoute(pathname);
  if (!at || at.leagueId !== leagueId) return null;
  return CHAPTERS.find((c) => c.route === at.route && (!c.only || c.only === format)) ?? null;
}

/** Walkthroughs start once there is a squad to explain, so never before the draft. */
export function isPostDraft(status: string | null | undefined): boolean {
  return status === 'active' || status === 'offseason';
}
