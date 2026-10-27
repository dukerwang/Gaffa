# REVIEW.md

What a reviewer of a Gaffa change looks for, human or agent. Read `CLAUDE.md`
first for the stack and the domain rules; this file is the short list of what
breaks in practice and how to report it.

The mechanical half of this list runs on every PR as
`scripts/check-data-rules.mjs` (data) and `scripts/check-ui-rules.mjs` (UI). A
finding those scripts already report needs no comment from you. When the same
issue keeps coming up in review, add it to one of those scripts instead of
flagging it again.

## What counts as a failure

In order of cost:

1. **A published score or result changes after the fact.** Real managers play
   in live leagues. Anything that can rewrite a locked gameweek, a resolved
   matchup, a cup tie or an archived season is the most serious finding there
   is.
2. **Money moves wrongly.** Club Balance, bids, severance, compensation,
   solidarity, prizes, Match Revenue and facility purchases. A wrong amount or
   a double payment.
3. **A rule is enforced on one path but not another.** Gaffa's rules are often
   checked in TypeScript, in a route, and again in an RPC. A change to one that
   misses the others lets a manager through the gap.
4. **Data silently goes missing.** A read that truncates, a join that drops
   rows, a sync that overwrites a field it doesn't own.
5. **The docs say something the code doesn't.** `docs/USER_GUIDE.md` and
   `CLAUDE.md` quote exact numbers. A change to one of those numbers must
   update the guide in the same PR.

Everything else, including how the code reads, is secondary.

## Check every diff for these

These have each shipped as bugs. `CLAUDE.md` has the background on each.

- **Reads past 1,000 rows.** PostgREST truncates at 1,000 and reports success.
  `player_stats`, `sofifa_position_reference`, `player_season_clubs`,
  `roster_entries` across leagues, and `players` without `is_active` all pass
  that size. They go through `src/lib/supabase/pagination.ts`.
- **Club identity.** Nothing durable keys on an FPL team id or fixture id; both
  reset every season. Clubs are slugs from `src/lib/clubs/registry.ts`.
  Archived club membership comes from `player_season_clubs`, never
  `players.pl_team`.
- **Gameweek locking.** A gameweek locks on `gameweek_sync_state.final_synced_at`,
  never on FPL's `finished` flag alone. `finished_provisional` exists only on
  fixtures.
- **Stats rewrites.** Anything that writes `player_stats.stats` wholesale must
  rebuild the keys `/api/sync/stats` adds beyond the engine's inputs
  (`started`, `team_goals_conceded`), and every write is scoped to a season.
- **Caretaker clubs.** `teams.user_id` can be null. Never inner-join `teams` to
  `users`; notifications, trades and loans must handle a club with no manager.
- **Per-team slot caps.** Academy, IR and loan-out caps come from
  `effectiveSlots()` or `team_*_slots()`, not the league columns.
- **Held players.** Every path that adds a player to a squad checks
  `team_is_holding`. A new roster-status filter decides what `held` means for
  it.
- **Redraft leagues.** A feature that only pays off across seasons is switched
  off through `leagueFeatures()`.
- **Exact-position eligibility and the fixed auto-sub order.** A bench CB never
  covers LB.
- **The season string** comes from `src/lib/season/currentSeason.ts`, never a
  literal.
- **Migrations.** The number is the next one free across every branch, not only
  `main`. Anything destructive (`DROP`, `TRUNCATE`, data rewrites) needs Duke's
  yes before it is applied. An RPC that duplicates TypeScript logic (facility
  ladders, scoring constants) changes in step with it.
- **Cron, sync and admin routes** gate on `x-cron-secret`.
- **`admin.ts`** (the service-role client) never reaches client code.
- **Cost.** No client-side polling, no new heavy batch work through Vercel
  functions, no unthrottled calls to Gemini, API-Football, Transfermarkt or
  SoFIFA.

For a bug fix, find the root cause and say whether the fix reaches it. If the
same mistake can occur elsewhere, name the class of bug and where else it
appears, so the author fixes every instance and not one line.

## Higher-risk paths

Review these more deeply, and say in the summary that the change touches one:

- `supabase/migrations/`
- `src/lib/scoring/`, `src/lib/economy/`, `src/lib/auction/`,
  `src/lib/offseason/`, `src/lib/roster/`, `src/lib/transfers/`,
  `src/lib/expansion/`, `src/lib/caretaker/`
- `src/app/api/sync/`, `src/app/api/cron/`, `src/app/api/admin/`
- Route handlers under `src/app/api/leagues/[leagueId]/` that move money or
  players (bids, trades, loans, listings, drops, claims)
- `vercel.json` and `.github/workflows/`

A bad deploy can be rolled back in Vercel in seconds. A migration, a locked
gameweek or a payout can't, which is why these paths get the deeper review.

## What not to report

- Style, naming and formatting. ESLint and the UI hooks cover what matters.
- UI copy. `scripts/check-ui-rules.mjs` and the `gaffa-ui-copy` skill own it.
- Design choices that `docs/DECISIONS.md` records as decided.
- Cleanups and refactors the change didn't need.
- Anything you can't tie to a concrete failure. "This could be a problem" is
  not a finding; "a league with 13 clubs reads only the first 1,000 rows here"
  is.

Skip these paths: `scratch/`, `design-2.0/`, `specs/`, `src/app/kit/`, mockup
and prototype files, generated files, and `public/`.

## How to report

Open with a one-line summary: the number of findings, and whether the change
touches a higher-risk path. When there are none, say "No issues found."

For each finding, give the file and line (`src/lib/auction/timer.ts:142`, never
a guessed filename), what goes wrong, and the concrete input or state that
triggers it. Label each one:

- **Important**: fix before merging.
- **Nit**: worth knowing, safe to ignore.
- **Pre-existing**: the bug was already there before this change. Report it,
  but it doesn't block the merge.

Every Important finding is either fixed or dismissed with a written reason
before the merge.

## Review rounds

Review rounds stop at three. After the first full review, later rounds look
only at the commits added since the last one and don't repeat earlier
findings. If a change still has Important findings after the third round, stop
patching and rethink the approach.
