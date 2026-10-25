# Cups redesign implementation plan

> **For agentic workers:** Implement task by task, in order. Checkboxes track progress. The spec is the source of truth; if this plan and the spec disagree, the spec wins, and you fix the plan.

**Goal:** Rebuild the Cups page as a Trophy Shelf with a Round Pager draw, add a page per cup tie, switch the League Cup to round-by-round draws, and make the small-league Consolation Cup completable. All of it must be live before MW16 (Sat 19 Dec 2026).

**Source of truth:** `docs/superpowers/specs/2026-10-25-cups-redesign-design.md`.

**Mockups to port from:** `design-2.0/cups/` (`composition.html` option A, `draw-swipe.html` Round Pager and seed column). Port them 1:1; don't redesign.

**Branch:** `worktree-cups-redesign`, worktree `.claude/worktrees/cups-redesign`.

**Tech stack:** Next.js 16 App Router server components, Postgres RPCs applied through the Supabase MCP against project Gaffa (`hnkavimrsbytsesdzwvj`), Vitest, CSS Modules.

## Global constraints

- Edit only inside the worktree. Commit to the branch after every task.
- Before building in the worktree, run `cp -cR "/Users/dukewang/Fantasy Futbol/node_modules" node_modules` and symlink `.env.local` from the main checkout.
- **Migration number:** the highest in use across all branches was **182** on 2026-10-25. Re-check before writing the file, using the command in `CLAUDE.md` § Branches and worktrees. This plan uses 183.
- `SECURITY DEFINER` functions get `SET search_path = public, pg_temp`, and `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`. Only the service role calls them.
- **Alpha leagues:** Matchday Militia and Dynasty Dragoon are live. Never change a published pairing or result. The only data change is clearing `next_matchup_id` on League Cup ties.
- **UI:** read `DESIGN.md` and `docs/UI_RULES.md` before Task 9, and use the `gaffa-ui-copy` skill for every string. The `check-ui-rules.mjs` hook runs on every write.
- **Both themes:** every colour comes from a `--color-*` token, with no raw hex in component CSS.
- **Gates:** `npm test`, `npm run build` and `npm run check:ui` pass before each stage is merged.
- **Shipping:** two stages, each merged and deployed on its own (Duke's standing approval, 2026-09-15). Stage A is Tasks 1–7; Stage B is Tasks 8–14.

## File structure

| Path | Action |
|---|---|
| `supabase/migrations/183_cup_draws.sql` | Create: `decided_by`, `drawn_at`, `apply_cup_draw`, clear League Cup links |
| `src/lib/tournaments/draw.ts` | Create: `pairDraw`, `consolationFeeds`, `decideTie` |
| `src/lib/tournaments/__tests__/draw.test.ts` | Create |
| `src/lib/tournaments/runDraw.ts` | Create: read entrants, `pairDraw`, `apply_cup_draw`, notify |
| `src/lib/tournaments/__tests__/runDraw.test.ts` | Create |
| `src/lib/tournaments/__tests__/engine.test.ts` | Create: small-league Consolation round specs |
| `src/lib/tournaments/advanceTournament.ts` | Modify: `decided_by`, draws, Consolation drop-in, injectable admin |
| `src/lib/tournaments/createTournaments.ts` | Modify: no `next_matchup_id` for `secondary_cup` |
| `src/types/index.ts` | Modify: `decided_by`, `drawn_at` |
| `src/lib/cups/cupsView.ts` | Create: pure page model |
| `src/lib/cups/__tests__/cupsView.test.ts` | Create |
| `src/lib/cups/loadCupsPage.ts` | Create |
| `src/lib/cups/__tests__/loadCupsPage.test.ts` | Create |
| `src/lib/cups/loadTieView.ts` | Create |
| `src/components/gameweeks/useSwipePager.ts` | Modify: N pages |
| `src/components/gameweeks/Views.tsx` | Modify: export `LiveRefresh` |
| `src/components/cups/TrophyShelf.tsx`, `NextTie.tsx`, `TieCard.tsx`, `RoundPager.tsx`, `CupTieView.tsx`, `cups.module.css` | Create |
| `src/app/(dashboard)/league/[leagueId]/tournaments/page.tsx` | Rewrite |
| `src/app/(dashboard)/league/[leagueId]/tournaments/loading.tsx` | Create |
| `src/app/(dashboard)/league/[leagueId]/tournaments/[tieId]/page.tsx`, `loading.tsx` | Create |
| `src/app/(dashboard)/league/[leagueId]/tournaments/tournaments.module.css` | Delete |
| `src/components/tournaments/BracketMatchup.tsx` | Delete |
| `src/components/auth/AuthShowcase.tsx` | Modify: Cups slide uses `TieCard` |
| `docs/USER_GUIDE.md`, `docs/DECISIONS.md`, `CLAUDE.md` | Modify |

---

# Stage A: mechanics

## Task 1: Pure draw logic

- [ ] Create `src/lib/tournaments/draw.ts`:
  ```ts
  export interface Entrant { teamId: string; rank: number }   // league_standings.rank; 999 if unranked
  export interface DrawnTie { a: string; b: string | null }   // b null = bye
  /** One tie per place pair, in bracket_position order. `random` returns [0, 1). */
  export function pairDraw(entrants: Entrant[], ties: number, random: () => number): DrawnTie[]
  /** Does a Champions Cup loser in this round drop into a small league's Consolation Cup? */
  export function consolationFeeds(clubCount: number, roundName: string): boolean
  export type DecidedBy = 'score' | 'best_performer' | 'position';
  export function decideTie(i: {
    teamA: string; teamB: string; totalA: number; totalB: number;
    playersA: { playerId: string; points: number }[]; playersB: { playerId: string; points: number }[];
  }): { winnerId: string; decidedBy: DecidedBy }
  ```
- [ ] **`pairDraw`:**
  - Throw if there are more than `ties * 2` entrants or fewer than `ties`. A round always has at least one club per tie.
  - `byes = ties * 2 - entrants.length`. The `byes` best-ranked entrants (lowest rank, ties broken by `teamId` for determinism) each get a tie with `b: null`.
  - Fisher–Yates shuffle the rest with `random`, pair them in order, and put the better-ranked club in each pair as `a`.
  - Fisher–Yates shuffle the full tie list into bracket order.
- [ ] **`consolationFeeds`:** true for 6 clubs on quarter-final or semi-final, 5 on quarter-final or semi-final, 4 on semi-final, and false otherwise. Match on `roundName.toLowerCase()` with `includes('quarter')` and `includes('semi')`, as the current code does.
- [ ] **`decideTie`:**
  - Higher total wins, with `'score'`.
  - Otherwise `resolveTiebreaker` from `engine.ts` decides, with `'best_performer'`.
  - Otherwise `teamA` wins, with `'position'`.
- [ ] `src/lib/tournaments/__tests__/draw.test.ts`, using a seeded LCG for `random`:
  - **`pairDraw`:** every entrant appears exactly once; `a` always outranks `b`; 4 entrants in 2 ties gives no byes; 3 in 2 gives the best-ranked a bye; 2 in 1 gives one tie with `a` the better-ranked; it throws on too many entrants; two different seeds give different pairings for 4 entrants (the draw really is random).
  - **`consolationFeeds`:** the full table for 4, 5, 6 and 7 clubs.
  - **`decideTie`:** each of the three outcomes.
- [ ] `npm test`, then commit.

## Task 2: Migration 183

- [ ] Re-check the highest migration number across branches.
- [ ] **Pre-check the live data:**
  - `SELECT t.status, count(*) FROM tournament_matchups m JOIN tournament_rounds r ON r.id = m.round_id JOIN tournaments t ON t.id = r.tournament_id WHERE t.type = 'secondary_cup' AND m.next_matchup_id IS NOT NULL GROUP BY 1`. Note the counts.
  - Confirm that no League Cup tie in a live league has a score yet: every `team_*_score_leg1` is 0 in the non-completed tournaments.
- [ ] Write `supabase/migrations/183_cup_draws.sql`, with a header comment pointing at the spec:
  - `ALTER TABLE tournament_matchups ADD COLUMN IF NOT EXISTS decided_by text CHECK (decided_by IN ('score','best_performer','position'));`
  - `ALTER TABLE tournament_rounds ADD COLUMN IF NOT EXISTS drawn_at timestamptz;`
  - `UPDATE tournament_matchups m SET next_matchup_id = NULL FROM tournament_rounds r, tournaments t WHERE r.id = m.round_id AND t.id = r.tournament_id AND t.type = 'secondary_cup' AND t.status <> 'completed' AND m.next_matchup_id IS NOT NULL;`
  - `apply_cup_draw(p_round_id uuid, p_ties jsonb) RETURNS boolean`. `p_ties` is `[{ "position": 0, "a": "<uuid>", "b": "<uuid>|null" }, …]`. Its body, in order:
    1. `SELECT … FROM tournament_rounds WHERE id = p_round_id FOR UPDATE`. Return false if it's not found or `drawn_at IS NOT NULL`.
    2. Find the previous round (same tournament, `round_number - 1`). If it exists, return false when any of its ties is not `completed`, and the entrant set is its non-null `winner_id`s. Otherwise, the entrant set is the non-null `team_a_id`/`team_b_id` of this round's ties.
    3. Return false unless `jsonb_array_length(p_ties)` equals this round's tie count, and the set of non-null `a`/`b` in `p_ties` equals the entrant set (compare sorted arrays).
    4. For each element, update the tie at that `bracket_position`: set `team_a_id` and `team_b_id`, set `status = 'active'` when `b` is present, and otherwise set `status = 'completed'`, `winner_id = a`, `decided_by = NULL`. For a bye tie with `next_matchup_id`, place `a` in the linked tie (even position fills `team_a_id`, odd fills `team_b_id`) and set that tie `active` once both sides are filled.
    5. `UPDATE tournament_rounds SET drawn_at = now() WHERE id = p_round_id; RETURN true;`
  - `REVOKE EXECUTE ON FUNCTION apply_cup_draw(uuid, jsonb) FROM PUBLIC, anon, authenticated;`
- [ ] Apply with `apply_migration`.
- [ ] **Verify:**
  - Re-run the pre-check query: League Cup links are 0 for non-completed tournaments.
  - Inside one `execute_sql` that starts `BEGIN;` and ends `ROLLBACK;`, take Matchday Militia's League Cup semi-final round:
    - Calling it while the quarter-finals are pending returns false.
    - After setting both pending quarter-finals `completed` with winners, a correct `p_ties` returns true and writes the ties.
    - A second call returns false.
    - A `p_ties` naming a club that isn't through returns false.
  - In a second rolled-back transaction, a 3-entrant Consolation draw with one bye puts the bye club in the final.
- [ ] Commit.

## Task 3: Types and creation

- [ ] `src/types/index.ts`: add `decided_by: 'score' | 'best_performer' | 'position' | null` to `TournamentMatchup` and `drawn_at: string | null` to `TournamentRound`.
- [ ] `createTournaments.ts` step 4: skip linking `next_matchup_id` when `type === 'secondary_cup'`.
- [ ] `src/lib/tournaments/__tests__/engine.test.ts`: `buildRoundSpecs` for a 4-club Consolation Cup (bracket 2) is a single Final at MW38; for 5 and 6 clubs (bracket 4) it's a two-legged semi-final at MW36–37 plus a final at MW38. This pins today's behaviour, which the new drop-in relies on.
- [ ] `npm test`, then commit.

## Task 4: The draw runner

- [ ] Create `src/lib/tournaments/runDraw.ts`:
  ```ts
  export async function runDraw(admin: SupabaseClient, opts: {
    tournament: { id: string; league_id: string; name: string };
    round: { id: string; name: string; start_gameweek: number; end_gameweek: number; is_two_leg: boolean };
    random?: () => number;   // default Math.random
  }): Promise<{ applied: boolean }>
  ```
  1. Read the previous round's ties, or this round's placed clubs, by the same rule as the RPC. If a previous tie isn't `completed`, return `{ applied: false }` without calling the RPC.
  2. Read `league_standings` (`team_id, rank`) for the league and build the `Entrant[]`.
  3. `pairDraw(entrants, roundTieCount, random)`, then `admin.rpc('apply_cup_draw', { p_round_id, p_ties })`.
  4. **Notify, only when the RPC returns `true`.** For each tie, notify each club's manager through `createNotification` with kind `'matchdays'`, read `user_id` from `teams`, and skip null (Caretaker). The `tag` is `cup-draw:${round.id}`.
     - Two-club tie, single leg: "**League Cup** semi-final draw: you play **Hayden FC** in MW21."
     - Two-club tie, two legs: "**League Cup** semi-final draw: you play **Hayden FC** over MW21 and MW24."
     - Bye: "**League Cup** semi-final draw: you have a bye to the final."
     - Run all copy through `gaffa-ui-copy` before committing.
- [ ] `src/lib/tournaments/__tests__/runDraw.test.ts` with `createFakeSupabase` and a stubbed `apply_cup_draw`:
  - An unfinished previous round makes no RPC call.
  - A finished round passes `p_ties` that cover exactly the winners.
  - RPC `true` notifies each manager once and skips a Caretaker club.
  - RPC `false` sends no notifications.
- [ ] `npm test`, then commit.

## Task 5: Advancement

- [ ] **Injectable admin.** `executeAdvanceTournament(tournamentId, gameweek, admin = createAdminClient())`. The existing callers (`matchupProcessor.ts`, `api/sync/tournaments/route.ts`, and the `matchupProcessor.rowCap` test's mock) keep working unchanged.
- [ ] Replace the inline winner logic with `decideTie`, and write `decided_by` alongside `winner_id` and `status`.
- [ ] **Consolation drop-in.**
  - Replace the hard-coded `totalLeagueTeams === 5 / 4 / 6` branch with `consolationFeeds(totalLeagueTeams, round.name)`.
  - Replace the `start_gameweek = 36` lookup with the Consolation Cup's lowest `round_number` round.
  - Keep "first empty place" placement, but no longer set `status: 'active'` on a filled tie in a 5- or 6-club league. The draw activates ties there. A 4-club Consolation final still activates when its second club lands.
- [ ] **After the per-tie loop, for each round finalized this call** (`gameweek === round.end_gameweek`):
  - **`secondary_cup`:** if every tie in the round is `completed` and a next round exists, `runDraw` the next round.
  - **`primary_cup`, semi-final, 5 or 6 clubs:** once both semi-finals are `completed`, `runDraw` the Consolation Cup's first round.
- [ ] Remove the `advanceWinner` call for `secondary_cup`. `next_matchup_id` is already null there, but leave no path that relies on it.
- [ ] **Tests** in `src/lib/tournaments/__tests__/advanceTournament.test.ts`, with `createFakeSupabase` and the scoring reads stubbed. Run a 6-club league end to end with scripted league scores:
  - The Champions Cup quarter-finals at MW33 drop two losers into the Consolation Cup, still pending.
  - The semi-finals at MW35 drop two more and trigger the Consolation draw.
  - The Consolation semi-finals resolve at MW37, the final at MW38, and the Consolation tournament ends `completed`.
  - A separate case: a League Cup round resolving triggers exactly one `apply_cup_draw` for the next round.
  - A level tie at 0–0 records `decided_by = 'position'`.
  - If stubbing the scoring path through `scoreLeg` grows past a page of setup, extract `finalizeRound(admin, tournament, round, results)` and test that instead.
- [ ] `npm test`, then commit.

## Task 6: Docs for the mechanics

- [ ] **`docs/USER_GUIDE.md` §6:**
  - The League Cup is an open draw after its first round, with the reason (two cups with the same draw are one story told twice; real domestic cups are open draws).
  - The Consolation Cup in small leagues: Champions Cup quarter-final and semi-final losers in a 6-club league, with the 5- and 4-club versions.
  - The last tie-break in a drawn round is league position.
  - Replace the "In a small league (4–6 managers)…placeholder slots" paragraph.
- [ ] **`docs/DECISIONS.md`:** a 2026-10-25 entry quoting Duke. Round-by-round draws: "this season is fine, since no cups have started, now is a good time. just want to have a set and working system before the cups start". Also the Consolation entrants, the Trophy Shelf, the Round Pager, the seed column, and the tie page. On the old seeds: "why does it look so ugly". Mark anything that's an agent's reading as such.
- [ ] **`CLAUDE.md`:** check the "Cup ties never draw" domain rule still reads true, and add one line on the League Cup draw (`apply_cup_draw`, migration 183).
- [ ] Commit.

## Task 7: Ship Stage A

- [ ] `npm test`, `npm run build` and `npm run check:ui` all pass.
- [ ] Push the branch, open a PR for Stage A, merge it to `main`, and confirm the Vercel production deploy is green.
- [ ] Bind the PR with the `ccd_pr` tools.
- [ ] Re-run the Task 2 verification query against production data.

---

# Stage B: the pages

## Task 8: Page model (`cupsView`)

- [ ] Create `src/lib/cups/cupsView.ts`. It's pure, with no I/O, in the style of `src/lib/matchups/roundView.ts`. Input is the raw rows (tournaments, rounds, ties with team rows, standings, the viewer's team id, gameweek deadlines, the current FPL gameweek and state, the live league scores for the current gameweek, and prize config). Output:
  ```ts
  interface CupsPageModel {
    shelf: { cupId: string; kind: HonourKind; name: string; short: string; status: string; selected: boolean; href: string }[];
    next: NextTieModel | null;          // the selected cup's viewer tie
    rounds: RoundPageModel[];           // strip + pages for the selected cup
    initialRound: number;
    prize: { winner: number; runnerUp: number } | null;
    seeded: boolean;                    // Champions Cup only
  }
  ```
  - Statuses are the spec's table, one string each, never longer than 12 characters ("Drawn at MW7").
  - Slot labels: "X or Y", "Semi-Final Winner", "Champions Cup QF Loser".
  - Decided-by labels: "Best Performer"; "League Position" when the round has `drawn_at`, otherwise "Seeding".
  - Dates: the matchweek's deadline in Europe/London as "Sat 19 Dec". Two legs read "Two Legs · Sat 16 Jan & Sat 6 Feb".
  - Default cup selection: the soonest next tie for the viewer, then the first active cup, then the Champions Cup. A valid `?cup=` overrides it.
  - Live scores for current-gameweek ties come from the league scores passed in, not from `tournament_matchups`.
- [ ] `src/lib/cups/__tests__/cupsView.test.ts`. Build Matchday Militia as it stood on 2026-10-25 in the fixture: six clubs, byes for ChelsZ and Hayden, and Not Too Xabi v tottenyang FC in both cups. Assert:
  - The shelf reads `QF · MW32`, `QF · MW16`, `From MW36`.
  - The League Cup is selected by default.
  - The semi-final page shows ChelsZ and Hayden as "In", plus "Not Too Xabi or tottenyang FC" and "Pizzaking's Club or Tea FC".
  - Each remaining status (`Bye to SF`, `Out · QF`, `Winner`, `Runner-Up`, `Not Entered`, `Drawn at MW7`) has its own case, as do the three decided-by labels and a live tie using league scores.
- [ ] `npm test`, then commit.

## Task 9: Loader

- [ ] Create `src/lib/cups/loadCupsPage.ts`. Mirror the current page's read waves:
  1. League, membership, tournaments, FPL state (`getBootstrapSlim` for deadlines and the current event), standings, prize config.
  2. Rounds and ties for every cup in the league. The shelf needs all three cups, not only the selected one.
  3. For the current gameweek only, the league `matchups` scores for clubs in a live cup tie.
  - Teams come with `crest_config` and are left-joined, so Caretaker clubs survive.
- [ ] `src/lib/cups/__tests__/loadCupsPage.test.ts` with `createFakeSupabase`: a viewer with no team redirects, and the Militia fixture produces the same model as Task 8's test.
- [ ] Commit.

## Task 10: Shared pieces

- [ ] **`useSwipePager`:** generalize from two cards to N. Keep one ratio per entry in `cards.current`, make `active` the index of the largest ratio, and leave the signature unchanged. Confirm the two existing callers (`MatchSections.tsx` Lineups, `TeamSheets.tsx`) behave the same on a phone width.
- [ ] Export `LiveRefresh` from `src/components/gameweeks/Views.tsx`.
- [ ] Commit.

## Task 11: Components

Read `DESIGN.md`, `docs/UI_RULES.md` and `design-2.0/cups/README.md` first. Port the mockup CSS into `src/components/cups/cups.module.css`, mapping every raw colour to its token: `--color-topbar`, `--color-bg-card`, `--color-border`, `--color-border-subtle`, `--color-border-strong`, `--color-green-50/200`, `--color-accent`, `--color-text-*`, `--color-live`.

- [ ] **`TrophyShelf`** (server-safe): the green field with the dashboard bleed (`border-image … fill 0 / 0 / 0 100vmax`, as in `dashboard.module.css`), the "Cups" heading, and three `Trophy` links (`size="card"`, height 96 on phones and about 140 at ≥ 900px). The ribbons use `club` from the viewer's `crest_config` (`primaryColor`/`secondaryColor`). The selected trophy carries `aria-current="page"`; the others are at 55% opacity. Under each, its short name and status, `white-space: nowrap`.
- [ ] **`NextTie`:** a card with a shadow and no border, overlapping the shelf with a negative top margin. The whole card is a link (`::after` stretch, as the dashboard's `.cardBar` does). States: upcoming, live, played, two legs (aggregate with legs beneath), out, cup won. Scores in serif at `--t-32`, two decimals.
- [ ] **`TieCard`:** two 48px lines of crest (`CrestBadge`, 24px, `interactive={false}`), name (ellipsis) and score. It takes an optional seed column, and Bye and In tags. The "?" placeholder lines are dashed. Your tie gets the green tint, a live tie the live marker, and a decided tie its decided-by tag. When the tie has two clubs, the whole card links to `/league/[id]/tournaments/[tieId]`.
- [ ] **`RoundPager`** (client): the strip as `role="tablist"` buttons with a 44px touch target; the pages in a `position: relative` scroll-snap scroller (`calc(100% - 40px)` pages, 12px gap), using `useSwipePager`. It starts on `initialRound`. At ≥ 900px it becomes a grid of columns with no scroll.
- [ ] Commit after each component.

## Task 12: The Cups page

- [ ] Rewrite `tournaments/page.tsx` onto `loadCupsPage`, then `TrophyShelf`, `NextTie` and `RoundPager`, plus `LiveRefresh` when any cup tie is live. Delete `tournaments.module.css` and the name-patching code.
- [ ] Desktop (≥ 900px): the Next Tie card sits beside the trophies in the shelf; the pager is columns.
- [ ] `loading.tsx`: labels and shapes (kit option A), in its own CSS module: the shelf with three trophy shapes, a Next Tie block, the strip, and two tie-card blocks.
- [ ] **Empty states:**
  - No tournaments yet: the shelf with the three trophies, each reading "Drawn at MW7".
  - A cup with no rounds: the shelf, and no pager.
- [ ] **`AuthShowcase.tsx`:** `CupsBracketVisual` renders `TieCard` with the same pinned demo tie (`DEMO_CHAMPIONS_MATCHUP`). Then delete `src/components/tournaments/BracketMatchup.tsx`.
- [ ] `npm run build`, then commit.

## Task 13: The tie page

- [ ] **`src/lib/cups/loadTieView.ts`:**
  1. Load the tie, its round and its tournament, plus each club's league `matchups` row for the leg's gameweek. That's `round.start_gameweek`; for leg 2 it's `round.end_gameweek`, chosen with `?leg=2`.
  2. Build a synthetic `MatchupRow`: `id` is the tie id; `team_a`/`team_b` are the cup clubs; `lineup_a`/`score_a` come from A's league row (whichever side A is on there), and likewise for B; `status` is the league row's.
  3. Call `loadMatchupContext` and `loadMatchupView` unchanged.
  4. Load H2H with `loadAllResults` and `headToHead`, as `loadMatchPage` does.
  5. Return each side's best performer (top points starter in each `SideView`) for the level-tie line.
- [ ] **`CupTieView`** (client): a back link (`/league/[id]/tournaments?cup=<id>`), the trophy pip with "{Cup} · {Round}", the `Scoreboard` (big), and kit `Tabs` for the legs when the tie has two. Then the level-tie line, `Lineups`, `TeamSheets`, and `HeadToHead` for upcoming and finished ties. Add `LiveRefresh` (league filter) while live.
- [ ] `tournaments/[tieId]/page.tsx` (auth and membership as on `matchups/[matchupId]/page.tsx`) and `loading.tsx`.
- [ ] Check the level-tie copy with `gaffa-ui-copy`: "Level at 54.30. Through on best performer: Saka 14.2 v Palmer 11.8." and "Level at 0.00. Through on league position."
- [ ] `npm run build`, then commit.

## Task 14: Verify and ship Stage B

- [ ] `npm test`, `npm run build` and `npm run check:ui` all pass.
- [ ] Push and open the Stage B PR. On the Vercel branch preview, check both pages at 390px and 1440px in both themes, against:
  - The E2E 10-club league, which has completed cups (scores, a decided-by tag, a won trophy).
  - Matchday Militia (byes, undrawn semi-finals, Next Tie upcoming).
  - Look for wrapping, clipping, overlap and horizontal page scroll. Measure the status lines and tie names at 390px.
- [ ] Send Duke the preview link with screenshots of both pages at both widths.
- [ ] Merge to `main`, confirm the production deploy, and bind the PR with the `ccd_pr` tools.
- [ ] Update `design-2.0/README.md`: Cups is on 2.0.
