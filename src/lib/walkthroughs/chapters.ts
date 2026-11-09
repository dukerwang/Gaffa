/**
 * The walkthroughs: one chapter per page, each a short list of steps that
 * spotlight a part of the real page and explain it, and cover the rules behind
 * it that the page can't show on its own.
 *
 * KEEP THESE IN STEP WITH THE PAGES. Each `at` names a `data-tour` attribute on
 * the page it explains; `__tests__/chapters.test.ts` fails if one disappears or
 * a chapter's route stops existing. When a page changes enough that a chapter
 * needs rewriting, bump the chapter's `version`, and everyone sees it once more.
 *
 * Figures come from the constants that enforce the rule. The ones in FIGURES
 * live in server-only modules, so the test compares them with the source.
 */

import { DRAW_THRESHOLD } from '@/lib/scoring/drawBand';
import { DEFAULT_SCOUT_SHARE, DEFAULT_SOLIDARITY_SHARE } from '@/lib/economy/solidarity';
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
  | 'player-card';

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
    version: 3,
    requires: 'home-standings',
    player: 'saliba',
    steps: [
      { at: 'nav-main', title: 'Getting Around', body: 'Squad has your lineup and club. League has the table and every player. Fixtures has gameweeks and cups. Transfers is the market.' },
      { at: 'nav-menu', title: 'Getting Around', body: 'Everything is in here: your lineup and club, the table, every player, gameweeks, cups and the market.' },
      { at: 'nav-help', title: 'Page Walkthrough', body: 'Press this on any page to go through its walkthrough again.' },
      { at: 'nav-balance', title: 'Club Balance', body: 'Your money for signings. It carries over every season. Press it to compare every club.', redraftBody: 'Your money for signings this season. Press it to compare every club.' },
      { at: 'home-alerts', title: 'Alerts', body: 'Anything that needs you, soonest first.' },
      { at: 'home-fixture', title: 'This Week', body: `Your match this gameweek, moving as the real games play. Finish within ${DRAW_THRESHOLD} points and it’s a draw.` },
      { at: 'home-market', title: 'In the Market', body: 'What’s for sale in your league right now.' },
      { at: 'home-fronts', title: 'Competitions', body: 'Where you stand in the league and each cup.' },
      { at: 'home-standings', title: 'League Table', body: 'Each week you play one club, head to head.' },
    ],
  },
  {
    id: 'lineup',
    title: 'Lineups',
    route: '/team',
    version: 3,
    player: 'gabriel',
    steps: [
      { at: 'lineup-formation', title: 'Formation', body: 'Choose a shape. The pitch changes to match it.' },
      { at: 'lineup-pitch', title: 'Swap Players', body: 'Press a player, then press where he should go. Every legal move lights up: another slot, the bench or a reserve.' },
      { at: 'lineup-pitch', title: 'Positions', body: 'A player can only fill a position he’s listed for, so a centre-back can’t cover left-back.' },
      { diagram: 'player-card', title: 'Player Card', body: 'Press a player’s name to open his card. It’s where you’ll find every position he can play, and most pages only show his main one.' },
      { at: 'lineup-rail', title: 'Reserves, Academy and IR', body: 'Everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Academy or Injured Reserve to move him there.', redraftBody: 'Everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Injured Reserve to move him there.', desktopOnly: true },
      { at: 'lineup-handle', title: 'Reserves, Academy and IR', body: 'Pull this up to see everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Academy or Injured Reserve to move him there.', redraftBody: 'Pull this up to see everyone outside your matchday squad. Press a reserve to bring him in, or press a starter and then Injured Reserve to move him there.', phoneOnly: true },
      { at: 'lineup-bench', title: 'Bench', body: 'If a starter doesn’t play, Gaffa tries your bench in order: DEF, MID, ATT, FLEX. The sub has to be listed for the position he’s covering.' },
      { at: 'lineup-bench', title: 'Depth Bonus', body: `Subs who played but weren’t needed add ${BENCH_DEPTH_BONUS_LABEL} of their points to your score.` },
      { at: 'lineup-save', title: 'Save Lineup', body: 'Changes count once you save them.' },
      { title: 'Kickoff Locks', body: 'Each player locks when his own club kicks off, so you can keep changing anyone who hasn’t played. You can still switch formation, as long as the new one has a slot for everyone locked.' },
      { title: 'Next Week', body: 'Once this gameweek’s last match has kicked off, you can start on next week’s lineup.' },
    ],
  },
  {
    id: 'club',
    title: 'My Club',
    route: '/team/roster',
    version: 3,
    player: 'odegaard',
    steps: [
      { at: 'club-figures', title: 'Your Club', body: 'Club Balance, squad value and your season so far.' },
      { at: 'club-facilities', title: 'Club Facilities', body: 'Buy extra Academy, IR and Loans Out slots. Each one is yours for good.', only: 'dynasty' },
      { at: 'club-toolbar', title: 'Squad Views', body: 'See your squad on the pitch, as a depth chart or as a table.' },
      { at: 'club-squad', title: 'Your Squad', body: 'Press any player to see what you can do with him.' },
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
    version: 2,
    player: 'saka',
    steps: [
      { at: 'gw-bar', title: 'Gameweeks', body: 'Move between weeks here, past and future.' },
      { at: 'gw-scoreboard', title: 'Your Match', body: `Your score is your XI’s points, plus ${BENCH_DEPTH_BONUS_LABEL} of what your unused subs scored. Finish within ${DRAW_THRESHOLD} points and it’s a draw.` },
      { at: 'gw-fixtures', title: 'Fixtures', body: 'Every match in your league. Open one to see each player’s score.' },
      { title: 'Provisional Scores', body: 'Scores stay provisional until the morning after the gameweek’s last real match, once the final match data is in.' },
    ],
  },
  {
    id: 'market',
    title: 'Transfer Market',
    route: '/transfers',
    version: 2,
    player: 'barcola',
    steps: [
      { at: 'market-nav', title: 'Transfer Market', body: 'This page is the overview. Each way to sign a player has its own page here.' },
      { title: 'Real Transfers', body: `When a player joins the Premier League, he appears in Gaffa. Worth €${FIGURES.arrivalAuctionMin}m or more, he goes to auction in every league.` },
      { at: 'market-closing', title: 'Closing Now', body: 'Auctions about to end. The question mark explains the timing.', redraftBody: 'Free agents with bids on them, ahead of Transfer Day.' },
      { at: 'market-new', title: 'New Transfers', body: 'Players who arrived in the last week and aren’t on the market yet.' },
      { at: 'market-deadlines', title: 'Deadlines', body: 'What closes in the next seven days.' },
      { at: 'market-wire', title: 'The Wire', body: 'Every bid, signing and deal in your league, as it happens.' },
      { title: 'Players Who Leave', body: 'When your player leaves the Premier League, you choose between the cash and his rights. My Club has the details.', only: 'dynasty' },
    ],
  },
  {
    id: 'auctions',
    title: 'Auctions',
    route: '/transfers/auctions',
    version: 2,
    player: 'eze',
    steps: [
      { at: 'auction-board', title: 'The Board', body: 'Every player up for sale, free agents and listed players alike, sits here. Everyone can see every bid.', redraftBody: 'Every free agent with a bid on him sits here. Everyone can see every bid.' },
      { at: 'auction-standing', fallback: 'lot-standing', title: 'Standing Bid', body: 'The highest bid so far, and who made it.' },
      { at: 'auction-bid', fallback: 'lot-bid', title: 'Bid', body: 'Press Bid, choose an amount and confirm. You have to beat the standing bid, and you can only spend what’s in your Club Balance.' },
      { title: 'If Your Squad Is Full', body: 'Name a player to drop as part of your bid. If you win, you pay his severance as well as the fee.', redraftBody: 'Name a player to drop as part of your bid.' },
      { at: 'auction-balance', title: 'Club Balance', body: 'Your transfer budget. What you don’t spend this season carries into the next.', redraftBody: 'Your transfer budget for the season.' },
      { at: 'auction-closes', fallback: 'lot-closes', title: 'Closes', body: 'When the clock runs out, he’s signed. How long that takes comes next.' },
      ...AUCTION_TIMING_STEPS,
      { title: 'Who Signs Him', body: 'The highest bidder with room. If that club has filled up since bidding, the next bidder with room wins at their own bid.' },
      { diagram: 'fee-split', title: 'Where the Fee Goes', body: `${SOLIDARITY_PCT}% of every winning bid comes back to the league. The rest leaves the game.`, only: 'dynasty' },
      { title: 'When You Can’t Bid', body: 'You can’t bid while a healthy player is on IR, or while you’re holding a player.' },
    ],
  },
  {
    id: 'free-agents',
    title: 'Free Agency',
    route: '/transfers/free-agents',
    version: 3,
    requires: 'fa-row',
    player: 'rogers',
    steps: [
      { at: 'fa-tools', title: 'Find a Player', body: 'Search and sort every player nobody owns.' },
      { at: 'fa-row', title: 'Open an Auction', body: `Bid at least ${FIGURES.bidFloorPct}% of his value to open his auction.`, redraftBody: 'Bid on any free agent. Every bid settles together on Transfer Day.' },
      { at: 'fa-row', title: 'Scout’s Fee', body: `Open an auction and you earn ${SCOUT_PCT}% of the winning bid, even if someone else signs him.`, only: 'dynasty' },
      { diagram: 'player-card', title: 'Player Card', body: 'Press a player’s name to open his card. It’s where you’ll find every position he can play, and most pages only show his main one.' },
      { title: 'New Arrivals', body: 'A new arrival can’t be bid on until he has a market value, usually within a day.', only: 'dynasty' },
    ],
  },
  {
    id: 'deals',
    title: 'Deals',
    route: '/transfers/deals',
    version: 2,
    player: 'joaoPedro',
    steps: [
      { at: 'deals-offer', title: 'Make an Offer', body: 'Any mix of your players and Club Balance for any of theirs, listed or not.', redraftBody: 'Propose a trade with any club in the league.' },
      { at: 'deals-loan', title: 'Loans', body: 'Request borrows one of theirs. Propose lends one of yours. A loan runs 4 to 16 gameweeks, for a fee and an optional performance bonus.', only: 'dynasty' },
      { at: 'deals-slots', title: 'Loan Slots', body: 'Loans are capped. Club Facilities can raise the number you lend, but never the number you borrow.', only: 'dynasty' },
      { at: 'deals-incoming', title: 'Incoming', body: 'Offers waiting on you. Accept, reject or counter. A counter cancels the original.' },
      { title: 'Mid-Gameweek Deals', body: 'If a player in the deal has already kicked off, it goes through when the week finishes.' },
    ],
  },
  {
    id: 'players',
    title: 'Players',
    route: '/players',
    version: 3,
    player: 'palmer',
    steps: [
      { at: 'players-tools', title: 'Find a Player', body: 'Search and filter every player in the game.' },
      { at: 'players-views', title: 'Views', body: 'Browse cards, read the full table, or compare players in the Explorer.' },
      { diagram: 'player-card', title: 'Player Card', body: 'Press any player to open his card: his ratings, his form, who owns him and every position he can play. Most pages only show his main one.' },
    ],
  },
  {
    id: 'cups',
    title: 'Cups',
    route: '/tournaments',
    version: 2,
    steps: [
      { at: 'cups-shelf', title: 'Trophies', body: 'Four to win every season: the league title and three cups. Select a cup to see its draw.' },
      { at: 'cups-next', title: 'Your Next Tie', body: 'Who you play next, and when.' },
      { at: 'cups-rounds', title: 'The Draw', body: 'Every round of this cup. Some are two-legged, decided on aggregate.' },
      { title: 'One Lineup', body: 'You don’t pick a cup team. Your gameweek score counts for your league match and any cup tie that week.' },
      { title: 'Seeding', body: 'Brackets are seeded on league position, and byes go to the top seeds. In a league’s first season, seeding waits for gameweek 7.' },
      { title: 'Two Kinds of Draw', body: 'The Champions Cup bracket is fixed from the start. The League Cup is drawn round by round.' },
      { title: 'Level Ties', body: 'Cup ties can’t end level. The club with the best individual performer goes through, then the higher position in the bracket.' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    route: '/finance',
    version: 2,
    player: 'haaland',
    steps: [
      { at: 'fin-hero', title: 'Spendable', body: 'Your Club Balance, less what your live bids would cost if they all won.' },
      { at: 'fin-view', title: 'My Club and League', body: 'Switch to see every club’s money.' },
      { at: 'fin-due', title: 'Money Due', body: `Match Revenue pays out every ${FIGURES.meritPeriod} gameweeks, and more for a win than a draw.`, only: 'dynasty' },
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
