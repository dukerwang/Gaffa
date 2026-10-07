# Expansion Draft and Club Takeovers — Design

**Date:** 2026-10-04
**Status:** Approved in conversation, not built.
**Scope:** How a new manager joins a dynasty league after its draft: taking over a club whose manager has left, at any time, or adding a new club through an expansion draft in the offseason.

---

## Why

A dynasty league drafts once and runs indefinitely, so the managers it starts with won't be the managers it has in five years. Today nobody can join after the draft: `/api/leagues/join` refuses any league whose status is `active`. And a manager who leaves takes their club with them: `/api/leagues/[leagueId]/leave` hard-deletes the club (and a commissioner leaving deletes the whole league), with no check on whether the season has started.

Redraft leagues don't need either mechanism. A new manager joins between seasons, before the draft.

## Decisions

| Decision | Choice |
|---|---|
| How a new manager joins mid-season | Takes over a club run by the Caretaker |
| How a club becomes a Caretaker club | Its manager leaves, or the commissioner removes them |
| Inactivity | The commissioner is alerted after 6 gameweeks without any activity; nothing happens automatically |
| When a league can expand | Offseason only, between the reset and the new season's first gameweek |
| Protection | Each existing club protects 8 players |
| Exempt from the expansion draft | Academy players, players loaned out, retained rights |
| How much the new club takes | Up to 2 players from each existing club, optional per club |
| New club's money | The league's median Club Balance at the time of expansion |
| Compensation to clubs that lose a player | None |

## Club takeovers

### The Caretaker

A club whose manager has gone is run by the **Caretaker** until a new manager arrives. The Caretaker only makes decisions nobody can exploit.

**It does:**
- Set the best available lineup each gameweek.
- Move injured players to IR and back.
- Activate held players when there's room.
- Take the default on any decision with a deadline, such as the automatic release when a departure decision lapses.

**It never:** bids, lists, sells, trades, loans or spends. Other managers can't propose trades or loans to a Caretaker club, and its Club Balance is frozen. A club with no human in charge can't be talked into a bad trade.

The club keeps playing every matchup and cup tie, so the schedule, standings and brackets never change.

### Becoming a Caretaker club

- **The manager leaves.** In a league that has drafted, leaving hands the club to the Caretaker instead of deleting it.
- **The commissioner removes a manager.** Same result.

A commissioner who leaves a started league hands the commissioner role on before leaving, or the league can't continue. Who receives it (the longest-serving manager, or the commissioner's choice) is an open question.

### Inactivity alert

The alert must never flag a manager who is still around. The app doesn't record that today: the only presence field, `teams.last_seen_at`, is the draft room's heartbeat and is cleared when a manager leaves the room. Supabase's sign-in time changes only on a fresh login, so a manager who stays signed in for months would look absent.

1. **Record activity.** Add a `last_active_at` per manager per league. Update it when the manager loads any page of that league, from any device, at most once an hour. Update it on every action too: saving a lineup, bidding, an offer or trade, a chat message, any squad move.
2. **Count gameweeks, not days.** A manager is inactive only after 6 full gameweeks with no recorded activity. An international break never counts toward it.
3. **Warn the manager first.** After 5 gameweeks they get an email saying their club will be flagged to the commissioner after one more. Opening the app resets the count.
4. **Alert the commissioner at 6.** The commissioner gets a notice and decides whether to remove the manager. Nothing happens to the club automatically.

The only manager who can reach the commissioner while still "around" is one who reads Gaffa's emails but never opens the app. They've had a direct warning, and the outcome is only a notice to someone who knows them.

### Joining a Caretaker club

A new manager can join any time, in or out of season. They take the club as it stands: squad, Club Balance, record, league position and cup ties. They can rename it and redesign its crest. Heritage keeps the club's history under the names it had at the time.

A league with a Caretaker club fills that club before it considers expansion.

## Expansion draft

### Process

1. **Opening.** In the offseason, after the reset and before the new season's first gameweek, the commissioner opens expansion and invites the new manager or managers. The reset generates the new season's schedule and cup brackets immediately today, so finishing expansion regenerates both.
2. **Protection.** Each existing club protects 8 players before a deadline. A club that misses the deadline has its 8 most valuable players protected automatically, by the app's own player values.
3. **Exemptions.** Academy players, players loaned out and retained rights can't be taken. Players on IR and held players aren't exempt; protecting one uses one of the 8.
4. **Picks.** In a draft room, the new club takes up to 2 players from each existing club, and may pass on a club entirely. It then fills the rest of its squad from free agents in the same room. With more than one new club, they alternate picks, and no existing club loses more than 2 players in total.
5. **Money.** The new club starts with the league's median Club Balance. Players taken in the expansion draft cost nothing, and the clubs that lose them get no compensation.
6. **Summer.** The new club joins the summer's auctions for new Premier League arrivals like any other club, which is where it closes the rest of the gap to the median.

