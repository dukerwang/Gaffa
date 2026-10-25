# Cups Redesign — Design

**Date:** 2026-10-25
**Status:** Approved in conversation, not built.
**Deadline:** Live before MW16 (Sat 19 Dec 2026), when the first cup ties of the season are played.
**Scope:** A ground-up rebuild of the Cups page, a new page for each cup tie, round-by-round League Cup draws, and a working Consolation Cup in small leagues.

---

## Why

The Cups page (`src/app/(dashboard)/league/[leagueId]/tournaments/`) is the last page still on 1.0. It has a bare serif heading, an uppercase data line under it, and a bracket of text boxes that only scrolls sideways. It shows no crests, no trophies and no prize money, and nothing says why a level tie went through. Duke calls cups one of Gaffa's three pillars ("the cups system (multiple trophies)", 2026-09-29), and the page doesn't look like one.

The live data made three further problems clear. All of them were checked against the database on 2026-10-25, at MW8:

- **The Champions Cup and League Cup draws are identical in a 6-club league.** Both cups take all six clubs, and both are seeded from the same table on the same day. In Matchday Militia and in Dynasty Dragoon the two brackets match tie for tie, with the same two byes. That is one story told twice.
- **The Consolation Cup can't finish in a small league.** A 6-club league creates it with four empty places: semi-finals at MW36–37 and a final at MW38. Only the two Champions Cup semi-final losers are sent into it (`advanceTournament.ts`, the consolation cascade). They fill one semi-final. The other never gets a club and never resolves, so the final never gets a second club and the cup never completes. A 4-club league looks for a round starting at MW36 that its bracket doesn't have, so nobody is ever sent in.
- **For half the season the page has nothing played to show.** The first cup tie is the League Cup quarter-final at MW16, and the Champions Cup starts at MW32. The page has to work as a page about what's coming, not only about results.

## Decisions

Each was chosen by Duke in this conversation on 2026-10-25, from mockups built on Matchday Militia's real data.

| Decision | Choice |
|---|---|
| Scope | The page and the mechanics behind it |
| League Cup draw | Round by round: each round is drawn at random once the one before it finishes (FA Cup style). No fixed path through the bracket |
| When it starts | This season. This season's quarter-finals (MW16) stand as published; the semi-finals are the first drawn round. Duke: "since no cups have started, now is a good time. just want to have a set and working system before the cups start" |
| Consolation Cup, 6 clubs | Both Champions Cup quarter-final losers and both semi-final losers (four clubs) |
| Page composition | Trophy Shelf (option A of three) |
| Draw layout | Round Pager: one round per page, swiped sideways (chosen over Round Columns) |
| Seeds | A seed column before the crest on Champions Cup ties; no seeds on League Cup or Consolation Cup ties |
| Tapping a tie | A full tie page built from the matchups redesign |

On the original seed formatting, Duke asked, "why does it look so ugly." The seed sat beside the "v" in a mirrored home-v-away row, so "3 v 6" read as a scoreline.

What doesn't change: who enters each cup, the cup schedules, two-legged rounds, the best-performer tie-break, the prize money, and the Champions Cup's seeded fixed bracket.

---

## 1. Mechanics

### League Cup: round-by-round draws

- The first round is generated as it is today: seeded, with byes to the top seeds. Byes still reward a high finish.
- League Cup ties don't link to the next round. `createTournaments.ts` stops setting `next_matchup_id` for `secondary_cup`, and the migration clears it on every existing League Cup tie in a tournament that isn't `completed`. This is the only change to this season's League Cup data. No published pairing or result changes.
- When the last tie of a round is `completed`, the next round is drawn by `draw_cup_round` (below). Its pool is the `winner_id` of every tie in the round before, and a bye counts as a tie the bye club won.
- **Last-resort tie-break.** Today a dead-level tie (a 0–0, or best performers level) goes to `team_a` (`executeAdvanceTournament`, "Fallback: higher seed (team_a) wins"). In a drawn round, the club higher in `league_standings.rank` at the moment of the draw is placed as `team_a`. The existing fallback therefore means "higher league position" without any change to the tie-break code.

### `draw_cup_round(p_round_id uuid)`

A Postgres RPC. Three paths can resolve a gameweek (the resolve cron, the stats sync, and a plain page load on matchups), so the draw has to be atomic and idempotent.

