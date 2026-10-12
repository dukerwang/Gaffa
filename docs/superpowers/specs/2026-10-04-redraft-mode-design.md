# Redraft Mode — Design

**Date:** 2026-10-04
**Status:** Approved in conversation, not built.
**Scope:** A redraft league format: a fresh squad every season, a simple in-season budget, and a weekly Transfer Day in place of rolling auctions.

---

## Why redraft exists

Redraft is the most popular fantasy format, and it's what a newcomer from FPL, ESPN or Yahoo expects. Gaffa isn't public yet, but when it opens, redraft is the casual-friendly front door. Dynasty stays the format Gaffa is built around. Redraft keeps the parts of Gaffa a newcomer feels immediately (the scoring, the positions, open bidding, cups) and drops the systems whose payoff only shows across seasons.

Today the Dynasty/Redraft toggle on league creation sets `leagues.is_dynasty`, but the flag changes only the recommended squad size (two fewer for redraft) and a label on the join preview. A redraft league currently plays exactly like a dynasty league.

## Decisions

| Decision | Choice |
|---|---|
| Draft | Snake draft at the start of every season |
| Draft order | Randomized automatically each season; the commissioner can still set or reshuffle it before the draft |
| Squad size | Unchanged from the current recommendation: 18 for a standard 10-team league, set by the commissioner |
| In-season acquisition | Seasonal budget with open bidding, settled weekly on Transfer Day |
| Budget | €100m each season, €1m minimum bid, reset at the offseason reset |
| Severance | None |

### Features in a redraft league

| Feature | Redraft | Reason |
|---|---|---|
| Lineups, scoring, auto-subs, formations | On | The core game. |
| Weekly matchups and the draw band | On | |
| Cups | On | One of Gaffa's pillars, and they need no explaining. |
| Trades, including budget in trades | On | Every mainstream platform has trades. |
| IR | On | Standard on mainstream platforms. Casual managers expect a place to park injured players. |
| Held players | On | Rare with drop-and-add, but still the safe fallback when a squad is full. |
| Severance | Off | Dropping is routine in redraft. A fee punishes the main thing casual managers do. |
| Listings and release clauses | Off | Money is secondary in redraft (see Evidence), so selling players for it adds a mechanic with little payoff. Trades cover moving players between clubs. |
| Match Revenue, prizes, Scout's Fee, solidarity | Off | No measurable effect on outcomes in the simulation, and prize money is meaningless when the balance resets. |
| Academy, loans, Club Facilities | Off | All are bets on future seasons. |
| Retained list | Off | A player who leaves the Premier League is removed from his squad. The place is freed, with no compensation and no decision to make. |

## Transfer Day

Transfer Day replaces rolling 72-hour auctions in redraft leagues. It works like a waiver wire with open bids.

1. **Bidding window.** Opens when the previous gameweek's last match kicks off. Managers bid openly on any free agent. A bid must beat the current high bid, and a manager with a full squad names a player to drop as part of the bid, as in dynasty today. A manager can lead on several players at once, under the same balance and squad-room checks that dynasty bids use.
2. **Settlement.** Every lot settles together 24 hours before the gameweek's first kickoff. The highest bidder with room wins at the price they bid, under the existing rule: if the top bidder has no room, the next bidder with room wins, and only if nobody who bid has room does the top bidder win and the player is held.
3. **Instant pickups.** After settlement, any free agent can be signed instantly for nothing until his own club kicks off. A player dropped during this window can't be signed until the next Transfer Day, so a manager can't drop a player to hand him to a friend.
4. **Locks.** Per-player kickoff locks and the formation lock work exactly as they do now.

Settlement order: lots settle from the highest price down, so the top-bid player resolves first when one manager leads on more than one player.

## Season lifecycle

**First season.** As today: create the league, managers join, the commissioner starts or schedules the draft, the schedule is generated.

**Reset.** The existing commissioner-triggered reset runs with these differences for a redraft league:

1. The season is archived to Heritage as now: standings, matchups, cup winners and player season stats.
2. Prizes aren't paid.
3. Every squad is cleared. Rostered, IR and held players all return to the pool.
4. Every club's budget resets to the league's budget.
5. The league returns to its pre-draft state, with a new draft order randomized automatically. The commissioner schedules the draft as they did in the first season, and can change the order before it starts.
6. When the draft finishes, the new season's schedule and cup brackets are generated.

