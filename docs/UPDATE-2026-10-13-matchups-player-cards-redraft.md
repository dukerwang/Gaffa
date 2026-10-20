# October Update: changelog source

**Drafted:** 2026-10-13
**Covers:** everything since the last published update,
`ask-futbolpedia-club-facilities-heritage` (2026-09-15 16:42 UTC). PRs #14–#19,
merged later that day, were already described in that post.
**Assembled from:** 90 non-merge commits from `51d00f70` (PR #13, the last
merge before that post) to `release/2026-10-09` at `b7272bc7`, plus the PR
descriptions for #22, #28, and #33–#40 and the matching `docs/USER_GUIDE.md`
sections.

Part 1 is the post, ready for `product_updates`. Part 2 explains the order.
Part 3 is the inventory: what's in, and what's left out on purpose. Part 4 lists
what needs deciding before it goes out.

---

# Part 1: The Post

```
slug:       new-matchups-player-cards-redraft-leagues
title:      New Matchups, Player Cards, and Redraft Leagues
summary:    New Gameweeks and Matchup pages, a new player card, Lineup Builder, and new ways to run a league: Caretaker clubs, redraft leagues, and expansion drafts.
is_major:   true
highlights: [
  "Gameweeks and Matchup pages, rebuilt around the pitch",
  "A new player card, with stats and scouting beside it",
  "Lineup Builder: build any XI and share it",
  "Caretaker clubs, redraft leagues, and expansion drafts"
]
```

---

## Gameweeks and Matchups

**Fixtures › Gameweeks** is rebuilt. Step through the season from the gameweek
bar, or jump to any week from the ribbon of your 38 results.

Your own fixture comes first, as a scoreboard in both clubs' colours that shows
the margin against the 10-point draw band. Below it, every tie in the round
plays out as a line across the weekend's kickoffs. Then come **Round Records**,
the spread of the round's scores, and the table with this round's results and
who moved.

Open a matchup and you see both clubs on the pitch, each with its bench
underneath, and **Momentum**: how the score moved through the weekend. Before
kickoff each player shows his fixture. After it, his goals and assists come
first. Below the pitch are **Line Totals** and the match report, or **Still to
Play** while the round is live, then each club's team sheet and your
head-to-head record. On a phone, swipe between the two team sheets.

The Gameweeks page and the matchup page now work out scores the same way, so
the two always agree.

## Player Card

Open any player for the new card: a photo in his club's colours, his four
season figures, and his rank at the position you're viewing. Tap one of his
positions to see him scored there.

On a computer, the card opens beside **Stats** and **Scouting**. On a phone,
it opens as a sheet you can drag away.

- **Stats** has his season summary, a **By Matchweek** chart of points or
  rating, and his game log, with a breakdown of every match.
- **Scouting** has the Futbolpedia report and his Premier League form.

Choose a past season from the season menu to see his card and stats as they
were. On another club's player, select **Make an Offer** to start a deal for
him.

## Picking Your Lineup

On your lineup page, tap any player, whether he's in your XI, on the bench, in
reserves, in the Academy, or on IR, and every place he can go lights up. Tap one
to move him there, or to swap him with the player in it. An Academy or IR
player can go straight into your XI.

**Academy age is fixed for the season.** Gaffa now checks a player's age on 1
August, the start of the season. A player who's 21 or younger on that date can
stay in your Academy all season, even if he has a birthday before it ends.

## Lineup Builder

Under **Squad › Lineup Builder**, pick any Premier League players into any of
the 12 formations, then share the XI as an image or a link. Anyone who opens
the link sees the same XI. On your lineup page, select **Share Lineup** to open
the builder with your current XI.

## When a Manager Leaves

Once a league has drafted, a club no longer disappears when its manager leaves.
Deleting a club deleted every match it had played, so its rivals' results
against it vanished from the table and from the league's history.

Now, if you leave a league, or your commissioner removes you, the **Caretaker**
runs your club until a new manager takes it over. The club keeps its squad,
Club Balance, record, and fixtures. The Caretaker picks the club's best lineup
each week and manages its IR, but never bids, trades, sells, or loans. A new
manager takes the club over from the league's invite code.

- **If you go quiet.** Opening your league or your dashboard counts as being
  active. If you haven't done either for five full gameweeks, you get a
  warning. After one more gameweek, your commissioner is told. Removing you is
  still the commissioner's decision. Gameweeks are counted, not days, so an
  international break or the summer never counts against you.
