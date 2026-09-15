# Mid-September Update: changelog source

**Drafted:** 2026-09-15
**Covers:** everything since the last published update,
`scouting-reports-player-profiles-deadline-day` (2026-09-02 15:46 UTC).
**Assembled from:** 94 non-merge commits on `main` from `a466be32` (2026-09-02
11:47 ET) to `d613f7ab` (2026-09-15), plus PR #13 (Ask Futbolpedia in league
chat) and Futbolpedia's own Gaffa-mode code (`~/Futbolpedia/services/gaffaChatService.ts`,
`constants/gaffaRules.ts`), which defines what the chat can do.

Part 1 is the post, ready for `product_updates`. Part 2 explains the order.
Part 3 is the inventory: what's in, and what's left out on purpose. Part 4 lists
what needs deciding before it goes out.

---

# Part 1: The Post

```
slug:       ask-futbolpedia-club-facilities-heritage
title:      Ask Futbolpedia, Club Facilities, and Heritage
summary:    Ask Futbolpedia about your club in league chat, spend Club Balance on permanent squad upgrades, and look back on your league in Heritage.
is_major:   true
highlights: [
  "Ask Futbolpedia about your club in league chat",
  "Club Facilities: buy extra Academy, IR, and loan slots",
  "A 60% bid floor, and a Scout's Fee whether you win or lose",
  "Held players: what happens when a player joins a full squad"
]
```

---

## Ask Futbolpedia

Futbolpedia, the scout who writes the report on every player page, is in your
league chat. Open chat from the top bar and choose **Futbolpedia** under
**Assistant**, or open chat from your club page to go straight to it.

Ask about your club and you get answers based on your actual squad (XI, bench,
Academy, IR, and loans), your Club Balance, your place in the table, this
week's matchup, your league's settings, and every listing and live auction in
your league. Name a player and you get his current club, role, minutes,
fitness, and transfer news. Fantasy points never count as evidence of how good
a player is.

Try asking about:

- **Your squad.** "Where's my squad weakest?" or "Who covers left-back if my
  starter's out?"
- **Trades.** "Should I trade my striker for theirs and €20m?" You get a
  verdict from **Hold** to **Take**, a confidence level, and a score out of 5 on
  four factors: the quality of the player you'd get, whether your squad can
  cover the one you'd lose, whether you have a use for the cash, and how much
  your outgoing player matters to your XI.
- **The market.** "Is anything on the board worth bidding on for my midfield?"
- **The rules.** "Can a CB cover an LB slot?" or "When does my formation lock?"

## Club Facilities

You can spend Club Balance on capacity as well as players. Every club starts
with 3 Academy slots, 2 IR slots, and 1 player out on loan. Each upgrade is one
more slot for your club, for good:

| Upgrade | Price |
|---|---|
| Academy slot 4 | €60m |
| Academy slot 5 | €90m |
| Injured Reserve slot 3 | €60m |
| Loans Out slot 2 | €30m |

Buy upgrades from **Club Facilities** at the top of your club page. You pay
once, there's no upkeep, and you keep the slot every season. Every manager can
see your facilities. The money doesn't go to another club; it leaves the league.

When your Academy or IR is full, look for the **Expand** link beside it on your
lineup page.

## Auction Changes

**Free-agent bids start at 60% of market value**, up from 50%. Floors round
down, so you can still open a €2m player at €1m.

**You get the Scout's Fee whether you win or lose.** Nominate a player and you
earn 10% of the winning bid either way. If you win, you get it back as a rebate
on your own bid. Before, the fee paid out only when you lost, so a scout had a
reason to stop bidding short of what the player was worth to them.

**You earn a Scout's Fee only on an auction you open.** Auctions that open
automatically, for a new arrival, a re-auction after a drop, or a player
returning to the Premier League, pay no Scout's Fee, because being first to bid
there is luck rather than scouting. The other clubs share the full 20% as
solidarity instead.

## Held Players

Sometimes a player joins your club when your squad is already full: a loan
ends, a player you retained returns to the Premier League, or you win an
auction that nobody with room bid on. You don't lose anyone to make space, and
you don't go over the limit. He's **held**: still yours, but off the squad and
not counted.