Club names, crests, abbreviations and league membership carry over. Nothing that affects competition carries over.

## What the code needs

- **Feature gating.** Every Off feature needs a server-side check, not only hidden UI: the listings and release-clause routes, loan routes, academy moves, `purchase_facility_upgrade_rpc`, severance in `src/lib/roster/executeDrop.ts`, departure handling and the retained list in `src/lib/transfers/compensation.ts`, Match Revenue in `src/lib/economy/meritPayments.ts`, prizes in `src/lib/offseason/prizeDistribution.ts`, and the solidarity and scout payouts in `src/lib/economy/solidarity.ts`. A single helper (for example `leagueFeatures(league)`) keeps the checks consistent. The UI hides what the helper turns off.
- **Departures.** In a redraft league a player who leaves the Premier League is removed from his squad with no decision. That replaces the Release/Retain flow, which must not open for redraft leagues.
- **Drafts per season.** `draft_picks` is unique on `(league_id, round, pick)`. It needs a `season` column, included in that key, before a league can draft twice. `draft_queues`, the draft room, auto-pick (including the SQL `auto_pick_expired_drafts()`), and `src/lib/draft/loadDraftPool.ts` all need to read the current season's picks only.
- **Transfer Day.** A new settlement mode for free-agent auctions in redraft leagues: no per-lot timer; settlement runs at a computed time per gameweek. It needs a scheduled job that is actually scheduled (see the note in CLAUDE.md that adding a cron route doesn't schedule it) and an instant-pickup path that bypasses auctions after settlement. Release the dropped player into a "can't sign until next Transfer Day" state.
- **Floor.** Redraft uses a flat €1m minimum, so `free_agent_bid_floor` doesn't apply.
- **Reset.** `runSeasonReset` in `src/lib/offseason/seasonReset.ts` gains the redraft path above.
- **Docs.** `docs/USER_GUIDE.md` gets a redraft section. CLAUDE.md's domain rule "The draft happens exactly once per league" becomes "exactly once per dynasty league." Every redraft difference needs its "why" in the guide, as the dynasty rules have.

## Evidence

The budget design rests on a simulation of redraft seasons played on 2025-26's real Gaffa points. The scripts, method and full results are in `scratch/redraft-economy-sim/`.

In a snake-draft redraft league, free-agent money barely decides anything. Giving one team 20% more budget had no measurable effect, and doubling it gained 9 to 18 points over a season in which teams score about 4,150 and differ by about 285. Draft strength correlates 0.85 with final points. About two-thirds of auctions had a single bidder and closed at the minimum bid, and only 7 to 10 undrafted players a season become real starters.

That's a property of redraft, not something tuning fixes. The budget size only changes price labels, and Match Revenue, catch-up income and a January top-up changed nothing measurable. The floor decides how much gets spent, not who wins. A floor tied to Transfermarkt value made prices track market value instead of points (price-to-points correlation 0.15 against 0.41 with a flat floor), which confirms it's the wrong anchor for redraft.

So redraft money works the way mainstream FAAB does: a fair way to settle contested pickups, not a strategic resource. That's the right weight for a casual format. The simple design costs nothing in balance.

The model groups positions into four buckets rather than Gaffa's 12 exact positions, so it understates how much depth matters. That supports keeping the 18-man default rather than the 15-man squad FPL players know.

## Open questions

- **Congested weeks.** When a gameweek starts less than 48 hours after the previous one's last kickoff, settling 24 hours before the first kickoff leaves a short bidding window. A fallback is to settle at the midpoint between the previous gameweek's last kickoff and the next one's first.
- **Trade deadline.** Mainstream redraft leagues stop trades late in the season to stop teams out of contention giving players away. Gaffa has no deadline today.
- **Switching format.** Whether an existing league can change between dynasty and redraft. Not needed for launch.

## Out of scope

- **Auction draft.** Every club builds its squad by bidding from its budget. It gives money real weight and fits Gaffa's open auctions, but it's harder for newcomers and a live one runs about three hours for 180 lots. A slow version on the existing auction engine is a candidate for a later league option.
- **Keeper leagues.** Redraft with a few players kept each season. To be explored separately; the usual escalating keeper cost resembles a contract, so a Gaffa version needs a one-time cost.
- **New Game+.** A one-off redraft of an existing dynasty league. Set aside for now.