Every club keeps at least 20 of its 22 players, plus its whole academy and anyone out on loan. The 8 protected players only decide which 2 it can lose.

### Why these numbers

The analysis is in `scratch/expansion-sim/`. It tests each rule set on the two real alpha leagues and on simulated established leagues of 6 to 12 clubs, measuring the new club's strength (best XI plus bench cover, on blended projections and last season's points) against the league median, and what each existing club loses.

**League size decides most of it.** The alpha leagues have 6 clubs with 22-man squads, which leaves enough good free agents that a new club built only from them lands 2–3% below the median. In a 10-club league the same approach leaves it 41% below; in a 12-club league, 52% below.

**Protection rarely hurts existing clubs.** Everything worth protecting sits in a club's top 8 to 11. Taking up to 2 players with 8 protected costs an existing club about 1.2–1.7% of its strength on average and 3–3.4% at most, in leagues of 8 to 12 clubs.

**Each extra protected player costs the new club far more than it saves the existing ones.** In 8- to 12-club leagues:

| Protect | New club vs median | Existing clubs' loss (average / most) |
|---|---|---|
| 8 | 10–12% below | 1.2–1.7% / 2.8–3.4% |
| 10 | 14–18% below | 0.5–1.0% / 1.2–2.3% |
| 12 | 22–25% below | 0.2–0.5% / 0.4–1.7% |

A third pick per club adds almost nothing, because after a club's best 8 what's left is depth.

**Fees don't work.** Charging the new club 60% of market value for the players it takes would cost about €380m in a 10-club league and €470m in a 12-club league, around double a typical club's balance. The new club would arrive broke or need a grant large enough to inflate the economy. Taking players free costs each existing club about 2% of its strength, and the only new money is one club's median balance, the same as every club received when the league began.

**Median, not a fixed amount.** The new club's money matters only against what its rivals hold at the summer auctions. A fixed amount drifts from that as a league ages; the median tracks it, and one club with a huge balance doesn't skew it the way an average would. The alpha leagues' medians are €210m and €249m against a €250m start.

**Caveats.** The simulated leagues draft efficiently, which is the harsh case for the new club. The real alpha squads, built months ago by people, are looser, so a real league sits between the two. Positions are grouped into four buckets rather than Gaffa's 12, and player value is a blend of projections and last season's points, not a forecast.

## What the code needs

- **Leave and remove.** `/api/leagues/[leagueId]/leave` hands the club to the Caretaker in any league that has drafted, instead of deleting it. A commissioner removal action does the same.
- **Caretaker state.** A club needs to be marked as Caretaker-run (for example a nullable `teams.user_id` plus a status), and every manager-facing route needs a check: trades, loans, offers and listings refuse a Caretaker club as either party; bids are impossible because nobody can place them.
- **Caretaker jobs.** Lineups through the existing carry-forward and `fill-matchup-lineups` path (which isn't in `vercel.json` today, so it needs scheduling), IR moves, activating held players, and default decisions at deadlines.
- **Join.** `/api/leagues/join` accepts a started league when it has a Caretaker club, and assigns the joining manager to it. During an open expansion window, it creates an expansion club instead.
- **Activity tracking.** `last_active_at` per league member, a throttled update on league page loads and on actions, the 5-gameweek warning email, and the 6-gameweek commissioner notice.
- **Expansion.** Protection lists with a deadline and automatic fallback, an expansion draft room (the existing draft room and its auto-pick engine are the starting point), the median-balance grant, and schedule and bracket regeneration when it finishes.
- **Docs.** `docs/USER_GUIDE.md` gets sections on takeovers and expansion, with the reasoning, as the other rules have. CLAUDE.md's domain rules gain the Caretaker and the expansion exemptions.

## Open questions

- **A commissioner leaving.** Who inherits the role in a started league.
- **Several new clubs at once.** The order they pick in, and whether the 2-per-club cap is tight enough when three or more join together.
- **Squad sizes other than 22.** Whether the protection count scales with squad size (8 is about a third of 22).

## Future work

- **Intelligent CPU clubs.** A Caretaker that bids, sells and accepts fair trades the way a real manager would. It needs its own valuation of trades and auctions, which the draft auto-pick engine and the player projections could seed. Until then the Caretaker stays deliberately passive, so nobody can exploit it.