- **For commissioners.** In **Settings**, see when each manager last opened
  the league, remove a manager, and hand the commissioner role to someone else.
  You need to hand it on before you can leave a league that has drafted.

## New Ways to Run a League

**Redraft leagues.** When you create a league, you can now choose **Redraft**
instead of dynasty. Every season starts with a new draft, and the league plays
the same game: the same positions, scoring, matchups, and cups. It leaves out
everything that only pays off over several seasons: the Academy, loans, Club
Facilities, listings, severance, the retained list, Match Revenue, and prizes.
Every free agent opens at €1m.

In a redraft league, bids settle together on **Transfer Day**, 24 hours before
each gameweek's first kickoff. After Transfer Day, sign any free agent nobody
bid on with **Sign Now**, for free, until his club kicks off.

**Expansion drafts.** A dynasty league can now grow by up to 4 clubs in the
offseason. Every existing club protects 8 players, and the new clubs take turns
picking from the rest, taking no more than 2 from any one club. New clubs start
with the league's median Club Balance.

The user guide has the full rules for both, and the reasoning behind the
numbers.

## A Front Page for Gaffa

Visitors to gaffa.live now see what Gaffa is before they sign in: open
auctions, Top Rated players, the Transfer Wire, match ratings, the four
trophies, and this week's Premier League fixtures. The user guide is open to
visitors too, so you can send it to a friend before they join. When you're
signed in, you still go straight to your dashboard.

## Also New

- Futbolpedia in league chat now knows about every unowned free agent, not only
  the players in live auctions.
- Players appear under the name FPL uses for them.
- Each page has its own title in your browser tab.
- A link to your league's shared stats page shows the league's name when you
  paste it into a chat.
- A page that fails to load, or doesn't exist, shows a Gaffa page with a way
  back.

## Fixed

- On a matchup, the points on the player chips and in the breakdown sometimes
  added up to a different total from the score at the top. They now match it.
- The form guide reads oldest to newest, so your latest result is on the right.
- If you'd turned on alerts on one device, your other devices still asked you
  to turn them on.

---

# Part 2: Why This Order

The order runs from what every manager sees each week to what only some
managers will use.

1. **Gameweeks and Matchups** leads because every manager opens it every
   gameweek, and it's the largest visible change. The section names the parts
   (Momentum, Line Totals, Still to Play) so nobody has to guess what a worm
   or a ribbon is.
2. **Player Card** comes next because a player opens from almost every page.
   Only the position switch and **Make an Offer** need explaining.
3. **Picking Your Lineup** carries the one rule change in the post, the
   academy age date, so it stays above the optional features.
4. **Lineup Builder** is optional and self-explanatory, so it's short.
5. **When a Manager Leaves** matters to every manager, but only when someone
   leaves, so it follows the features they'll use this week. The inactivity
   warning is there so it isn't a surprise when it arrives.
6. **New Ways to Run a League** comes late because no existing league is
   affected. Redraft only applies to new leagues, and expansion only in the
   offseason. The section points to the guide rather than repeating it.
7. **A Front Page** is for visitors, not managers, so it's near the end. It's
   in the post because managers are the ones who send the link.
8. **Also New** and **Fixed** are short lists, in that order.

The four highlights follow the first sections that change what a manager sees,
and the fourth gathers the league-format changes into one line. The title names
redraft leagues rather than Caretaker clubs because a new format is something a
manager can choose; the Caretaker is something that happens to a club.

---

# Part 3: Inventory

## In the Post