- **Activate him yourself** once you've made room, into your reserves, or into
  your Academy or IR if he qualifies. You can't activate a player
  mid-gameweek.
- **While you're holding a player, your squad can't grow.** You can't bid,
  borrow, recall a loan, promote from the Academy or IR, or accept a trade that
  brings in more players than it sends out. Any bids you have live are
  withdrawn when he's held.
- **Resolve him before the next gameweek.** If he's still held at the next
  gameweek's first kickoff, you can't change your lineup until you resolve him.
  You keep your last saved lineup, with only unavailable players replaced.
- **Auctions go to the highest bidder with room.** If the top bidder has no
  room when the auction ends, the next bidder with room wins at their own bid.
  Only if nobody who bid has room does the top bidder win, and that player is
  held.

## Players Who Leave on Loan

When one of your players leaves the Premier League on loan, you don't make a
Release or Retain decision. You'll find him on your Retained List as **On Loan
Abroad**. He uses no squad place and no retained slot, and he rejoins your squad
when he's back. You can still trade him, or drop him for nothing.

## Heritage

**History** is now **Heritage**, with everything your league has done in one
place:

- **Seasons**, with every champion's **Title-Winning XI**.
- **Head-to-Head**, with a page for every pairing. Cup ties count too.
- **Record Book**: highest scores, biggest winning margins, and the longest
  runs with and without a win.
- **Trophy Cabinets** for every club, side by side.

It's early in the first season, so you'll see more here as the weeks go by.

## Lineup Builder

Build any XI from the whole Premier League, not only your squad. Open **Lineup
Builder** from the top bar, choose one of the 12 formations, and fill each
position with any player in the league. Give the lineup a name, then tap **Share
XI** to send it as an image, or **Copy Link** to share a link that opens the same
lineup.

To start from your own side, tap **Share Lineup** on your lineup page.

## Transactions

**Activity** is now **Transactions**: every completed signing, departure,
trade, and loan in your league, grouped by day. Filter by kind or club, search
for a player, or switch seasons. Bids stay on Transfers, and payments like Match
Revenue and solidarity stay on your finance page.

On League Home, **The Wire** is now **Transactions** too. The Wire on Transfers
still shows live bids, offers, and listings.

## Projected Points

Before kickoff, you'll see each player's projected points for the gameweek on
your lineup. An outlined figure is a projection, and a filled one is points
he's scored. Projections come from his starts, minutes, fitness, and the
fixture.

In a player's game log, you'll find his next opponent, the kickoff in your time
zone, and his projection.

On your club page, **Pitch** is your best XI by projection, with **Depth
Chart** beside it. Turn off **Include Academy & IR** to see only the players
you can field this week.

## A New Home Screen

You'll start on a new home screen. Your leagues are at the top as cards: tap
one for League Home, or go straight to your squad or matchup. Below them are
the **Top Rated** players for the matchweek or the season, and the Premier
League matchweek as it plays out.

## Team of the Week

**Top Performers** on League Home is now **Team of the Week**: the best XI from
the last gameweek, in formation, with a bench, a total, and each player's owner.

## Also New

- Under **New Transfers** on the market and the Free Agents tab, find players
  who joined the Premier League in the last 7 days and have no auction yet.
- You can make IR moves once the gameweek's last match kicks off, instead of the
  next morning. Players in this week's lineup, starting or on the bench, stay
  locked until the week settles.
- On the board, a lot that isn't open yet is marked **Opens 12:00**, and you
  can't bid on it until then.
- On Players, filter by Gaffa club, and use every Table filter in Cards too.
  Your filters stay set when you switch views.
- On mobile, open your squad and reserves from a sheet at the bottom of the
  lineup page, and tap a player on your club page to see his details in a
  sheet.
- A player earns the **Devastating** attacking verdict for a hat-trick or a
  game like a goal and three assists. A brace earns **Ruthless** or
  **Rampant**.
- Fixtures in progress on League Home are marked **Live**, not **Draw**.

## Notifications

