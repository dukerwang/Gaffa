# Held players implementation plan

> **For agentic workers:** Implement task by task, in order. Checkboxes track progress. The spec is the source of truth; if this plan and the spec disagree, the spec wins, and you fix the plan.

**Goal:** When a player arrives at a squad with no room, hold him off the squad instead of pushing the squad over the limit, freeze additions until he's activated or dropped, and lock the lineup if he's still held at the next gameweek's first kickoff.

**Source of truth:** `docs/superpowers/specs/2026-09-13-held-players-design.md`. Rule numbers below (R1–R21) refer to it.

**Branch:** `feat/loaned-abroad`, worktree `.claude/worktrees/loaned-abroad`. The loaned-abroad work (migrations 159–160) is already on this branch and live in the database.

**Tech stack:** Next.js App Router route handlers, Postgres RPCs applied through the Supabase MCP against project Gaffa (`hnkavimrsbytsesdzwvj`), Vitest, CSS Modules.

## Global constraints

- Edit only inside the worktree. Commit to the branch after every task.
- Before building in the worktree: `cp -cR "/Users/dukewang/Fantasy Futbol/node_modules" node_modules`, and symlink `.env.local`.
- Migration numbers: the highest in use across all branches is **160** (checked 2026-09-13 with `git log --all --name-only --format= -- supabase/migrations`). Re-check before creating each file. This plan uses 161–164.
- Postgres can't use an enum value in the transaction that adds it. `held` gets its own migration, applied before anything references it.
- Any `RETURNS TABLE` function whose output columns share names with table columns starts with `#variable_conflict use_column` (the migration 121 bug).
- When a migration rewrites a large live function, first confirm the live `prosrc` md5 matches the repo file it came from, then confirm again afterwards that the live body matches the new file. That's how 160 was applied.
- **Scout's Fee sequencing.** `feat/scout-fee-both-ways` has an unnumbered migration that edits two lines of `resolve_single_player_auction_rpc` in place. Task 7 must leave those two lines textually unchanged, and the held migrations must be applied before that one. Read `supabase/migrations/_pending_scout_fee_win_or_lose.sql` on that branch before Task 7.
- Live data as of 2026-09-13: 0 loans in `pending_activation`, 0 decisions in `return_pending`, 0 in `on_loan`. The existing-records conversion is a guarded no-op, not a data rewrite. Re-check before applying.
- The alpha leagues (Matchday Militia, Dynasty Dragoon) are live. Never change a settled result.
- UI: read `DESIGN.md` and `docs/UI_RULES.md` before Task 12, and use the `gaffa-ui-copy` skill for every string. User-facing copy never says "FAAB".
- `npm run build` and `npm test` pass before hand-off. Don't verify in the browser unless Duke asks.

## File structure

| Path | Action |
|---|---|
| `supabase/migrations/161_held_roster_status.sql` | Create: `held` enum value |
| `supabase/migrations/162_held_players_core.sql` | Create: columns, room helpers, placement, activation, bid withdrawal, lineup-lock helper |
| `supabase/migrations/163_held_players_loans_departures.sql` | Create: loan expiry and recall, `return_from_loan_rpc`, retained return, trade RPC |
| `supabase/migrations/164_held_players_auction_settlement.sql` | Create: two-pass settlement |
| `src/lib/roster/capacity.ts` | Modify: `held` uncounted, `held` count |
| `src/lib/roster/holds.ts` | Create: `getHoldState`, `assertNotHolding`, activation window check |
| `src/lib/roster/__tests__/holds.test.ts` | Create |
| `src/types/index.ts` | Modify: `RosterStatus` gains `held`, loses the phantom `pending_activation` |
| `src/app/api/teams/[teamId]/held/[entryId]/route.ts` | Create: Activate (POST) |
| `src/lib/lineups/carryForward.ts` | Modify: gap-fill for locked teams |
| `src/lib/lineups/__tests__/carryForward.test.ts` | Create or extend |
| Status-filter files (Task 4 list) | Modify |
| Freeze call sites (Task 8 table) | Modify |
| `src/lib/departures/resolve.ts`, `decisions.ts`, `types.ts`, departures routes | Modify |
| `src/lib/roster/executeDrop.ts` | Modify: remove automatic loan activation |
| `src/app/api/cron/process-loans/route.ts`, recall route | Modify |
| `src/lib/offseason/kickoffPreflight.ts` | Modify: held warning |
| Roster, pitch, bid, offer and loan UI (Task 12) | Modify |
| `docs/USER_GUIDE.md`, `docs/DECISIONS.md`, `CLAUDE.md`, `README.md` | Modify |

