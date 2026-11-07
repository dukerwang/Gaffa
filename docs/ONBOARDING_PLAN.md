# Trying Gaffa Before Joining a League

**Status:** Proposal for Duke, 2026-11-07. Nothing here is built. Pick the first piece and it gets a Claude Design prototype before any code.

## The problem

Duke (2026-11-07): "we should give new users the opportunity to see what gaffa is actually about, and what they can do in gaffa before they make that commitment." He also asked for "a more interactive help/tutorial for in-game systems like the transfer system, setting lineups, etc."

The people this is for mostly arrive from outside with no invite code. Since 2026-07-01 there have been 9 real signups, 7 of whom joined a league, and none since 2026-08-30. A visitor without a code today can read the front page, open the Lineup Builder, or create a league alone. A signed-in user with no league sees the same front page at `/dashboard` (`src/app/(dashboard)/dashboard/page.tsx` renders `PublicHome` when there are no league cards), so anything added to the front page reaches both groups.

## What I recommend, in order

Each piece is small, ships on its own, makes no API calls once the page has loaded, and uses one pinned example with famous players.

### 1. A mini auction: bid for Barcola

**What it shows.** The transfer market, which is the least familiar of Gaffa's three differences and the one most likely to read as "too complicated" in prose. The visitor is a club in a six-club league with a Club Balance. Barcola arrives in the Premier League, valued at €90m, and his lot opens at the 60% floor. Two scripted rival clubs bid against the visitor. The visitor raises, gets outbid, sees the clock extend, and either wins or lets him go. The end screen shows where the money went (the 20% that returns to the league, split among the clubs that lost) and what the real Gaffa auction paid: €164m, the figure already pinned on the front page's Transfer Wire.

**Why first.** It carries a differentiator, it teaches the system people are least likely to have met elsewhere, and it is entirely new, so nothing shipped gets redesigned. The example is already Duke-approved front-page material (`EXAMPLES.arrival` in `src/lib/publicHome/loadShowcase.ts`).

**Where it lives.** A public route (working name `/try/auction`), linked from the Transfer Wire section of the front page. It reuses the shipped auction card parts rather than drawing new ones; the prototype decides which.

**Cost.** One static page. The script, rivals and figures are constants in the bundle.

### 2. A mock draft with no league

**What it shows.** The first thing every league does. The room already exists and runs entirely in the browser against bots (`src/app/(dashboard)/league/[leagueId]/draft/mock/`); it only needs a league for its roster size and team count, and to check membership. The pool carries last season's Gaffa points and ratings beside every player, and one tap sorts by them, so the visitor sees centre-backs and midfielders among the forwards at the top without a sentence of explanation. (The default sort is draft rank; whether a demo should open on points is a prototype question.)

**Why second.** Least new code of any option: a public route with default settings, the setup screen rewritten for someone who has no league ("Back to lobby" links today), and a door from the front page. The pool read is already cached across leagues (`loadDraftStatsForSeason` uses `unstable_cache`), so the route adds almost nothing to Vercel or Supabase.

**Not a redesign.** The room is shipped and stays as it is. Only the setup screen and the exits change.

### 3. First-visit hints on the real pages

**What it shows.** For managers who have joined: their first lineup, first bid and first trade offer. Each hint appears only when it applies, once, and is dismissed once, the same as the economy reminders. The lineup hint covers what the public Lineup Builder can't: bench categories, exact-position cover (a bench CB never covers an LB) and auto-subs.

**Why third.** It serves people already inside a league, and none have arrived since August. It matters most just before the summer launch.

### Not now

- **A guided mode on the public Lineup Builder.** It has no bench and doesn't enforce position eligibility, so it can't teach the rules that trip people up without turning a sharing tool into a rules engine. The lineup lesson belongs on the real lineup page (piece 3).
- **A tour after signup.** A no-league signup already lands on the front page; once pieces 1 and 2 have doors there, that page is the tour.
- **A practice league against Caretaker clubs.** Real value, but it creates leagues, teams and matchups in the database for every visitor. Revisit only if the first three don't move the numbers below.

## How to tell if it works

`scripts/funnel.mjs` (PR 119) counts signups, joins, full leagues, finished drafts and return visits, but it can't see anyone before an account exists. Two additions, both free to run:

1. **Tag the signup.** Each demo writes a local flag when finished (for example `tried: ["auction", "draft"]`). The signup form already makes a request; it sends the flag along, and it's stored on the new user's row (one nullable column, added when piece 1 is implemented). `funnel.mjs` then splits every stage by "tried a demo first" or not.
2. **Compare stages, not totals.** The questions are whether people who finish a demo sign up, then create or join a league, then finish a draft, at a higher rate than people who don't. For piece 3, the measure is the first-lineup rate already in the funnel.

At today's volume (no real signups since August) the first readings will be anecdotes. The first honest comparison is the summer launch, so the tagging should ship with piece 1, not after it.

## Constraints every piece follows

Prototype in Claude Design first, then port it faithfully. Never rebuild the pitch or the player card. Start from the dashboard's composition (`DESIGN.md` § 3b) and design mobile and desktop separately. Carry meaning with portraits, crests, position colours and state, not captions. One pinned example per feature. No claim of "first". Copy follows the `gaffa-ui-copy` rules: Title Case labels, names rather than narration, no UI element as the subject of a verb.