- Two hours before an auction closes, everyone who's bid on it gets a final
  call. For a player worth €50m or more, the whole league gets the call, and
  the whole league hears who signed him.
- Trade offer alerts include the players and cash involved.
- Push titles and email subjects include the league name, and on the home
  screen, each notification is marked with its league.
- New arrivals are announced by name and club, with the time you have left to
  bid.
- After you bid, you can turn on push alerts to hear when you're outbid.
- If your phone stopped receiving alerts because its subscription expired,
  you'll receive them again without doing anything.

## Fixed

- On phones, some managers never saw who won an auction.
- An auction was announced as open hours before you could bid on it.
- Kickoff times appeared in UTC instead of your time zone.
- You could filter the Players table only to gameweeks 1 to 3.
- On mobile: matchup scorelines running off their panel, club names on fixture
  rows cut to a single letter, overlapping squad pitch rows, and overlapping
  columns on the Players table.
- Pages in the mobile menu were in a different order from the desktop bar.
- Bids placed from the old trades page skipped the IR and Academy checks.

---

# Part 2: Why This Order

The order runs from what changes how managers play to what they'll notice
anyway.

1. **Ask Futbolpedia** leads because it's the flagship and nobody finds it on
   their own. It's a chat channel, not a page, so without the post most
   managers never open it. It gets the longest section because an assistant is
   only useful once you know what it can see and what to ask.
2. **Club Facilities** and **Auction Changes** come next because they change
   money. A manager who misses them bids at the wrong floor tomorrow, or never
   learns that €60m buys an IR slot. Money decisions stay prominent.
3. **Held Players** follows the auction section because "the highest bidder
   with room wins" changes who wins auctions, and a held player can freeze a
   lineup. It's a rule to learn before it matters. **Loans abroad** comes next
   as the same kind of squad rule, but rarer.
4. **Heritage** is the biggest new surface, but missing it costs nobody points,
   and both alpha leagues are four gameweeks old, so there isn't much in it yet.
   **Lineup Builder** follows as the other new surface: fun to share, but
   separate from how anyone's league plays out. **Transactions** comes after
   because it replaces pages managers already know; it needs one sentence on
   why revenue rows moved to Finance.
5. **Projected Points** is valuable, but managers see it the next time they set
   a lineup. Only the outlined-versus-filled convention needs a sentence.
6. **Home screen** and **Team of the Week** are visible on first load and need
   little explanation, so they get the shortest sections.
7. **Also New**, **Notifications**, and **Fixed** are short lists, in that
   order.

The four highlights follow the first four sections. Heritage is in the title
but not the highlights: a title can carry a name, while a highlight has to earn
its line.

---

# Part 3: Inventory

## In the Post

