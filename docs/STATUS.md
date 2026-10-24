# Status

This file tracks every feature in development: where its code lives, what stage it has reached, and the decision it's waiting on. Update the row for a feature at the end of any session that moves it to a new stage.

Last full audit: 2026-10-23. The audit read git branches, worktrees, open PRs and session transcripts. It didn't run any app code, so "built" means the code exists, not that someone verified it in a browser.

## Stages

Use one of these words in the Stage column.

- **Spec**: a written design, no code.
- **Prototype**: clickable or rendered mockups, no app code.
- **Built**: app code exists on a branch.
- **Verified**: built, and checked in the running app on phone and desktop widths in both themes.
- **Shipped**: merged to `main` and deployed.

## Features

| Feature | Stage | Where the code lives | Waiting on |
|---|---|---|---|
| Targets and the Board (Listings rework) | Backend built, UI prototype only | `feat/heritage-targets-projections`, `claude/inspiring-dewdney-fdb56c`, `docs/board-spec`, `docs/targets-handoff` | See "Targets and the Board" |
| Matchups redesign | Built, not shipped | `release/2026-10-09` (local only, never pushed) | Push the release branch and merge it |
| October update (front page, changelog, perf) | Built, not shipped | `release/2026-10-09`, `feat/public-home` (PR #31) | Same as matchups |
| League Home revamp | Built, not merged | `design/league-home-revamp` | Decide whether it's still wanted |
| Cups page | Not started | None | A 2.0 port, with Finance |
| Finance page | Not started | None | A 2.0 port, with Cups |
| Gaffa Kit adoption | Shipped in batches | `main` (PRs #59, #67, #78, #80 and the `claude/kit-*` branches) | More batches as needed |

## Targets and the Board

**Backend.** Migrations `153_player_targets`, `154_fill_targets_on_acquisition` and `155_target_role`, the targets API routes, matching, limits and notifications are on `feat/heritage-targets-projections` and `claude/inspiring-dewdney-fdb56c`. Neither branch is in `main`. Migration numbers 153 and 154 are now used on `main` by other migrations, so renumber these before they land. Check every branch for the highest number first (see "Rules for working", rule 6).

**UI.** Not built. The handoff note, `docs/superpowers/plans/2026-09-10-targets-handoff.md` on `docs/targets-handoff`, says Tasks 7 (UI) and 9 (guide and verification) haven't started.

**Design.** On 2026-09-22 you merged Listings and Targets into one tab, the Board. The spec is `docs/superpowers/specs/2026-09-22-transfer-board-design.md` on `docs/board-spec`. It supersedes the page structure of the original Targets spec but keeps its data model, matching and notification rules. The latest prototype is the Market page in the Board's design language, committed on `docs/board-spec` (2026-09-23).

**Open decisions:**

1. The name "Board" is a placeholder.
2. The direct-visibility change needs a migration that widens the `visibility` check, and an RLS policy test against two accounts.
3. The original Targets spec still says "profile" where the code says "role". Update the spec to match the code.

**Unrecoverable work.** Two stashes on `feat/heritage-targets-projections` hold changes that aren't on any branch. Inspect them with `git stash show -p` before anyone drops them. The third stash is a backup from 2026-09-13 labelled "Do not pop"; the same work is on `backup/main-folder-wip-2026-09-13`.

## Matchups redesign and the October update

PR #40 merged the matchups redesign, and PR #41 reverted it on `main` on 2026-10-12. The redesign is restored on `release/2026-10-09`. It also carries the public front page, the October changelog, one fixed example per front-page section, and the player-card and bootstrap perf work.

On 2026-10-24 the branch was pushed and `main` was merged into it. Typecheck, tests and the build pass, and the public front page was checked on the Vercel preview. The signed-in dashboard and the matchups pages have not been checked in a browser by anyone but you.

Do next: review the preview signed in, settle the follow-ups below, then open the PR into `main`.

Follow-ups for this release:

- **Login carousel.** `AuthShowcase` still draws the old matchup pitch: it imports `MatchupPitch.module.css`, and the component it copied is gone. Update it to the redesigned matchups and the new front page. Until then the carousel shows the previous design.
- **Matchup scoreboard background.** Changed on 2026-10-24: one fixed background (`.hx` in `gw.module.css`), a deepened step of the top bar's green after a near-black ink clashed with the cream and green UI. The crests carry the clubs' colours. Awaiting Duke's review in the browser. The earlier club-colour blend of both clubs' colours turned warm ones to mustard and maroon. `clubColour()` in `matchupView.ts` is still computed but no longer used by the scoreboard.

## Home page

Three separate pieces:

- **League Home revamp**: `design/league-home-revamp`, one commit (2026-09-16). Not in `main`.
- **Public front page**: PR #31 is open. The work is also on `release/2026-10-09`.
- **Matchweek stepper and fixtures grouped by day**: merged.

## Open pull requests

| PR | Title | Note |
|---|---|---|
| #56 | Fix phone game log, lineup portrait crop and long names | Ready to merge |
| #42 | Preview any worktree in the Browser pane | Preview tooling |
| #31 | Public front page at / | Same work as the release branch |
| #1, #4, #5 | Cursor drafts (AGENTS.md, Futbolpedia chat) | Stale since September. Close or merge |

## Cleanup debt

- About 40 worktrees under `.claude/worktrees/`, a dozen for work that has already merged.
- Six worktrees in `/private/tmp/gaffa-worktrees` are marked prunable. Run `git worktree prune`.
- `feat/scoring-v3` is 16 commits ahead of `main`. Scoring V3 is on hold; see the project memory.
- `worktree-lineup-builder-ratings` (7 commits ahead) is the blue ratings ramp.

## Rules for working

1. **One feature, one session, one worktree, one branch, one PR.** Give all of them the same name, for example `targets-board`. Edit only inside a worktree, as the root `CLAUDE.md` requires. Never leave uncommitted work in the main folder.
2. **Commit as you go.** Work that exists only as untracked files or a stash gets lost. The Targets backend almost was.
3. **Push the branch the day you create it.** `release/2026-10-09` lived only on one laptop for two weeks.
4. **Write a handoff note for every feature that spans sessions.** Use `docs/superpowers/plans/2026-09-10-targets-handoff.md` as the pattern: where the work stands, what went wrong before, the open decisions, and the files. Link it from the feature's row above.
5. **Label prototypes as prototypes.** A session title or a row in this file should say "prototype, not built" so nobody reads it as in-progress code.
6. **Check every branch before numbering a migration.** The command is in the root `CLAUDE.md`. Parallel branches have already collided on 153, 154 and 166.
7. **Group sessions in the sidebar by feature**, and archive a session once its PR shows MERGED. Start sub-sessions from the feature's main session so they link as a family.
8. **Run a monthly sweep:** `git worktree prune`, delete merged branches, close stale PRs and archive finished sessions. Then update this file.
