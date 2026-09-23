# UI rules

The short, binding list. Every entry here is either a decision Duke stated
(quoted and dated in `docs/DECISIONS.md`) or a rule the shipped code enforces.
`scripts/check-ui-rules.mjs` checks the mechanical ones on every UI file write.

This file exists because the rules were previously spread across a 200-line
`CLAUDE.md`, a `DESIGN.md` and a decisions log — and agents kept re-deriving
them and getting them wrong. If you change a rule, change it here first.

## Writing

1. **Headings, section titles, buttons and short labels are title case.**
   "Record Book", not "Record book". "Save Lineup", not "Save lineup". Running
   prose (help text, errors, state notices, empty states) stays sentence case.
   Never uppercase a label in the markup. — DECISIONS 2026-09-04, 2026-09-09
2. **A heading names the thing beneath it; it does not caption it.**
   "Title-Winning XI", not "The XI That Won It". "League & Cups", not "How It
   Splits". "Previous Meetings", not "Every Meeting". — DECISIONS 2026-09-04
3. **No eyebrow labels above titles.** No uppercase kicker over a heading.
   — DECISIONS 2026-08-22
4. **"Club Balance", never "FAAB"** in anything a user reads.
4a. **Nothing inanimate performs an action.** A key, button, tab, card,
   dialog, page or rule is never the subject of a verb. Write "Enter to open ·
   Esc to return" or "Press Enter to open", never "Enter opens it". Write "View
   your squad", never "This tab lets you view your squad". "Lets you" and
   "allows you to" are banned outright, and so are status tags like "if it
   holds" ("projected €34m", not "€34m if it holds"). `check-ui-rules.mjs`
   catches the common shapes in app code and in prototype HTML.
   — DECISIONS 2026-09-08

## Surfaces

5. **No white panels floating on the cream ground.** The objection is loose
   white tiles on a blank field. Containers that belong to a composition are
   fine: anchored to a coloured field, carrying real imagery or data, among
   objects of different kinds. Reference: `src/app/(dashboard)/dashboard/` and
   `DESIGN.md` § 3b. — DECISIONS 2026-09-04, 2026-09-15
6. **Only a genuinely bounded object gets a box**: a hero, a board, a table,
   a card that is a link. On cream, `border: var(--line-strong)` +
   `--r-shell` + `--color-bg-card`. Lifted off a coloured field, a shadow
   instead of the border.
7. **Elevation is border XOR shadow, declared once.** A 1px border under a soft
   shadow is the ghost-card tell. — `globals.css`
8. **No coloured accent bars on container edges.** No left stripes, no top
   rules, no gradient header strips, no coloured dots before labels.
   — DECISIONS 2026-08-22
9. **No generic three-card bento rows.** Use one panel with internal hairlines,
   or an asymmetric grid.
9a. **Section heads are more than text.** Give each one an instrument (a
   switch, a status tile, a crest stack, a progress strip) rather than a bare
   title. — DECISIONS 2026-09-15

## Type and colour

10. **Serif for figures you compare; mono only for figures that tick** —
    countdowns, lot numbers, bid clocks, live money. Settled history is serif.
    Labels, column heads and buttons are Hanken Grotesk. Archivo Narrow is
    retired: don't use `--font-condensed` in new work. — DECISIONS 2026-09-23
11. **Reuse `--color-*` tokens.** No raw hex in component CSS.
12. **Both themes are first class**, and WCAG AA is a hard requirement in both.

## Process

13. **Gaffa is not a themed costume.** Don't pitch design as football pastiche.
    — DECISIONS 2026-08-22
14. **Don't invent a named rule and cite it back as Duke's.** If you cannot cite
    a file or a quote, it is `[inferred]`. — `docs/DECISIONS.md`