1. Lock the round row `FOR UPDATE`. Return without changes if `drawn_at` is set.
2. Build the entrant set. If the tournament has a round before this one, use the winners of that round, and refuse (return without changes) unless every tie in it is `completed`. Otherwise (a Consolation Cup's first round), use the clubs already placed in this round's ties.
3. Order the entrants at random (`ORDER BY random()`). If there are fewer entrants than places, the highest-placed entrants by league rank take the byes.
4. Pair the entrants in order across the round's ties by `bracket_position`. Within each tie, the higher-placed club is `team_a`. A tie with two clubs is set `active`. A bye tie is set `completed` with the bye club as `winner_id`, and if the tie has a `next_matchup_id` (the Consolation Cup keeps its fixed links after its one draw), the bye club is placed in that tie the way `advanceWinner` places a winner.
5. Set `drawn_at = now()` and return the pairings, so the caller can notify.

`executeAdvanceTournament` calls it after finalizing a round's ties on that round's `end_gameweek`:

- **League Cup:** draw the next round, if there is one.
- **Consolation Cup:** its first round is drawn from the **Champions Cup's** advance, right after the Champions Cup semi-final losers have dropped in. By then every expected entrant is in. This doesn't apply to a 4-club league, whose Consolation Cup is a single final (see below).

Only the League Cup's later rounds and the small-league Consolation Cup's first round are drawn. The Champions Cup, every League Cup first round, and the 7+ club Consolation Cup are generated and linked as they are today.

**Notification.** After a draw, each manager drawn into a tie gets an in-app and push notice through `createNotification`, for example "League Cup semi-final draw: you play **Hayden FC** over MW21 and MW24." A bye reads "League Cup semi-final draw: you have a bye to the final." Caretaker clubs are skipped, as `createNotification` already does.

### Consolation Cup in small leagues (4–6 clubs)

Entry is fed by Champions Cup losers. The drop-in code looks up the Consolation Cup's **first round** (lowest `round_number`) instead of the round with `start_gameweek = 36`, and places each loser in the first empty place, as it does now.

| Clubs | Who drops in | Consolation bracket |
|---|---|---|
| 6 | Champions Cup QF losers (after MW33) and SF losers (after MW35): 4 clubs | Semi-finals MW36–37 (two legs), final MW38. Drawn after MW35 |
| 5 | The QF loser and both SF losers: 3 clubs | Semi-finals MW36–37, final MW38. Drawn after MW35; the highest-placed gets the bye |
| 4 | Both SF losers: 2 clubs | A single final at MW38. No draw; the higher-placed club is `team_a` |

The 6-club change is that quarter-final losers now drop in, where today only semi-final losers do. The 5-club entry rule is unchanged; it gains the draw and the bye. The 4-club rule is unchanged, but its lookup is fixed. Both live leagues already have four Consolation places, so their data needs no change.

Leagues of 7 or more clubs are unchanged: the bottom two enter the Consolation Cup from the start.

### How a tie was decided

`tournament_matchups.decided_by text` takes `'score'`, `'best_performer'` or `'position'`. `executeAdvanceTournament` writes it when it sets `winner_id`. The UI derives the label for `'position'` from the round: "League Position" if the round has a `drawn_at`, "Seeding" if not.

### Migration 183

The next free number across every branch, checked 2026-10-25 (head was 182). Confirm again before applying.

- `ALTER TABLE tournament_matchups ADD COLUMN decided_by text CHECK (decided_by IN ('score','best_performer','position'))`
- `ALTER TABLE tournament_rounds ADD COLUMN drawn_at timestamptz`
- `CREATE FUNCTION draw_cup_round(p_round_id uuid)`
- Clear `next_matchup_id` on League Cup ties in tournaments that aren't `completed`.

It's additive apart from the link clearing, which removes no team, score or result.

---

## 2. The Cups page

Same route, `/league/[leagueId]/tournaments?cup=<id>`. It's rebuilt on the 2.0 tokens and the kit. The name-patching in `page.tsx` (renaming `primary_cup` and `consolation_cup` at render time) and the bespoke 1.0 CSS both go.

### The shelf

A green field (`--color-topbar` ground) runs edge to edge under the topbar, using the dashboard's bleed (`.shelf`, outset `border-image`). It holds:

- The heading **Cups**, in cream serif.
- The three trophies, ordered Champions Cup, League Cup, Consolation Cup, using the shipped `Trophy` component (`src/components/trophies/Trophy.tsx`, the Great Cup, the Tall Cup and the Shallow Bowl). The ribbons take the viewer's club colours from `crest_config`.
- Each trophy is a link that selects its cup (`aria-current` on the selected one). The selected trophy is fully lit with a cream underline; the others drop to about 55% opacity.
- Under each trophy, its short name and the viewer's status in it. A status must never wrap:

| Status | When |
|---|---|
| `QF · MW16` | Your next tie in this cup, by round abbreviation and its first matchweek |
| `Bye to SF` | You hold a bye into the next round |
| `Out · QF` | You lost in that round |
| `Winner` | You won it this season |
| `Runner-Up` | You lost the final |
| `From MW36` | A Consolation Cup you could still drop into |
| `Not Entered` | A cup you can't play in this season (for example, the bottom two in a 7+ club league's Champions Cup) |
| `Drawn at MW7` | First season, before brackets exist |