## Task 1: `held` enum value

- [x] Re-check the highest migration number across branches.
- [x] Write `161_held_roster_status.sql`: `ALTER TYPE public.roster_status ADD VALUE IF NOT EXISTS 'held';` with a header comment pointing at the spec.
- [x] Apply with `apply_migration`. Confirm with `SELECT enumlabel FROM pg_enum ...`.
- [x] Commit.

## Task 2: Core database functions (migration 162)

All functions `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`.

- [x] Columns: `roster_entries.held_at TIMESTAMPTZ`, `roster_entries.held_source TEXT` with `CHECK (held_source IN ('loan_return','loan_abroad_return','retained_return','auction'))`, and a `CHECK` that `held_at`/`held_source` are set if and only if `status = 'held'`. Partial index on `(team_id) WHERE status = 'held'`.
- [x] `team_active_count(p_team_id)`: count of entries with status not in (`ir`,`taxi`,`loan_in`,`held`). This must match `UNCOUNTED_ROSTER_STATUSES` in Task 3; add a comment in both files naming the other.
- [x] `team_roster_limit(p_team_id)`: `COALESCE(leagues.roster_size, 20)` plus active buyback loans (`player_loans.status = 'active' AND slot_buyback_used`), mirroring `countBuybackSlots`.
- [x] `team_is_holding(p_team_id) RETURNS BOOLEAN`.
- [x] `withdraw_team_bids_for_hold(p_team_id) RETURNS JSONB`: sets that team's `waiver_claims` rows with `is_auction AND status = 'pending' AND team_id = p_team_id` to `rejected`, and returns `[{claim_id, player_id, faab_bid}]` for the notification. Before writing it, read `refresh_auction_state` (migration 078, as amended by 132 and 151) and `src/lib/auction/timer.ts` `inactivityTimeoutMs`. Confirm that rejecting the leading claim recomputes `highest_bid` from the remaining claims, and decide whether the inactivity clock should use the remaining leader's bid time. Write the answer as a comment in the function.
- [x] `place_arrival_rpc(p_team_id, p_player_id, p_origin_status roster_status, p_source TEXT) RETURNS TABLE (entry_id UUID, placed_status roster_status, withdrawn_bids JSONB)`:
  1. If `p_origin_status = 'taxi'`, the player is at or under `taxi_age_limit`, and academy places are free, place him as `taxi`.
  2. Else if `team_active_count < team_roster_limit`, place him as `bench`.
  3. Else place him as `held` with `held_at = NOW()` and `held_source = p_source`, and call `withdraw_team_bids_for_hold`.
  - Upsert on `(player_id, team_id)`, since a loan return already has a `loan_out` row to update rather than insert.
- [x] `activate_held_rpc(p_entry_id, p_target roster_status) RETURNS TABLE (...)`: lock the entry and its team. Refuse unless status is `held`. Target `bench` needs room; `taxi` needs age eligibility and a free place; `ir` needs `players.fpl_status` injured or doubtful (read how `teams/[teamId]/ir/route.ts` decides this and mirror it) and a free IR place. Clear `held_at` and `held_source`. If a `departure_decisions` row for this team and player is `return_pending`, set it to `returned`. No window check here; the route owns that (Task 9).
- [x] `held_lineup_locked(p_team_id) RETURNS BOOLEAN`: true if a `held` entry exists and some gameweek `g` of the current season has `min(kickoff_time) > held_at` and `min(kickoff_time) <= NOW()`. Read the season from `pl_fixtures` rows (the latest season with fixtures), not a hardcoded string.
- [x] Apply. Run a rolled-back `DO` block on the E2E test league (the pattern used for 160) covering placement into each of academy, reserves and held; bid withdrawal on hold; activation into each target, including refusals; and `held_lineup_locked` before and after a synthetic fixture kickoff.
- [x] Commit.

