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
| Targets and the Board (Listings rework) | Backend built, UI not started, design not final | PR #90 (`worktree-targets-board`); old UI on `claude/inspiring-dewdney-fdb56c` for reference only | A design pass. See "Targets and the Board" |
| Matchups redesign | Shipped 2026-10-24 | `main` (PR #89) | Follow-ups below |
| October update (front page, changelog, perf) | Shipped 2026-10-24 | `main` (PR #89) | Follow-ups below |
| League Home revamp | Built, not merged | `design/league-home-revamp` | Decide whether it's still wanted |
| Cups page | One phone fix shipped; the 2.0 port not started | `main` (PR #88) | A 2.0 port, with Finance |
| Finance page | Not started | None | A 2.0 port, with Cups |
| Gaffa Kit adoption | Shipped in batches | `main` (PRs #59, #67, #78, #80 and the `claude/kit-*` branches) | More batches as needed |

## Targets and the Board

**Backend.** Done, in PR #90: the `player_targets` table, role levels, direct visibility, the targets API, matching, notifications and the route tests. The migrations were renumbered from 153 to 155 and 158 to 179 to 182, because `main` is at 178. The live database already has all of it, applied by hand under the old numbers, with no rows. Don't run the new files against it.

**UI.** Not started. The plan is `docs/superpowers/plans/2026-10-24-board-ui.md`. The older UI on `claude/inspiring-dewdney-fdb56c` predates the Board spec and is reference only.

**Design.** On 2026-09-22 Listings and Targets became one tab, the Board (spec: `docs/superpowers/specs/2026-09-22-transfer-board-design.md`). On 2026-10-24 Duke said nothing about Targets is final, so the prototypes (the Targets C canvas, and the Market prototype on `docs/board-spec`) are a starting point, not the spec. A design pass comes before any Board UI.

**Open decisions:** what is still unsettled in the design; the tab name ("Board" is a placeholder); whether redraft leagues, which have no listings, get the Board; and what a direct target does when the player's club is a Caretaker.

**Unrecoverable work.** `stash@{3}` (Futbolpedia outlook infra) and `stash@{4}` (scratch files and a duplicate migration 121) are not backed up anywhere. The two Targets stashes are saved as patches on `backup/stash-diffs-2026-10-24`.

## Matchups redesign and the October update

PR #40 merged the matchups redesign, PR #41 reverted it on 2026-10-12, and PR #89 restored it on 2026-10-24 together with the public front page, the October changelog, and the player-card and bootstrap perf work. Review fixes made on the way: pitch-stripe scoreboard, swipeable Lineups, bench rows that expand, a Club Balance menu that opens on click only, and a gameweek selector on the kit `Picker`.

Follow-ups:

- **Login carousel.** `AuthShowcase` still draws the old matchup pitch: it imports `MatchupPitch.module.css`, and the component it copied is gone. Update it to the redesigned matchups and the new front page. Until then the carousel shows the previous design.
- **Matchup scoreboard background.** Settled on 2026-10-24: one fixed background (`.hx` in `gw.module.css`), the pitch's mown stripes in `--color-pitch` and `--color-pitch-band`. Duke chose it from three options after a club-colour blend, a near-black ink and a deep green each failed. The crests carry the clubs' colours. `clubColour()` in `matchupView.ts` is still computed but no longer used by the scoreboard.
- **A brief slider-like flash** on League Home and Matchups was not reproduced. The Club Balance hover menu was the likely cause and now opens on click only. If it persists in a normal browser window, it is the loading bar or skeleton, or the pane resizing.

## Home page

- **League Home revamp**: `design/league-home-revamp`, one commit (2026-09-16), pushed but not in `main`. Undecided.
- **Public front page**: shipped (PR #89).
- **Matchweek stepper and fixtures grouped by day**: shipped.

## Open pull requests

| PR | Title | Note |
|---|---|---|
| #90 | Targets backend and the Board UI plan | One check pending when opened |
| #42 | Preview any worktree in the Browser pane | Preview tooling, mergeable, undecided |

## Cleanup debt

- About 11 worktrees remain, all for unmerged work: Targets, League Home, scoring V3, FC27 sweep, preview tooling and similar.
- `feat/scoring-v3` is 16 commits ahead of `main`. Scoring V3 is on hold; see the project memory.
- `worktree-lineup-builder-ratings` (7 commits ahead) is the blue ratings ramp. Check whether it already shipped through another branch.
- Roughly 40 sessions with no PR are still unarchived. Some are probably finished.

## Rules for working

1. **One feature, one session, one worktree, one branch, one PR.** Give all of them the same name, for example `targets-board`. Edit only inside a worktree, as the root `CLAUDE.md` requires. Never leave uncommitted work in the main folder.
2. **Commit as you go.** Work that exists only as untracked files or a stash gets lost. The Targets backend almost was.
3. **Push the branch the day you create it.** `release/2026-10-09` lived only on one laptop for two weeks.
4. **Write a handoff note for every feature that spans sessions.** Use `docs/superpowers/plans/2026-09-10-targets-handoff.md` as the pattern: where the work stands, what went wrong before, the open decisions, and the files. Link it from the feature's row above.
5. **Label prototypes as prototypes.** A session title or a row in this file should say "prototype, not built" so nobody reads it as in-progress code.
6. **Check every branch before numbering a migration.** The command is in the root `CLAUDE.md`. Parallel branches have already collided on 153, 154 and 166.
7. **Group sessions in the sidebar by feature**, and archive a session once its PR shows MERGED. Start sub-sessions from the feature's main session so they link as a family.
8. **Run a monthly sweep:** `git worktree prune`, delete merged branches, close stale PRs and archive finished sessions. Then update this file.