The page opens on the cup where the viewer's next tie comes soonest, then the first active cup, then the Champions Cup. `?cup=` overrides it.

### Next Tie card

A card lifted on shadow, with no border, overlapping the shelf's lower edge, for the selected cup:

- **Upcoming:** both crests (44px) and names, "v", the round and matchweek, and the date ("Quarter-Final · MW16", "Sat 19 Dec").
- **Live or played:** serif scores at `--t-32` in place of "v". A two-legged tie shows the aggregate, with Leg 1 and Leg 2 beneath.
- **Knocked out:** the tie that put the viewer out, with its score.
- **Cup finished:** the winner's crest and name.

The whole card links to the tie page.

### Round Pager

**The strip.** It's the section's instrument and doubles as its tabs: one tab per round, each with the round name and its matchweeks ("Semi-Final", "MW21 · 24"), and an ink underline on the current one (`role="tablist"`).

**The pages.** Below the strip, one page per round (`role="tabpanel"`). Each page is `calc(100% - 40px)` wide, so the next one shows at the edge. They use `scroll-snap`, driven by `useSwipePager` from the gameweeks redesign (`src/components/gameweeks/useSwipePager.ts`). Today it tracks exactly two cards (Team Sheets, Lineups), so it gets generalized to N pages: one intersection ratio per page, with the active page being the most visible. Its two existing callers keep their behaviour. The strip follows the swipe and the pager follows a tap. The pager opens on the round the viewer is in, or else the current round. Under `prefers-reduced-motion`, tapping a tab jumps instead of scrolling.

**Each page** opens with its date line ("Sat 19 Dec", "Two Legs · Sat 16 Jan & Sat 6 Feb") and then shows:

- **Tie cards:** two stacked lines of crest (24px), name and score, separated by a hairline. They replace the mirrored home-v-away row. The Champions Cup adds a narrow seed column before the crest, set in `--font-label` and muted, aligned down the round like a rank column.
- **Byes:** a tie card whose lines carry a "Bye" tag in place of a score.
- **Undrawn rounds:** the clubs already through, tagged "In", then one dashed "?" line per open place, named for where it comes from. That's "Not Too Xabi or tottenyang FC" for a pending tie's winner, "Semi-Final Winner", or "Champions Cup QF Loser" in the Consolation Cup. A League Cup round still to be drawn adds the sentence "Drawn at random once the quarter-finals finish."
- **Your tie:** a `--color-green-50` ground with a `--color-green-200` keyline, and your club's name in accent.
- **Live ties:** the existing live tally marker.
- **Finished ties:** the winner in full ink and the loser muted. A tie decided below `score` adds a small tag: "Best Performer", "League Position" or "Seeding".
- **The Final page:** adds the prize line, from the league's prize config ("Winner €25m · Runner-Up €10m").

Every tie card with two clubs links to its tie page.

**Scores.** Two decimals, matching Home and matchups. No "0.0" before a tie is played.

### Desktop (≥ 900px)

The shelf widens, with trophies at about 140px tall, and the Next Tie card sits beside the trophies rather than below them. The pager becomes columns, with every round side by side and the strip still above them. The mobile and desktop layouts are composed separately, per DESIGN.md §3b.8.

### Live scores

`tournament_matchups` scores are only written when `executeAdvanceTournament` runs. During a live gameweek, the page reads each side's score from that club's league matchup for the gameweek. That's what `scoreLeg` already does when it scores a cup leg, so the two always agree. The page refreshes through a Supabase Realtime subscription on `matchups` for the league, the same pattern as `LiveRefresh` in `src/components/gameweeks/Views.tsx`. There's no polling.

### Loading

