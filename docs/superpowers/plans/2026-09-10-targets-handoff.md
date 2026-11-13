# Targets — handoff

Written 2026-09-10, at the end of the design pass. Pick this up in a fresh
session and you should need nothing from the old transcript.

**Read first, in this order:** `docs/UI_RULES.md`, `docs/DECISIONS.md` (the
2026-09-10 entry is this work), `DESIGN.md`, then the spec at
`docs/superpowers/specs/2026-09-04-targets-design.md` and the task plan at
`docs/superpowers/plans/2026-09-04-targets.md`.

**The prototype:** https://claude.ai/code/artifact/32dddd71-286d-441a-a1bf-04d30e010a4e

## Where the work stands

Tasks 1–5 and 8 of the plan are done and on disk (all untracked, branch
`feat/projected-points`). Task 6 — the design prototype — is what this session
did, and it is **not yet signed off**. Task 7 (UI) and Task 9 (guide + verify)
have not started.

Do not start the port until Duke picks a layout. See "Open decisions".

## What went wrong before, so it doesn't repeat

The previous prototype was rejected. The causes were specific and all of them
are checkable:

1. **It used custom properties it never declared.** `--shadow-card`,
   `--shadow-sm` and `--r-pill` appeared in all seven artboards and were
   defined in none, so the cards rendered flat and the rail pills rendered
   square. Duke was judging a render that didn't match its own source. Run the
   undefined-variable check in `build.mjs`'s directory before every publish.
2. **It cited rules that don't say what it claimed.** A comment justified
   shadow-over-border with "rule 7", which forbids doubling up and picks no
   side; `docs/DECISIONS.md` 2026-09-04 does pick, and picks border. A canvas
   annotation asserted "what they must not share is a bare serif title over a
   rule", which is the exact pattern Duke decided on. Do not invent a rule and
   attribute it.
3. **It re-answered questions the sibling component had already settled.**
   `ListingCard.module.css` carries measured decisions on elevation, state,
   stance chips and money typography. The prototype re-derived each one and got
   each one backwards.

## The design, as it now stands

**The board is rows, not cards** — see the DECISIONS entry for why. Two layouts
are drawn and one has to be chosen:

- **A — Sectioned rows** (`Main.dc.html`). Three sections, each a serif title
  over a 2px `--color-text-primary` rule with flat rows beneath and no box
  (UI_RULES 5, the `_home/home.module.css` `.sect` pattern). Wanted From You /
  The Board / Your Targets.
- **B — One flat table** (`Table.dc.html`). One bounded board with column heads
  (UI_RULES 6). Denser by roughly 150px, but nothing tells you which rows
  concern you except the row tint.

Duke said he "likes the idea of A". He has not committed.

**The section rule, in A:** can you answer this target from your squad? Yes and
it goes under Wanted From You **with buttons**; no and it goes on The Board
**with none**. The section and the buttons must never disagree — an earlier
draft applied this by hand and Duke caught the inconsistency immediately.

**Everything else ports from Listings, not from scratch:**

| Element | Source to copy |
|---|---|
| Masthead, stats, tools bar, facet chips | `transfers/listings/listings.module.css`, `ListingsClient.tsx:196-238` |
| Sub-nav item and count | `TransfersSubNav.module.css` — counts are tabular, never mono |
| Section title over an ink rule | `_home/home.module.css` `.sect` |
| Stance chip grammar | `ListingCard.module.css` `.gate` — outlined, condensed, accent only for cash, dashed border for an absence |
| Position chip beside a name | `.g-namerow` in `globals.css`, never `align-items: center` alone |
| Money | serif and tabular when settled, mono only when it ticks |

**Buttons:** two fixed tracks (`grid-template-columns: repeat(2, minmax(0,1fr))`)
so secondaries line up down one column and primaries down the next, whatever a
row offers. Labels stay one word — Offer, List, Message, Bid, Edit, Withdraw —
for the same reason ListingCard's do. Row buttons are uppercased in CSS so the
Title Case rule doesn't reach them; `Add Target` and `Post Target` render as
typed and do.

**Visibility on the board** takes no extra room and no tag line. Under Your
Targets the first column holds the audience instead of your own club name.
Elsewhere it stays blank unless the answer is something other than the league.

## What the new visibility needs in code

`visibility` becomes `'public' | 'direct' | 'private'`. Everything below is
unbuilt.

- **Migration.** Widen the CHECK on `player_targets.visibility`. `direct` is
  only valid where `target_kind = 'player'` — a role target has no owner —
  so fold that into the shape CHECK the way `155` folded in `role`.
- **RLS.** The select policy gains a third clause: `visibility = 'direct'` and
  the targeted player sits on a roster belonging to `(select auth.uid())`.
  Realtime honours RLS and the board subscribes, so this policy is the only
  thing keeping a direct target off other managers' screens. Test it in SQL
  against two accounts, not through the UI.
- **It follows the player.** The policy reads `roster_entries` live, so trading
  Palmer away re-points the target at his new owner. That matches the existing
  rule that a target survives its player changing clubs.
- **Notifications.** A direct named target notifies the owner exactly as a
  public one does. Creation only; edits never re-notify.
- **Caps.** Direct counts against the 10 active per club but not against the 5
  public, since it never reaches the board.
- **The sub-nav count changes.** It was "public targets in the league". It has
  to become public targets plus direct ones aimed at you, or you get a
  notification with no badge behind it.

## Open decisions

1. **Layout A or B.** Blocking. Nothing else in Task 7 should start first.
2. **Which visibility the editor opens on** for a named target. Currently drawn
   with "Only Holloway Utd" preselected, on the reasoning that a named target
   is usually a specific approach and broadcasting intent should be deliberate.
   Duke has not ruled.
3. **The spec still says "profile".** Update
   `2026-09-04-targets-design.md` to say "role", document the `role` column and
   the third visibility, and note that it now follows the code. Migrations
   `155` and the new one are the source of truth.

## Files

**Prototype source** (copied into the repo so it survives the session):
`scratch/targets-prototype/`
— `build.mjs` emits all seven artboards from one shared CSS block, `canvas.json`
lays them out. Re-seed with the `design` skill's `seed-canvas.mjs` and republish
to the artifact URL above. Never hand-edit the seeded `.html`.

**Already written, untracked:**

```
supabase/migrations/153_player_targets.sql
supabase/migrations/154_fill_targets_on_acquisition.sql
supabase/migrations/155_target_role.sql
src/lib/transfers/targetStance.ts       + __tests__/
src/lib/transfers/targetRole.ts         + __tests__/
src/lib/transfers/matchTargets.ts       + __tests__/
src/lib/transfers/notifyTargetMatches.ts
src/lib/transfers/targetLimits.ts
src/app/api/leagues/[leagueId]/targets/route.ts
src/app/api/leagues/[leagueId]/targets/[targetId]/route.ts
```

`npm run build` and `npm test` both have to pass before Task 7 is called done,
and the plan's Task 9 spot-check list still applies in full.
