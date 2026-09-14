# Held Players

Status: approved design, not yet built. Decided with Duke on 2026-09-13; every rule below marked **[decided]** was chosen by him in that session. Anything marked **[inferred]** is a default proposed in the session and accepted as part of a section, not argued individually.

## Problem

A squad can receive a player it didn't choose to take on at a moment it has no room: a loan between managers ending, a loanee coming back from abroad (added 2026-09-12, migration 160), a retained player returning to the Premier League. Today each source handles this differently:

- Loans between managers park the player as a `loan_out` row with the loan in `pending_activation`, and `executeDrop.ts` activates him automatically on the lender's next drop. No deadline.
- A loanee back from abroad joins the squad immediately and can push it over the limit (`return_from_loan_rpc`, migration 160).
- A retained player gets a 48-hour Reinstate window (`RETURN_WINDOW_HOURS`), then goes to auction.

Auction settlement has a related gap: when the top bidder has no room at the clock, they're skipped and the next bidder wins, even if they had room when they bid.

There is also existing drift. `resolve_single_player_auction_rpc` (migration 152) counts loaned-in players toward the limit and ignores buyback slots, while `src/lib/roster/capacity.ts` and the bid route do the opposite, so a bid that passes placement can be skipped at settlement as "no room".

## Rules

### Arrivals

1. **[decided]** When an arrival finds no room, the player is held: he's yours, off the squad, and doesn't count toward the roster limit. The squad never goes over the limit through an arrival.
2. **[decided]** Holding applies only when there's no room. Any arrival that finds room joins directly, with no Activate step. An auction win goes to reserves, or the academy if the bid asked for it, unchanged from today. A returning player goes to the academy if he left from it and still qualifies, otherwise reserves. (Duke: "if i'm at 15/20 players and i win an auction they should automatically join my reserves, or my academy if i specified that.") "Reserves" is roster status `bench`, not assigned to a lineup slot; wherever this spec says bench, it means reserves.
3. Sources that can produce a hold:
   - A loan between managers ending, at expiry or on recall.
   - A loanee back from abroad (`on_loan` departure decision).
   - **[decided]** A retained player returning to the Premier League. The 48-hour Reinstate window is removed. He joins if there's room and is held if not.
   - **[decided]** An auction win where room ran out between placing the bid and settlement (see Auctions).
4. **[decided]** A returning retained player keeps a free **Decline**, which sends him to auction. The holder already forfeited compensation for him, and the claim can be years old.

### Activation

5. **[decided]** Held players join only when the manager activates them. There is no automatic activation, including on a drop. (Duke: "a bit like sleeper, where it tells you, you're 2 players over the limit or something, and then after you free some space you can move players in manually.")
6. **[inferred]** Activate works whenever the target has room or eligibility, mid-gameweek included. Targets: bench (needs room), academy (U21 and a free place), IR (injured and a free place; the existing rule that blocks bidding with a healthy player on IR still applies). Once activated, he follows the normal lock for his own club.

### The freeze