| Feature | Commits / PR |
|---|---|
| Ask Futbolpedia in chat | PR #13 (includes a fix so the context sends each club's upgraded caps); context API #2, `f72c6c80` (listings and league settings added to the context Futbolpedia reads), `0fe553e0` |
| Club Facilities | `c2346269` (PR #10), migration `166_club_facility_upgrades` |
| Bid floor 50% → 60% | `c2346269` (same migration) |
| Scout's Fee win or lose | `c4dd4bcd` (PR #9), migration 165 |
| Scout's Fee manager-opened only | `d3003323` (landed after the 09-02 post went out) |
| Held players | `6984b64b` … `21300cb5` (PRs #6, #7), migrations 161–164 |
| Two-pass auction settlement | `af6d463f` |
| On Loan Abroad | `0c413192`, migrations 159–160 |
| Heritage | `894af998`, `d613f7ab` (PR #12), migration 156 |
| Lineup Builder and Share Lineup | PR #14 (rescued from uncommitted files in the main folder, with layout, pagination and club-filter fixes) |
| Transactions page and League Home rail | PR #16 (`feat/transactions-page` rebased, with ledger rows filtered in the rail query) |
| Match Revenue label | PR #15, plus the 22 GW1–4 ledger notes renamed in place |
| Projected points on lineup and game log | `e1c55b75`, `3e4368d7`, `ed63ade8`, `3e47437a`, `7ba5dc93`, `c1670d3a`, `63b88495`, `248fd773` |
| Club page Pitch and Depth Chart | `99dcaab2`, `e14943ee`, `d468d1b0` |
| Home screen | `50ae5bb4`, `28cbb55f`, `776a0841`, `afb318c4` (PR #11), migration `166_season_top_rated` |
| Team of the Week | `39a3eb2e`, `42f593d5` |
| New Transfers | `38f51a06`, `bf9d0b4f` |
| IR opens after last kickoff | `6f78fce5` (PR #8) |
| Lot not open yet | `58104057`, `b0162482`, `d59de1a6` |
| Players filters | `7b15ab4e`, `16059f29` |
| Mobile lineup sheet, club Inspector sheet | `248fd773`, `9cc1f7ce` |
| Devastating verdict | `3c021a45` |
| Live fixtures on Home | `1fd6e0dc` |
| Notifications | `a03570b1`, `90217223`, `980ce8c1`, `e41bd1b2`, `1ae90e33`, `713b4406`, `40fe07be` |
| Auction announced as open early | `0987af14` |
| Local kickoff times | `a7e7f6e7`, `63b88495` |
| Gameweek filter truncation | `ea2a664f` |
| Mobile fixes | `a9336c94`, `dd651b00`, `de0933d4`, `eab139e6`, `5fd211d8`, `0747eb20` |
| Legacy bid path | `efac14a6` |

## Left Out on Purpose

| Change | Why it's not in the post |
|---|---|
| Page performance (`ea2a664f`, `43372596`) | No measurement to back a "faster" claim. |
| Shared UI component kit, modal moves (`7e33c3a5`) | Committed from an unreviewed working tree; no visible change worth naming. |
| Lineup carry-forward rewrite (`4fa71652`) | Consolidates existing behavior. |
| Reference-stats script and GK save cap (`99217b9a`, `56683a5b`) | No stored rating changed. |
| Economy test harness, scripts, agent docs, UI rules tooling | Internal. |
| `/ui-showcase` page | Internal tooling. |
| Copy sweeps (`6ed11ae0`, `2e9c848d`) | Wording only; nothing to learn. |
| Targets | Deferred to the next update. |
| Mini game | Not built. |

---

# Part 4: Publishing

## The Pop-Up

The announcement uses the pop-up that shipped with the last update
(`UpdateAnnouncementModal`). Publishing sends every account one
`kind: 'product'` notification. The next time a manager loads Gaffa, the
pop-up opens once with the title, the summary, the four highlights, and a
**See what's new** button to the full entry at
`/updates#ask-futbolpedia-club-facilities-heritage`. Dismissing the pop-up
also clears the bell, and the reverse.

Preview both screens, in both themes, in
`scratch/gaffa-update-preview-2026-09-16.html`. Rebuild it after any copy
change:

```bash
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scratch/build_update_preview_2026_09_16.tsx
```

## Publish

Check the post exactly as it will be stored:

```bash
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scratch/publish_update_2026_09_16.ts --dry-run
```

Then publish and send the pop-up:

```bash
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scratch/publish_update_2026_09_16.ts
```

The script reads the body from this file and stops if the slug, title,
summary, or highlights here differ from its own copy. Running it twice is
safe: the entry updates in place, and nobody gets a second pop-up.

## Before You Publish

1. **Redeploy Futbolpedia.** Its rules snapshot is now version `2026-09-15`
   (dukerwang/Futbolpedia#4, merged to `main`), covering held players, Club
   Facilities, the 60% floor, the Scout's Fee on a win, loans abroad, and IR
   after the last kickoff. `futbolpedia.ai.studio` serves the old snapshot
   until you redeploy it.
2. **You haven't seen the held-player screens.** The Held Players section
   describes rules from the user guide, not screens, so it's accurate either
   way. No league has a held player right now.
3. **No screenshots yet.** The last two posts carried images. Club Facilities,
   Heritage, and the home screen are the obvious three.

PR #13 removed the trophy row from the club page header, as its original commit
intended. Trophy Cabinets in Heritage replaces it.
