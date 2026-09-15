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
summary:    Ask Futbolpedia about your club from league chat, spend Club Balance on permanent squad upgrades, and relive your league's history in Heritage.
is_major:   true
highlights: [
  "Ask Futbolpedia about your club, right in league chat",
  "Club Facilities: buy extra Academy, IR and loan slots",
  "Auction changes: a 60% bid floor and a Scout's Fee win or lose",
  "Held players: what happens when a player arrives at a full squad"
]
```

---

## Ask Futbolpedia

Futbolpedia is the football scout behind the scouting report on every player
page. It now sits in your league chat, pinned at the top under **Assistant**,
and when you ask it something it's looking at your club.

**What it knows.** Your squad, including your XI, bench, Academy, IR and loans.
Your Club Balance, your place in the table, and this week's matchup. Your
league's settings, and every listing and live auction in your league. When you
name a player, it looks him up: his current club, role, minutes, fitness and
transfer talk. It never treats fantasy points as proof of how good a player is.

**What to ask it.**

- **Your squad.** "Where's my squad weakest?" or "Who covers left-back if my
  starter's out?"
- **Trades.** "Should I trade my striker for theirs and €20m?" A trade question
  gets a verdict from **Hold** to **Take**, how confident it is, and a score out
  of 5 for each of the four things behind it: how good the player coming back
  is, whether your squad can cover the one leaving, whether you have a real use
  for the cash, and how much the player leaving matters to your XI.
- **The market.** "Is anything on the board worth bidding on for my midfield?"
- **The rules.** "Can a CB cover an LB slot?" or "When does my formation lock?"

**What it doesn't do.** It advises, but it can't set your lineup, bid, or send an
offer. It's connected to your club and nobody else's, and nobody else in the
league sees what you ask. Conversations aren't saved yet, so each visit starts fresh.

Open chat from the top bar and choose **Futbolpedia**. From your club page, chat
opens straight on it.

## Club Facilities

Club Balance can now buy capacity as well as players. Each upgrade adds a slot
for your club, permanently:

| Facility | Standard | Upgrades |
|---|---|---|
| Academy | 3 slots | Slot 4 for €60m, then slot 5 for €90m |
| Injured Reserve | 2 slots | Slot 3 for €60m |
| Loans Out | 1 player | Slot 2 for €30m |

Buy them from **Club Facilities** at the top of your club page. Each is a
one-time payment with no upkeep, and it stays with your club every season.
Every manager can see how far your facilities are built. The money leaves the
league rather than going to another club.

When your Academy or IR is full, you'll see an **Expand** link beside it on your
lineup page.

## Auction Changes

**The free-agent bid floor is now 60% of market value**, up from 50%. It rounds
down, so a €2m player still opens at €1m.

**The Scout's Fee now pays whether you win or lose.** Nominate a player and you
get 10% of the winning bid either way. If you win, it comes back to you as a
rebate on your own bid. Before, it only paid when you lost, which gave the scout
a reason to stop bidding short of what the player was worth to them.

**Only auctions a manager opens pay a Scout's Fee.** When Gaffa opens an auction
itself (a new arrival, a re-auction after a drop, a player returning to the
Premier League), being first to bid is luck rather than scouting, so the whole
20% goes to the other clubs as solidarity.

## Held Players

A player can arrive when your squad is already full: a loan ends, a player you
retained comes back to the Premier League, or you win an auction nobody with
room bid on. He's no longer dropped for you, and he doesn't push you over the
limit. He's **held**: still yours, off the squad, and not counted.

- **Activate him yourself** once you've made room, into your reserves, or your
  academy or IR if he qualifies. You can't activate mid-gameweek.
- **While a player is held, your squad can't grow.** No bids, no loans in, no
  recalls, no promotions from the academy or IR, and no trades that bring in
  more players than they send out. Your live bids are withdrawn when he's held.
- **Don't leave him there.** If he's still held when the next gameweek kicks
  off, your lineup locks. Your last saved lineup is used, and only a slot whose
  player is no longer available gets filled.
- **Auctions now go to the highest bidder with room.** If the top bidder has no
  room by the time the auction ends, the next bidder who does wins at their own
  bid. Only if nobody who bid has room does the top bidder win, and his new
  signing is held.

## Players Who Leave on Loan

A player who leaves the Premier League on loan no longer gets a Release or
Retain decision. He goes on your Retained List as **On Loan Abroad**, uses no
squad place and no retained slot, and rejoins your squad when he's back. You can
still trade him, or drop him for nothing.

## Heritage

**History** is now **Heritage**, and it holds everything your league has done:

- **Seasons**, with every champion's **Title-Winning XI**.
- **Head-to-Head**, with a page for every pairing. Cup ties count too.
- **Record Book**: highest scores, biggest winning margins, and the longest
  runs with and without a win.
- **Trophy Cabinets** for every club, side by side.

It's early in the first season, so most of it fills in as the weeks go.

## Projected Points

Before kickoff, every player on your lineup now shows his projected points for
the gameweek. An outlined figure is a projection, and it fills in when he's
scored. Projections are built from his starts, minutes, fitness, and the
fixture.

A player's game log shows his next opponent, the kickoff in your own time zone,
and his projection.

Your club page opens on **Pitch**, your best XI by projection, with a **Depth
Chart** beside it. Turn off **Include Academy & IR** to see only the players you
can field this week.

## A New Home Screen

Gaffa opens on a new home screen. Your leagues sit at the top as cards: tap one
for League Home, or jump straight to your squad or matchup. Below them are the
**Top Rated** players for the matchweek or the season, and the Premier League
matchweek as it plays out.

## Team of the Week

**Top Performers** on League Home is now **Team of the Week**: the best XI from
the last gameweek, in formation, with a bench, a total, and who owns each
player.

## Also New

- **New Transfers** on the market and the Free Agents tab shows players who
  joined the Premier League in the last 7 days and have no auction yet.
- IR moves open once the gameweek's last match kicks off, instead of the next
  morning. Players in this week's lineup, starting or on the bench, still wait
  until the week settles.
- A lot that isn't open yet reads **Opens 12:00** on the board, with bidding
  disabled until then.
- Players: filter by Gaffa club, and Cards now has every filter Table has. Your
  filters carry between the two.
- On mobile, your squad and reserves open as a sheet from the bottom of the
  lineup page, and tapping a player on your club page opens his details as a
  sheet.
- The **Devastating** attacking verdict is kept for hat-tricks and games like a
  goal and three assists. A brace rates **Ruthless** or **Rampant**.
- Fixtures in progress on League Home read **Live**, not **Draw**.

## Notifications

- Two hours before an auction closes, everyone who's bid on it gets a final
  call. For a player worth €50m or more, the whole league does, and the whole
  league hears who signed him.
- Trade offers name the players and cash involved.
- Push titles and emails name the league, and the bell on the home screen
  labels each notice with its league.
- New arrivals are announced by name and club, with how long you have to bid.
- After you bid, Gaffa offers to turn on push alerts so you hear when you're
  outbid.
- If your phone stopped getting alerts because its subscription expired, it
  reconnects without asking.

## Fixed

- On phones, an auction result replaced the live-auction alert, so some
  managers never saw who won.
- An auction announcement said bidding was open hours before it opened.
- Kickoff times showed in UTC rather than your own time zone.
- The Players table's gameweek filter offered only gameweeks 1 to 3.
- Mobile: the matchup scoreline ran off the edge of its panel, club names on
  fixture rows shrank to a single letter, squad pitch rows overlapped, and
  table columns overlapped on the Players page.
- The mobile menu listed pages in a different order from the desktop bar.
- Closed a gap on the old trades page that let a bid skip the IR and academy
  checks.

---

# Part 2: Why This Order

The order runs from what changes how you play to what you'll notice anyway.

1. **Ask Futbolpedia** leads because it's the flagship and it's new
   behaviour nobody will find on their own. It's a chat channel, not a
   page, so without the post most managers never open it. It gets the longest
   section because an assistant is only useful once you know what it can see
   and what to ask: its knowledge, four kinds of question with examples, and
   its limits.
2. **Club Facilities** and **Auction Changes** come next because they change
   money. A manager who misses them bids at the wrong floor tomorrow, or
   doesn't know that €60m can buy an IR slot. Money decisions stay prominent.
3. **Held Players** sits right after the auction section because "the highest
   bidder with room wins" changes who wins auctions, and a held player can lock
   a lineup. It's a rule to learn before it bites, not a feature to enjoy.
   **Loans abroad** follows as the same kind of squad rule, but rarer.
4. **Heritage** is the biggest new surface, but it costs nobody points if they
   miss it, and both alpha leagues are four gameweeks old, so it's thin today.
5. **Projected Points** is high value, but managers will see it the next time
   they set a lineup. Only the outline-versus-filled convention needs a sentence.
6. **Home screen** and **Team of the Week** are visible on first load and
   explain themselves, so they get the shortest sections.
7. **Also New**, **Notifications** and **Fixed** are quiet lists, in that order.

The four highlights follow the first four sections. Heritage is left out of the
highlights but kept in the title, because the title can carry a name while a
highlight has to earn its line.

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
| Lineup carry-forward rewrite (`4fa71652`) | Consolidates existing behaviour. |
| Reference-stats script and GK save cap (`99217b9a`, `56683a5b`) | No stored rating changed. |
| Economy test harness, scripts, agent docs, UI rules tooling | Internal. |
| `/ui-showcase` page | Internal tooling. |
| Copy sweeps (`6ed11ae0`, `2e9c848d`) | Wording only; nothing to learn. |
| Targets | Deferred to the next update. |
| Lineup builder, mini game | Not built. |

---

# Part 4: Before Publishing

1. **Futbolpedia's rules brief predates this update.** Its snapshot in
   `~/Futbolpedia/constants/gaffaRules.ts` is version `2026-09-06`. It still
   says the free-agent floor is 50% and IR is capped at 2, and it has no held
   players, Club Facilities, or Scout's Fee on a win. League settings reach it
   live, so it gets your league's 60% floor right when connected. A rules
   question about anything else in this update gets the old answer. Refresh the
   snapshot from `docs/USER_GUIDE.md` and bump the version before publishing.
   The post's example rules questions avoid those topics until then.
2. **PR #13 also removes the trophy row from the club page header.** The
   original commit did this on purpose, and Heritage's Trophy Cabinets replaces
   it.
3. **You haven't seen the held-player screens.** The section above describes
   rules from the user guide, not screens, so it holds either way. No league
   has a held player right now.
4. **No screenshots yet.** The last two posts carried images. Club Facilities,
   Heritage and the home screen are the obvious three.