## Task 3: Capacity and types

- [x] `capacity.ts`: add `'held'` to `UNCOUNTED_ROSTER_STATUSES`; add `held: number` to `RosterCapacity` and derive it. Fix the `loan_out` comment if it's wrong. It claims the entry "moves to the borrower", but `detect.ts` and migration 074 treat `loan_out` as a row that stays on the lender. Check migration 137 and the live schema, and correct whichever comment is wrong.
- [x] `src/types/index.ts`: `RosterStatus` becomes `'active' | 'bench' | 'ir' | 'taxi' | 'loan_in' | 'loan_out' | 'held'`. Fix any compile errors from removing `'pending_activation'`. Its real use is `loan_status`, which stays.
- [x] Tests: `deriveRosterCapacity` with held entries (uncounted, counted in `held`).
- [x] `tsc --noEmit`, `npm test`. Commit.

## Task 4: Status filter sweep

Every file below filters roster statuses. For each, decide and record in the commit message which case applies: **count** (exclude `held`), **lineup or scoring** (exclude `held`), **display** (show a Held label), or **no change**.

- [x] `src/lib/lineups/generateValidLineup.ts`: exclude `held`.
- [x] `src/lib/scoring/matchupProcessor.ts`: exclude `held` from auto-subs and the bench depth bonus.
- [x] `src/app/api/teams/[teamId]/lineup/route.ts`: never place `held` in a lineup; the unassigned reset to `bench` must skip `held` (line ~308).
- [x] `src/lib/lineups/carryForward.ts` (`.not('status','in','("ir","taxi","loan_out")')`): add `held`.
- [x] `src/app/api/cron/set-bot-lineups/route.ts` and `fill-matchup-lineups`: exclude `held`.
- [x] `src/app/api/leagues/[leagueId]/auctions/bid/route.ts`: the room count uses `UNCOUNTED_ROSTER_STATUSES`.
- [x] `src/app/api/leagues/[leagueId]/trades/route.ts`, `loans/route.ts`, `loans/[loanId]/route.ts`, `loans/[loanId]/recall/route.ts`, `listings/route.ts`.
- [x] `src/app/api/teams/[teamId]/ir/route.ts`, `taxi/route.ts`, `src/app/api/admin/resolve-aged-out-academy/route.ts`.
- [x] `src/app/api/cron/process-loans/route.ts`, `src/lib/roster/executeDrop.ts`.
- [x] `src/app/api/leagues/[leagueId]/clubs/[teamId]/peek/route.ts`, `src/lib/players/cardData.ts`, `src/lib/home/buildHomeModel.ts`, `src/lib/transfers/buildTransfersModel.ts`.
- [x] `src/lib/departures/detect.ts`, `resolve.ts`: a departing held player must still be found as owned (he has a roster row).
- [x] UI: `team/PitchUI.tsx`, `team/page.tsx`, `team/roster/{ClubClient,Inspector,SquadViews,clubDerive}.tsx`, `trades/{ProposeLoanModal,RequestLoanModal,TradesClient}.tsx`, `components/transfers/{BidDialog,ListingEditor,ProposeBuilder}.tsx`. Display labels only here; blocking comes in Task 12.
- [x] Database functions that count with a literal list (`NOT IN ('ir','taxi','loan_in')`): `execute_trade_transaction_rpc` (160), `execute_loan_acceptance_rpc` and loan functions (138), `resolve_single_player_auction_rpc` (152), `reinstate_departure_rpc` (073). Tasks 5–7 switch them to `team_active_count`; list any others found with `grep -rn "NOT IN ('ir'" supabase/migrations`.
- [x] Re-run `grep -rlE "'(ir|taxi|loan_in|loan_out)'" src | grep -v __tests__` and confirm every file is accounted for. `tsc`, `npm test`. Commit.