A `loading.tsx` with real labels and shapes for the data (the kit's option A, decided 2026-10-23), laid out in the page's own CSS module: the shelf with three trophy-shaped blocks, a Next Tie block, and the strip and two tie-card blocks.

---

## 3. The tie page

**Route:** `/league/[leagueId]/tournaments/[tieId]`, reached from any tie card or the Next Tie card. It has a back link to the Cups page with `?cup=` set.

**Data.** A cup tie has the same shape as a league matchup, but its two clubs usually aren't each other's league opponent that week. So each side is loaded from that club's own league matchup for the gameweek. `loadMatchupView` (`src/lib/matchups/matchupView.ts`) is split so that one side can be loaded alone (a `loadSideView(teamId, gameweek)`), and `loadTieView` builds a `MatchupView` from the two sides.

**Layout:**

- **Head:** the cup's trophy pip with "League Cup · Quarter-Final", then the big `Scoreboard` with crests, scores, matchweek, and the deadline or live state.
- **Two-legged ties:** the Scoreboard shows the aggregate with each leg beneath it, and kit Tabs (Leg 1 · MW21, Leg 2 · MW24) switch the lineups and team sheets below. The tabs default to the latest leg that has started.
- **Level ties:** one line under the Scoreboard. For example, "Level at 54.30. Through on best performer: Saka 14.2 v Palmer 11.8", or "Level at 0.00. Through on league position." Each side's best performer comes from its loaded side view.
- **`Lineups` (row pitch) and `TeamSheets`** for the selected leg. The player card opens on tap, as on matchups.
- **Upcoming ties:** `HeadToHead` (Previous Meetings) and each side's saved or projected XI, as on an upcoming league matchup.
- **Live:** the same Realtime refresh, subscribed to both clubs' league matchups.

Left out for now: `Momentum` and `Report`. Both are built around a single league matchup's minute-by-minute data and narrative.

---

## 4. Code layout

| Path | What |
|---|---|
| `src/lib/cups/cupsView.ts` | Pure view builders: shelf statuses, Next Tie, round pages, slot labels, decided-by labels. No I/O |
| `src/lib/cups/loadCupsPage.ts` | Reads for the Cups page, in parallel waves as the current page does |
| `src/lib/cups/loadTieView.ts` | Reads for the tie page, on top of the split `loadMatchupView` |
| `src/components/cups/` | `TrophyShelf`, `NextTie`, `RoundPager`, `TieCard`, one `cups.module.css` |
| `src/app/(dashboard)/league/[leagueId]/tournaments/page.tsx` | Rewritten on the above |
| `src/app/(dashboard)/league/[leagueId]/tournaments/[tieId]/page.tsx` | New |
| `src/lib/tournaments/advanceTournament.ts` | Calls the draw, writes `decided_by`, uses the new Consolation drop-in |
| `src/lib/tournaments/createTournaments.ts` | No `next_matchup_id` for `secondary_cup` |
| `src/components/gameweeks/useSwipePager.ts` | Generalized from two cards to N pages |
| `supabase/migrations/183_cup_draws.sql` | Section 1 |

Removed: `src/components/tournaments/BracketMatchup.tsx` and `tournaments.module.css`. The public front page's Cups slide (`src/components/auth/AuthShowcase.tsx`, `CupsBracketVisual`) imports `BracketMatchup` with a pinned demo tie, so it moves to `TieCard` with the same pinned example (fixed examples, decided 2026-10-08).

Copy follows `docs/UI_RULES.md`: Title Case names and labels, sentence-case prose, no eyebrows, no inanimate agency, "Club Balance" for money. `scripts/check-ui-rules.mjs` runs on every write.

## 5. Testing

Vitest, under `src/lib/cups/__tests__/` and `src/lib/tournaments/__tests__/` (both inside the existing `vitest.config.ts` glob):

- **Draw:** the pool is the prior round's winners, byes included. `team_a` is the higher-placed club. A second call changes nothing. It refuses while a prior tie is unfinished. Byes go to the highest-placed when entrants fall short. The pairing logic lives in TypeScript (`pairDraw(entrants, ranks, places, random)`) with an injectable random source, so tests are deterministic. The RPC mirrors it, and a test asserts that both produce the same pairing for a fixed order.
- **Consolation:** entry and completion for 4, 5 and 6 clubs, including a full 6-club season run from Champions Cup quarter-finals to a completed Consolation final.
- **`cupsView`:** every shelf status in the table above, the undrawn-slot labels, the decided-by labels, and the default cup selection.
- **Routes:** the Cups and tie pages' loaders through `src/test/supabaseFake.ts`.

**Verification before handover:**

- `npm run build` passes.
- Both pages render at 390px and 1440px in both themes. Check them against the E2E 10-club league (completed cups: real scores, a decided-by tag, a won trophy) and Matchday Militia (nothing played yet, byes, undrawn rounds).
- The renders are shown on the Vercel branch preview.

## 6. Rollout

1. Migration 183 and the mechanics, with their tests. Merge and deploy.
2. The Cups page and the tie page. Merge and deploy.
3. Docs:
   - Update `docs/USER_GUIDE.md` §6 for the open League Cup draw, the Consolation Cup in small leagues, and the "In a small league…" paragraph.
   - Add a 2026-10-25 entry to `docs/DECISIONS.md` with the choices above, quoted.
   - Update the CLAUDE.md domain rule on cup ties if its wording no longer matches.

Both stages land before MW16 (Sat 19 Dec 2026). Nothing in the live leagues changes for managers until the League Cup quarter-finals resolve at MW16 and the first draw runs.

## Out of scope

- Changing who enters each cup, the cup schedules, or the Champions Cup's fixed bracket.
- A draw reveal or animation beyond the notification.
- Past seasons on the Cups page. Heritage's honours board and record book already hold cup history.
- `Momentum` and `Report` on the tie page.