| Feature | Commits / PR |
|---|---|
| Gameweeks and Matchup pages | `24e57f0b`, `11333643`, `e22ed02f` (PR #40, reverted on `main` by #41, restored on `release/2026-10-09` in `7d7f16a0`) |
| Player Card 2.0 | `ca7bd1c2`, `c4360513`, `dab991aa`, `fb8862bb`, `62aafdd7` (PR #28), migration 168 |
| Unified lineup selection | `f291aff5`, `4ee496f9`, `bd86837b` |
| Academy age on 1 August | `f291aff5` (`getSeasonReferenceDate` in `src/lib/transfers/academyEligibility.ts`) |
| Lineup Builder and Share Lineup | `19a8c548`, `b890abfc`, `f6516497`, `d06bf8a3`, `c148c667`, `26679e8d`, `e0f58206` (PR #22, merged to `main` 2026-10-11) |
| Caretaker clubs | `834d3d44` (PR #33), migrations 169–170 |
| Caretaker lineups and IR | `676c8d52` (PR #34) |
| Inactivity alert, last active in Settings | `f71c30af` (PR #35), migration 171 |
| Redraft switches | `5b3de2b6` (PR #36), migration 172 |
| A draft every season | `a48378d0` (PR #37), migration 173 |
| Transfer Day and Sign Now | `9f9f1b81` (PR #38), migration 174 |
| Expansion draft | `01d1b543` (PR #39), migration 175 |
| Front page | `f2d261c8`, `f1d4e8c1`, `5e8d2bb1`, `e2e832f8`, `a4645808`, `8e17794d`, `612ef33f`, `4750260b`, `b26aa9cc`, `4bbc6694`, `007aa081` (PR #31) |
| Futbolpedia sees unowned free agents | `4f329915` (PR #24) |
| FPL known names | `914859bf` |
| Page titles, shared stats metadata, error and 404 pages | `8326d66f` |
| Matchup chips and breakdown | `e2bf5867` (PR #30) |
| Form guide order | `b13256cd` |
| Alerts banner on other devices | `22222857` |

## Left Out on Purpose

| Change | Why it's not in the post |
|---|---|
| Leave/delete refused after the draft (`98fbfc67`, PR #32) | Replaced a week later by the Caretaker handoff, which the post describes. |
| Sofia Sans Semi Condensed labels (`9112597c`, PR #29) | A typeface swap; nothing to learn. |
| Page performance (`c021bf78`, `118ff1cd`, `38901fec`, `5d2a4254`, `0db4266e`, `f6efff37`) | No measurement to back a "faster" claim. |
| Pagination fixes (`337b3102`) | Internal correctness; no reported symptom. |
| Auction trigger guard (`56797fa5`, migration 158) | Internal; no visible change. |
| Daily projection sync (`d321ad57`) | Keeps an existing feature fed; nothing new to see. |
| Enciso's position (`914859bf`) | One player. |
| Copy sweep (`f387cdea`) | Wording only. |
| Agent docs, test setup, typecheck script (`781540ed`, `0c8145a8`) | Internal. |
| Scoring V3 | Not shipped. GW6 was scored on V2. |
| Targets | Deferred again. |

---

# Part 4: Publishing

## Order

1. **Merge `release/2026-10-09` into `main` and confirm the production deploy.**
   The post describes the Gameweeks and Matchup pages and the front page, and
   neither is live until the release branch merges. The branch's upstream is set
   to `origin/main`, so push it under its own name (`git push -u origin
   release/2026-10-09`) and open a PR rather than pushing it as `main`.
2. **Check the post as it will be stored:**

   ```bash
   node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scratch/publish_update_2026_10_13.ts --dry-run
   ```

3. **Publish and send the pop-up** to every account (69 as of 2026-10-13):

   ```bash
   node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scratch/publish_update_2026_10_13.ts
   ```

   The script reads the body from this file and stops if the slug, title,
   summary, or highlights here differ from its own copy. Running it twice is
   safe: the entry updates in place, and nobody gets a second pop-up.

## Before You Publish

1. **Academy age rule: confirmed by Duke on 2026-10-19.** The user guide (§12)
   now says it: 21 or younger on 1 August, judged once a season. Six database
   functions still use a player's age today (auction settlement, trades,
   arrivals, loan recalls, held activation, returning loanees). Migration 176
   brings them in line, and it should be applied before the post goes out.
2. **Signed-in pages haven't been opened in a browser.** The Gameweeks and
   Matchup pages were checked through their loaders on a temporary public
   route. Caretaker settings, the inactivity warning, the redraft UI, Transfer
   Day, and the expansion draft pages were each tested in rolled-back
   transactions, not on screen.
3. **Redeploy Futbolpedia after updating its rules snapshot.** Its last snapshot
   is `2026-09-15`, so it doesn't know about Caretaker clubs, redraft leagues,
   Transfer Day, expansion drafts, or the academy date. A manager who asks it
   about any of these will get an out-of-date answer.
4. **No screenshots yet.** The Gameweeks page, the matchup pitch, and the player
   card are the obvious three.