## Task 5: Loans (migration 163, part 1)

- [x] Verify the live bodies of `resolve_expired_loan_rpc`, `execute_loan_recall_rpc` and `place_returning_loanee` match migration 138.
- [x] `resolve_expired_loan_rpc`: replace the `place_returning_loanee` call and the `pending_activation` branch with `place_arrival_rpc(lender, player, origin_status, 'loan_return')`. The loan always ends `expired`. Return `placed_status` and `withdrawn_bids` in the JSON result.
- [x] `execute_loan_recall_rpc`: refuse with `RECALL_NEEDS_ROOM` when `origin_status <> 'taxi'` (or the academy route isn't available) and `team_active_count >= team_roster_limit` for the lender (R19). Also refuse if the lender `team_is_holding`. Otherwise place with `place_arrival_rpc`; by construction it never holds.
- [ ] Drop `place_returning_loanee` in the same migration **Not done: unused now, along with `reinstate_departure_rpc`; waiting for Duke before any DROP FUNCTION.** only after confirming nothing else calls it (`grep` plus `pg_proc` dependency check). This is a `DROP FUNCTION`, so confirm with Duke first.
- [x] `process-loans/route.ts` and `recall/route.ts`: handle the new result shape; map `RECALL_NEEDS_ROOM` to a sentence-case error ("Make room in your squad before recalling him."). Send the Player Held notification when `placed_status = 'held'` (Task 11).
- [x] `executeDrop.ts`: remove the "check and activate pending return loans" block (R5).
- [x] Rolled-back DB test: expiry into academy, reserves and held; recall refused when full; recall refused while holding.
- [x] Commit.

## Task 6: Departures (migration 163, part 2)

- [x] `return_from_loan_rpc` (160): place with `place_arrival_rpc(..., roster_status_at_departure, 'loan_abroad_return')`; the decision becomes `returned` either way.
- [x] Retained return: replace `openReturnWindows` in `resolve.ts` with a call per returning player to a new `return_retained_rpc(decision_id)`. It places with `place_arrival_rpc(..., 'retained_return')`. If placed, the decision becomes `returned`. If held, it stays `return_pending` with `reinstate_by = NULL`.
- [x] Remove `expireReturnWindows` and the `RETURN_WINDOW_HOURS` constant and its uses. Remove the `reinstate` action from the departures route. `activate_held_rpc` resolves the decision instead (Task 2).
- [x] `decline` (`lapseReturn`): allowed while the decision is `return_pending`. It deletes the `held` roster entry, sets the decision to `lapsed`, and opens the system auction, all in one RPC so the entry and decision can't disagree. It costs nothing (R4).
- [x] `execute_trade_transaction_rpc` (from 160): replace the literal counts with `team_active_count`/`team_roster_limit`. Compute squad-place deltas where outgoing `held` players free nothing and incoming players need places (R8). Refuse when a team that is holding (before the trade) ends up with a positive delta. An incoming `held` player arrives as `bench` (R15), and the room check covers him.
- [x] Existing-records guard: re-count `pending_activation` loans and `return_pending` decisions. If either is non-zero, stop and write the conversion described in the spec before continuing.
- [x] Apply 163 (Tasks 5 and 6 together). Verify live bodies against the file. Rolled-back DB tests: loanee abroad returns into a full squad and is held; retained return held, then activated, then decision `returned`; held retained declined, then auction opened, then entry gone; trade of a held player for a squad player refused while full; one-for-one squad trade allowed while holding.
- [x] Update the RetainedList UI: Reinstate becomes Activate, and Decline stays.
- [x] Commit.

## Task 7: Auction settlement (migration 164)

- [x] Confirm the live `resolve_single_player_auction_rpc` body matches migration 152. If it doesn't, find the live source before continuing.
- [x] Read the Scout's Fee migration on `feat/scout-fee-both-ways` and note its two anchor lines. Keep them byte-identical.
- [x] Rewrite the winner search as two passes (R17):
  - **Pass 1:** existing per-bidder logic (budget, then drop, academy or room), with room counted by `team_active_count`/`team_roster_limit`. Skip `team_is_holding` bidders with reason `players_held`. The first bidder with room wins.
  - **Pass 2**, only if pass 1 found no winner: the highest bidder who can afford it and isn't holding wins with status `held`. Severance is zero, because no drop happens.
- [x] The winner's roster insert goes through `place_arrival_rpc(winner, player, 'bench' or 'taxi' per request, 'auction')` in pass 2, so bid withdrawal happens in one place. Pass 1 keeps its existing insert.
- [x] Return `held: true` and the withdrawn bids in the result so the caller can notify.
- [x] Update the TS caller(s) of the RPC (`grep -rn "resolve_single_player_auction_rpc" src`) to send Player Held.
- [x] Rolled-back DB tests: higher bidder full versus lower bidder with room (lower wins); both full (higher wins, held, their other pending bid withdrawn); holding bidder skipped; nominated drop still valid (normal win); academy request.
- [x] Apply. Verify the live body. Confirm both Scout's Fee anchor lines still match exactly once. Commit.

## Task 8: Freeze guards in routes

- [x] `src/lib/roster/holds.ts`: `getHoldState(admin, teamId)` returns `{ holding, heldEntries, lineupLocked }` (calls `team_is_holding` and `held_lineup_locked`). `assertNotHolding(admin, teamId)` throws a typed error the routes map to 409 with "Activate or drop your held player first."
- [x] Wire it in:

| Route | Guard |
|---|---|
| `auctions/bid/route.ts` | refuse any bid |
| `trades/route.ts` (propose) and `trades/[tradeId]/route.ts` (accept) | refuse if the holding side gains squad places (same delta rule as the RPC; export a pure `squadPlaceDelta` from `holds.ts` and test it) |
| `loans/route.ts`, `loans/[loanId]/route.ts` | refuse loan-in for a holding team; refuse loaning out a `held` entry |
| `loans/[loanId]/recall/route.ts` | refuse while holding |
| `listings/route.ts` | refuse a loan listing (`open_to_loan`) on a `held` entry |
| `teams/[teamId]/taxi/route.ts` | refuse academy promotion while holding |
| `teams/[teamId]/ir/route.ts` | refuse IR activation while holding |
| `teams/[teamId]/lineup/route.ts` | refuse saves while `lineupLocked` |

- [x] Vitest for `squadPlaceDelta` and for each route's guard, following the existing route tests (`trades/__tests__/route.test.ts`, `auctions/bid/__tests__/route.test.ts`) and `src/test/leagueFixture.ts`.
- [x] Commit.

## Task 9: Activate route

- [x] Activation window helper in `holds.ts`: `isGameweekInProgress(admin)` is true between the current gameweek's first kickoff and its last dated kickoff. Reuse `lastDatedKickoffHasPassed` / `hasGameweekLastKickoffPassed` from `src/lib/fixtures/lockout.ts`, and add a first-kickoff check beside them (R6).
- [x] `POST /api/teams/[teamId]/held/[entryId]` with `{ target: 'bench' | 'taxi' | 'ir' }`: auth (team owner), refuse mid-gameweek with "You can activate him once this gameweek's last match has kicked off.", then call `activate_held_rpc`. Map refusals to sentence-case errors.
- [x] Drop of a held player uses the existing drop route; confirm severance applies and the system auction opens (R14).
- [x] Tests for the window helper boundaries. Commit.

## Task 10: Lineup lock carry-forward

- [x] `carryForward.ts`: when `held_lineup_locked(team)` is true, take the last complete lineup, keep every pick still eligible (on the roster, not `ir`/`taxi`/`loan_out`/`held`, eligible for his slot under exact-position rules), and fill only the empty slots with the best eligible remaining players. Check whether `smartLock.ts` or `selectBestLineup.ts` can fill a partial assignment before writing a new filler. Never regenerate the whole XI for a locked team (R13).
- [x] After writing a carried lineup for a locked team, send the lineup notice (Task 11) once per gameweek.
- [x] Tests: all picks valid (unchanged); one starter dropped (only that slot changes); a position change invalidates a slot (only that slot changes); unlocked team keeps today's behaviour.
- [x] Commit.

## Task 11: Notifications

Kind `club` for all. Use `gaffa-ui-copy` for titles (Title Case) and sentence-case bodies.

- [x] **Player Held:** the player and source, what's frozen, the kickoff time the lineup locks (first kickoff of the next gameweek after `held_at`), and the withdrawn bids by player name. Link to the roster page.
- [x] **Lineup Set For You:** sent by Task 10's carry-forward, saying the lineup is locked while a player is held, with a link to the roster.
- [x] One helper in `src/lib/roster/holdNotifications.ts`, called from process-loans, departures resolve, the auction caller and the activate route (none needed on activate).
- [x] Commit.

## Task 12: UI

Read `DESIGN.md` and `docs/UI_RULES.md` first. Reuse existing roster panel and `retRow`-style patterns; no new visual language.

- [x] Roster page: a Held group listing held players with source, Activate (only the targets the player qualifies for, disabled mid-gameweek with the reason) and Drop (existing severance confirm). A returning retained player also shows Decline.
- [x] Club to-do (`buildTodos` in `ClubClient.tsx`): one item per held player, counting down to the lineup lock.
- [x] Pitch page (`PitchUI.tsx` capacity notice): before the lock, "1 player held. Activate or drop him before {kickoff}, or your lineup locks."; after, the locked state and the carried-lineup explanation. Don't edit inside `.pitchContainer`.
- [x] Disabled controls with "Activate or drop your held player first." Done in #7: bid dialog, offer builder (trades and loans), loan request modal, Recall on Deals, the listing loan gate, Save Lineup while locked, academy and IR promotions on the team page and in the Inspector, plus a Home Needs You item.
- [x] The `hold` state reaches these surfaces through the existing page models (`loadClubView.ts`, `buildTransfersModel.ts`, team `page.tsx`), not a new client fetch.
- [x] Check both themes. `npm run check:ui`. Commit.

## Task 13: Kickoff preflight

- [x] `kickoffPreflight.ts`: a `warning` issue `teams_holding_players` naming each team and held player (R21). Not a blocker.
- [x] Commit.

## Task 14: Docs

- [x] `docs/USER_GUIDE.md`: §2 adds Held to the squad statuses, with the freeze, the activation window, the lineup lock and carried lineups, each with its reason. The auction section gets the two-pass settlement and bid withdrawal. §10 covers loan returns and recall needing room. §13 removes the 48-hour window, and "Players who leave on loan" changes from "over the limit" to "held". The glossary gets Held.
- [x] `docs/DECISIONS.md`: a 2026-09-13 entry quoting Duke on manual activation, no mid-gameweek activation, the grace-then-lock rule, last-saved lineup with gaps filled, severance on held drops, "only uncontested bids can be held", and trades that don't grow the squad.
- [x] `CLAUDE.md` domain rules: one bullet on the freeze and the lineup lock, pointing at `src/lib/roster/holds.ts`.
- [x] `README.md`: update the loan-return sentence added on 2026-09-12.
- [x] Commit.

## Task 15: Final verification

- [x] Re-run every rolled-back DB test from Tasks 2 and 5–7 against the final live functions.
- [x] `tsc --noEmit`, `npm test`, `npm run build`.
- [x] Confirm the Scout's Fee anchors still match (Task 7), and tell Duke the release order: held migrations 161–164 first, then the Scout's Fee migration with the next free number.
- [x] Summarise for Duke what shipped, what was verified and how, and anything skipped.
