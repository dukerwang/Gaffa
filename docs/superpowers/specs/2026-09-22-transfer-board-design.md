# Transfer Board: Listings and Targets as one feature

Designed with Duke on 2026-09-22. Supersedes the page structure in
`2026-09-04-targets-design.md`; that spec's data model, matching and
notification rules still stand except where this one says otherwise.

Visual reference: the "Targets C (22 Sep)" page of the Targets canvas
(https://claude.ai/artifact/Pu4PBUSDzsWAiNj6f5CZ6v). The Board page grows out
of that prototype.

## Problem

Listings (supply) and Targets (demand) were designed as two tabs. The value of
Targets is the link between the two: a player you want gets listed, or a club
wants a player you have. Two tabs hide that link at the moment it matters.
Separately, a manager's pending decisions are spread across Transfers: outbid
notices in Auctions, offers in Deals, listings in Listings. Nothing answers
"is there anything I need to do?" in one place.

## Decisions

Each was chosen by Duke from options in the design session.

1. **Market stays the home of Transfers**, a page that tells you what's going
   on and leads to the subfeatures. It gains one section, **Your Move**.
2. **Listings and Targets merge into one tab, Board.** "Board" is a placeholder
   name: "don't love the name, but i won't waste time on it until i can think
   of a better one."
3. **Tabs:** Market · Auctions · Board · Free Agency · Deals.
4. **One composer (Add)** for everything. The player you pick decides whether
   it becomes a listing or a target.
5. **The league board has a Listed / Wanted switch**, with a position filter
   that shows both counts for each position.
6. **A free agent in the composer** offers Start Bidding first and Target Him
   second.
7. **Default visibility depends on the kind of target:** a named target starts
   at Only You; a role target starts at The League.
8. **When supply meets demand, both sides act where they are:** the buyer gets
   the live listing with Bid or Offer filled in from their target; the seller
   sees demand in the composer before posting, and the interested clubs are
   told once they post.

## Structure

### Market (home)

**Your Move** sits at the top. It lists open decisions only, one row each:

| Item | Source | Inline action |
|---|---|---|
| You've been outbid | `auction_state` | Bid |
| An offer is waiting on your reply | `trade_proposals` | Reply |
| A club wants one of your players, or a role target you could fill | `player_targets` | Offer |
| A player you target is listed, at auction, or a free agent | `player_targets` × listings / auctions | Bid or Offer |
| First bid on one of your listings | `auction_state` | View |

Each row links to where the item is handled in full. With nothing pending, the
section is one line: "Nothing waiting on you." Under it, Market keeps its
digest: Closing Now, New Transfers, a board preview (three listed, three
wanted), Deadlines, and The Wire in the rail.

Your Move shows what is new or unanswered. It is a prompt, not a second
workspace; the Board holds everything standing.

### Board

1. **Your side of the market:** Your Listings, Your Targets and Wanted From
   You, each item showing its live state (clock, bids, interested clubs,
   matches). **Add** sits in the heading of Your Targets and Your Listings;
   both open the composer, and the Your Listings one starts on your own squad.
   Your Targets keeps individual cards (the auction card and target tiles);
   the other sections are panels with the heading in the panel's own top bar.
2. **The Board:** the Listed / Wanted switch, the position filter with both
   counts, and each view's own filters. Listed rows keep Bid and Offer. Wanted
   rows are statements with no buttons. A wanted row you could fill from your
   squad appears under Wanted From You instead, so where a row sits and which
   buttons it has always agree (DECISIONS 2026-09-10).

## The composer (Add)

Opened from Add on the Board, or already filled in from a player card, the
player hub, a Free Agency row or a board row.

**Step 1, Who.** One search across the league's player pool, grouped Your
Squad / Other Clubs / Free Agents, each row with owner crest and value. **A
Position Instead** sits under the search. Opening from a player skips this
step.

**Step 2** shares one layout for every kind: player plate (portrait, name,
position chip, club, value), who is told, what you want or would give, price,
a preview, the action.

| You picked | It becomes | Specific to this kind | Action |
|---|---|---|---|
| Your player | Listing | Demand line; auction floor (60% of value by default, or No Auction, Offers Only); optional asking price; optional release clause | List {Name} |
| Another club's player | Named target | Visibility: Only You (default) / Only {Club} / The League; budget; note (140 characters). If he is already listed, the live listing with Bid and Offer replaces the form's top | Add Target |
| A free agent | Bid or target | Start Bidding (primary, opens the bid dialog) or Target Him (the target form without the owner option) | Start Bidding / Add Target |
| A position | Role target | Position and role (Star, Starter, Bench, Prospect); visibility: The League (default) / Only You; listed players who already fit | Add Target |

Cash / Players / Loan chips appear on every kind, worded for the direction
(`listingStance` and `targetStance`).

**Editing** reopens the composer filled in. A listing locks once bidding
starts (existing rule, `PATCH /listings/[id]` returns 409). A target stays
editable; saving renews its 28 days and never notifies again. Withdraw sits in
the footer. On mobile the composer is a bottom sheet.

## Small lines

Duke, 2026-09-22: "make sure they're actually informative and as least noisy
as possible, again i don't want ui elements that take up space but don't
contribute anything meaningful in terms of data or appearance. and please make
sure they are formatted properly and don't mess with the look of the page."

Applied here, and recorded in `docs/DECISIONS.md` for the whole app:

- A line appears only when it has something to say. No demand means no demand
  line, never "No clubs want him".
- One fact per line, and it never wraps. A named club beats a position count;
  the count shows only when nobody has named the player. Crests replace words
  where they can.
- Caps appear only near a limit (9 of 10 targets, or 5 of 5 visible when
  choosing The League).
- A visibility consequence shows only for the option you picked.
- The preview is the real board row, not a sentence describing it.

## Code

**Two tables stay two tables.** `player_sale_listings` is transactable and
`resolve_single_player_auction_rpc` reads it directly; `player_targets` must
never satisfy auction code. Everything above the tables is shared:

- **`BoardPost`** in `buildTransfersModel`: one type carrying listings and
  targets, each tagged `direction: 'selling' | 'wanting'`. The Board and Your
  Move read it.
- **`src/lib/transfers/stance.ts`** exports `listingStance` and
  `targetStance`. They stay separate functions because the flags mean opposite
  things, but they live in one module with one test file.
- **`PostComposer`** replaces `ListingEditor` and the planned `TargetEditor`,
  calling the existing listings routes and the targets routes from
  `feat/heritage-targets-projections` unchanged. A pure `composerMode(player,
  myTeamId)` returns `listing | named | freeAgent | role`.
- **`buildYourMove(model)`**: a pure function over data the transfers model
  already loads (auctions, listings, trade proposals, targets). No new
  endpoint, no polling. `useLiveTransfers` adds `player_targets` to its
  Realtime subscription.
- **Matching and notifications** come from the Targets branch as written
  (`matchTargets`, `notifyTargetMatches`).
- **Only {Club}** needs migration 168 (renumber if taken at build time; check
  every branch): widen `visibility` to `public | direct | private`, allow
  `direct` only on named targets, and add an RLS clause letting the targeted
  player's current owner read a direct target. A direct target counts toward
  the 10 active but not the 5 public. The Board's tab count becomes public
  targets plus direct ones aimed at you.

## Edge cases

- **Your target becomes yours** by any route: auto-filled (migration 154).
- **The targeted player changes clubs:** the target follows him; a direct
  target is now visible to the new owner, not the old one.
- **A free agent you target is signed:** the target follows him to his new
  club at its current visibility.
- **You can't bid right now** (holding a player, or a healthy player on IR):
  Bid in Your Move and the composer is disabled with the reason, same as the
  auction room.
- **Kickoff lock:** listings still defer at kickoff as today; Your Move says
  "settles after the gameweek" rather than offering an action.
- **Caps reached:** the composer disables The League or Add Target with the
  cap named, before submit; the route still enforces it.
- **Expired targets** vanish on read (28 days, no cron), with "expires in n
  days" on your own items in the last week.
- **Empty board views:** one line each ("Nothing listed at CB").

## Testing

- Unit: `stance.ts`, `composerMode`, `buildYourMove`, the `BoardPost` mapping.
- Route tests for targets (already on the branch) plus `direct` visibility.
- RLS for `direct`, tested in SQL against two accounts, not through the UI.
- `npm run build`, `npm test`, `npm run check:ui`.

## Rollout

Each step builds and ships on its own:

1. Merge the Targets backend from `feat/heritage-targets-projections`, plus
   migration 168.
2. Board page and `PostComposer`; `/transfers/listings` redirects to Board.
3. Market gains Your Move and the board preview.
4. Remove `ListingEditor` and the Listings client once nothing imports them.

## Not in this spec

- The Transfers-wide visual update to match Targets C. Separate project, after
  this lands.
- The tab's final name.
- Replacing Archivo Narrow app-wide. Sofia Sans Semi Condensed is Duke's
  current preference ("sofia sans actually looks pretty good to me"); the
  Board prototype uses it for labels and buttons.