7. **[decided]** While a team has at least one held player, moves that add to the squad are blocked:
   - Placing auction bids.
   - Trades and loans that bring in more players than they send out, including loan recalls.
   - Moving a player from the academy or IR back into the squad. (Activating a held player into the academy or IR is not blocked: it's how a hold gets resolved, rule 6.)
8. **[open: Duke is still thinking this over]** Still allowed: drops, sale listings, trades that bring in the same number of players or fewer, moving players to IR or the academy, loaning players out, and lineup changes until the lock.
9. **[decided, loophole]** A held player can't be loaned out or listed for loan. Without this rule, loaning him to a friend and back gives a permanent extra player beyond the limit.
10. **[inferred]** Several held players: the freeze lasts until the last one is resolved.

### The lineup lock

11. **[decided]** Additions freeze as soon as a player is held. If a player is still held when the first match of the next gameweek kicks off, the team's lineup also locks until nobody is held. "Next gameweek" means the first gameweek whose earliest kickoff is after `held_at`, so a hold that starts mid-gameweek doesn't lock the current week.
12. **[decided, loophole]** This includes gameweek 1 after the summer, so a player can't be stored across the offseason for free.
13. **[decided]** While locked, the last saved lineup carries forward each gameweek, and the manager is told their lineup was set for them. The lock is itself the prompt to fix the roster. Auto-subs still run.
    - A locked lineup can still break. The manager can drop, trade away, or move a starter to IR or the academy; a starter can leave the Premier League; a borrowed player's loan can end; a position change can make a starter ineligible for his slot. When that happens, keep every valid pick and fill only the empty slots with the best eligible player.
    - Today's `carryForward.ts` regenerates the whole lineup when any pick is invalid. During a lock that could give the manager a better XI than their own, so the lock path must fill gaps instead of using that fallback.

### Dropping and trading a held player

14. **[decided]** Dropping a held player costs normal severance (20%, minimum €2m) and sends him to auction. The only exception is a returning retained player's Decline, which stays free.
15. **[inferred]** A held player can be traded away. The receiving team needs room under the normal trade check, and he arrives on their bench. Held players don't count toward the 15-player trade floor (`MIN_ACTIVE_ROSTER`), the same as IR and the academy.

### Auctions

16. **[decided]** Placing a bid doesn't change: a full squad still names a drop player or qualifies for the academy route.
17. **[decided]** At settlement, bids are still walked highest first:
    - A bidder who can't afford bid plus severance is skipped (unchanged).
    - **[inferred]** A bidder whose team is already holding a player is skipped with reason `players_held`, and the next highest bidder is considered. This is the freeze applied at the clock: a holding team can't sign anyone, including through a bid placed before the hold began. Example: a loan return is held on your team on Tuesday; your bid on an auction ending Wednesday is ignored unless you activate or drop the held player first.
    - Otherwise the top remaining bidder wins. The player goes to the bench if there's room, through the nominated drop if that player is still on the roster, to the academy if requested or as the fallback, and otherwise **he's held** with `held_source = 'auction'`.
18. Because a held auction win skips that team's other live bids, a team can hold at most one player from auctions at a time.
19. **[inferred]** Live bids from a team that becomes holding are skipped at settlement. The hold notification lists them.
20. Settlement uses the shared room calculation (see Build), which fixes the drift described above.

### Offseason and Kickoff

21. **[inferred]** The freeze applies in the offseason. Season Kickoff (the commissioner action that opens a new season) runs preflight checks, some of which stop it entirely. A team holding a player is not one of those: the commissioner sees a warning naming the team and can still start the season.

### Loopholes checked

- Buying an extra player and flipping him: blocked by the bid freeze.
- Loaning a held player out and back: blocked by rule 9.
- Storing a held player as injury cover: allowed within the grace window, and costs the lineup from the next kickoff.
- One-for-one trades while holding: allowed. The squad count doesn't change and the held player stays out.
- Declining a retained return, then bidding on his auction: nothing is held after declining. The full squad still needs a drop nomination to bid.
- A cheaper exit through the hold: none, severance matches a squad drop.
- A held player scoring: excluded from lineups, auto-subs and the bench depth bonus.
- Summer storage: covered by rule 12.

### Out of scope

A commissioner lowering `leagues.roster_size` can leave a squad over the limit with nobody held. That remains today's "Over the cap" state in `PitchUI.tsx`.

## Build

### Data

- New migration adding `held` to `roster_status`. It's applied and committed before any migration that uses the value (the same split as 159 and 160).
- `roster_entries.held_at TIMESTAMPTZ` and `roster_entries.held_source TEXT` (`loan_return`, `loan_abroad_return`, `retained_return`, `auction`).
- **[decided]** Held players are a roster status, not a separate table. Ownership checks already read `roster_entries`, so a held player can't be mistaken for a free agent. A missed count filter fails safe by refusing a move. A missed lineup filter is caught by tests.
- Remove the TypeScript-only `'pending_activation'` from `RosterStatus` in `src/types/index.ts`. It doesn't exist in the database enum.

### Room calculation

- `capacity.ts`: add `held` to `UNCOUNTED_ROSTER_STATUSES` and a `held` count to `RosterCapacity`.
- SQL helpers mirroring it: `team_active_count(team_id)` excludes `ir`, `taxi`, `loan_in` and `held`, and `team_roster_limit(team_id)` returns `roster_size` plus active buyback slots. Used by auction settlement, the trade function, placement and activation.

### Placement

`place_arrival_rpc(team_id, player_id, origin_status, source)` returns the resulting status: `taxi`, `bench` or `held`. It replaces:

- `place_returning_loanee` (migration 138), and the `pending_activation` branches of loan expiry and recall.
- The placement inside `return_from_loan_rpc` (migration 160).
- `reinstate_departure_rpc` and `openReturnWindows` / `expireReturnWindows` in `src/lib/departures/resolve.ts`. A returning retained player's decision stays `return_pending` while he's held, becomes `returned` on activation, and becomes `lapsed` on Decline.

Remove the pending-loan activation block from `src/lib/roster/executeDrop.ts`.

### Activation

`activate_held_rpc(entry_id, target)`, where the target is `bench`, `taxi` or `ir`. It checks room or eligibility under lock, clears `held_at` and `held_source`, and resolves any linked `return_pending` decision.

### Freeze enforcement

A TypeScript guard (`assertNotHolding`) in the routes, plus the same check inside every database function that adds a player:

| Where | Check |
|---|---|
| `auctions/bid/route.ts` | refuse bid |
| `resolve_single_player_auction_rpc` | skip holding bidder (`players_held`); hold a winner with no room |
| `trades/route.ts`, `trades/[tradeId]/route.ts`, `execute_trade_transaction_rpc` | refuse when a holding team receives more players than it sends |
| `loans/route.ts`, `loans/[loanId]/route.ts`, recall route | refuse loan-in or recall for a holding team; refuse loaning out a held player |
| `listings/route.ts` | refuse a loan listing on a held player |
| `teams/[teamId]/taxi/route.ts`, `teams/[teamId]/ir/route.ts` | refuse promotion or IR activation for a holding team |

### Lineup lock

- SQL helper `held_lineup_locked(team_id)`: true when a `held` entry exists and some gameweek of the current season has its earliest `pl_fixtures.kickoff_time` after `held_at` and at or before now.
- `teams/[teamId]/lineup/route.ts` refuses saves while it's true. That route also resets unassigned entries to `bench`, so it has to skip `held` (and must never write `held` entries into a lineup).
- Exclude `held` from `generateValidLineup.ts`, `fill-matchup-lineups`, `set-bot-lineups` and `matchupProcessor.ts`.
- For a locked team, `carryForward.ts` copies the last saved lineup and fills only the invalid slots (rule 13), instead of regenerating the whole XI. `smartLock.ts` already maps players into slots and may be reusable for the fill. The carry-forward writes a notice to the manager that their lineup was set for them.

### Status filter sweep

Every file that filters roster statuses gets checked for `held`. The current list comes from `grep -rnE "'(ir|taxi|loan_in|loan_out)'" src supabase/migrations`, about 40 files. Counting filters must exclude `held`, and lineup, auto-sub and scoring paths must exclude it too.

### Existing records

A one-time data migration:

- Loans in `pending_activation`: the lender's `loan_out` row becomes `held` with `held_source = 'loan_return'`, and the loan moves to `expired` or `recalled` according to `recall_activated`.
- Departure decisions in `return_pending`: insert a `held` row for the holder with `held_source = 'retained_return'`, and clear `reinstate_by`.

Check how many records exist in each state before writing the migration.

### Release sequencing with the Scout's Fee change

`feat/scout-fee-both-ways` changes who receives the Scout's Fee inside `resolve_single_player_auction_rpc`, the same function this spec rewrites. Its migration (`_pending_scout_fee_win_or_lose.sql`) is deliberately unnumbered and unapplied, and edits two lines of whatever version is live. Duke has decided the two ship in one update. Apply the held migrations first, then number and apply the Scout's Fee migration after them; applying it first would let the held rewrite quietly restore the old fee rule. Before numbering either, check the highest migration number across every branch, as `CLAUDE.md` describes.

## Manager-facing

Read `DESIGN.md` and `docs/UI_RULES.md` before building, and use the `gaffa-ui-copy` skill for every string.

- **Notification "Player Held":** the player, why he's held, what's frozen, the exact kickoff when the lineup locks, and the live bids that will be skipped unless the manager activates or drops before those auctions end.
- **Roster page:** a Held group with Activate (only the targets he qualifies for) and Drop. A club to-do item counting down to the lineup lock. In the Retained List, Reinstate becomes Activate and Decline stays.
- **Pitch page:** before the lock, "1 player held. Activate or drop him before {kickoff}, or your lineup locks." After it, the page says the lineup was set for the manager and stays locked until the held player is activated or dropped.
- **Blocked controls:** the bid dialog, offer builder, loan modals, and academy and IR controls are disabled with the reason "Activate or drop your held player first."

## Docs

- `docs/USER_GUIDE.md`: §2 (Held as a squad status, the freeze, the lineup lock), the auction settlement rule, §10 (loan returns), §13 (retained returns without the 48-hour window; update "Players who leave on loan" from "over the limit" to "held"), and the glossary.
- `docs/DECISIONS.md`: a dated entry recording the decisions above in Duke's words.
- `CLAUDE.md`: a domain rule for the freeze and the lineup lock.
- `README.md`: the sentence on loan returns.

## Testing

- Vitest: `deriveRosterCapacity` with held entries; the lineup lock boundary (a hold mid-gameweek doesn't lock the current week; a hold before the next first kickoff does); the route guards.
- Database functions, run in a transaction that is rolled back on a test league, as done for migration 160: placement (academy, bench, held), activation into each target, a settlement that holds the winner, a settlement that skips a holding bidder, the trade count check, loan-out refusal, `held_lineup_locked`, and the existing-records migration.
- `npm run build` and the full Vitest suite before handing over.
