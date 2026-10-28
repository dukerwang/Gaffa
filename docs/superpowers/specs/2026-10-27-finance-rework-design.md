# Finance rework

Decided with Duke on 2026-10-27, from three question cards in one session.

## Why

The old `/finance` page was a history page: six totals, a category bar chart and
a paginated ledger. A club records 10 to 30 transactions a season, so the
history is short, and the hard money questions are forward-looking:

- Bids are not reserved. Each bid is checked against the current balance on its
  own (`auctions/bid/route.ts`), and at the clock the resolver skips a winner
  who can no longer pay (`insufficient_budget`, migration 115). A manager
  leading three auctions can lose one without noticing why.
- Match Revenue accrues over four-gameweek periods and pays at the boundary
  (`src/lib/economy/payMeritPeriod.ts`).
- The season prize depends on where the club finishes (`computeSeasonPrize`).
- Offers on a listing, pending departure compensation and the next Club
  Facilities step all change what a manager can afford.

## What Duke chose

- **The first screen answers "Can I afford it?"** (chosen over a history-first
  page and a league-comparison-first page).
- **Spendable = Club Balance minus the bids you are currently winning.**
  Outbid bids cost nothing and are not subtracted. A warning shows when leading
  bids add up to more than the balance.
- **Money Created / Money Destroyed moves to a League view** on the same page,
  shown as league totals, not one club's share.
- **Composition: "Shelf + Spendable"** — the dashboard's grammar (green shelf as
  the anchor field, cards overlapping its edge). Chosen over a waterfall hero
  and a single timeline.
- **Fix both ledger holes** (see Data below).

## The page

`/league/[leagueId]/finance`, two views on one switch: **My Club** and
**League**.

### My Club

1. **Shelf.** Green field under the topbar. Title "Finance", the club crest and
   name, the My Club / League switch. The hero is **Spendable** at display
   size, with the arithmetic under it as figures: Club Balance, minus Leading
   Bids, and the money due next.
2. **Two cards overlapping the shelf.**
   - **Live Bids.** Every live auction the club has bid on: portrait, name,
     your bid or the top bid, Winning / Outbid, the clock. Winning bids add up
     at the head. When they add up to more than the balance, the card takes a
     warning tint and says by how much. Empty state links to the market.
   - **Money Due.** Match Revenue for the current period (one pip per
     gameweek: W / D / L / still to play, the amount earned so far, and the
     gameweek it pays after). Projected season prize from the current league
     place (dynasty only). Top bid on each of your listings. Pending departure
     compensation, with its decide-by date, linking to the club page.
3. **Club Facilities.** One row per facility with its slots and the next
   step's price; Upgrade opens the existing `FacilityPurchaseSheet` in place.
   Dynasty only.
4. **Season.** A balance line from the opening balance to today, a point for
   every money movement, with portraits on the large signings. Beside it, In
   and Out by category.
5. **Ledger.** Every money movement, newest first, grouped by month, with a
   running balance column. Filter: All / Spending / Earnings. Rows with a
   player carry a portrait.

### League

A table of every club: crest, Club Balance, Leading Bids, Spendable, season In,
season Out. Your club is tinted. Under it, the league's money created and
destroyed this season and the net.

## Data

New module `src/lib/finance/`:

- `ledger.ts` — pure: types, the direction and category of each transaction
  type, the merge of `transactions` with trade cash, running balances, the
  opening balance, category totals. Unit-tested.
- `loadFinance.ts` — the server reads, in parallel.

**Ledger holes, both fixed:**

1. Cash in an accepted trade (`trade_proposals.offered_faab` /
   `requested_faab`) never reaches `transactions`. The ledger reads it from
   `trade_proposals` directly, as `buildRegister.ts` already does for trades.
2. The €30m Transfer Deadline grant on 2026-09-01 was applied to balances
   without a row. Migration 185 adds a `grant` transaction type and backfills
   one €30m row per club in Matchday Militia and Dynasty Dragoon, dated
   2026-09-01. Verified before writing: with trade cash included, every club in
   both leagues reconciles to €250m + €30m exactly. `grant` joins
   `LEDGER_ONLY_TYPES` so it stays off the activity feed and League Home.

## Out of scope

- A season selector. The ledger and the Season chart cover the club's whole
  history, which is one season in every live league; add the selector when a
  league reaches its second.
- **Redraft resets.** `reset_redraft_league_rpc` sets every balance back to
  the league budget without writing a `transactions` row, and nothing records
  when a season started. A redraft league's ledger therefore derives a wrong
  opening balance after its first reset. Before any redraft league finishes a
  season, the reset should write a row (or a season-start marker) that the
  ledger can start from.
- Writing trade cash into `transactions` at trade time.
- Any change to how bids are validated or reserved.
