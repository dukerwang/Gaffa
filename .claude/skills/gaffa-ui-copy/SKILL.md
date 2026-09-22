---
name: gaffa-ui-copy
description: Write or audit Gaffa's user-facing naming — headings, section titles, tab labels, captions, empty states, button text. Use when adding or changing any string a manager reads in the app, and for a whole-app copy sweep. Enforces title case on names, buttons and labels, "name the thing, don't narrate it", and no inanimate agency ("Enter to open", never "Enter opens it"; no "lets you").
---

# Gaffa UI copy

`docs/UI_RULES.md` rules 1–4a are the contract. This skill is how you apply them.

`scripts/check-ui-rules.mjs` already catches title case mechanically on every
write. What it cannot catch — and what this skill exists for — is the difference
between a **name** and a **caption**.

## The one rule that keeps getting broken

**A heading is the name of the thing beneath it. It is not a sentence about it.**

Ask: *if this section were a page in a football almanac, what would the page be
called?* That is the heading. Anything that reads like the start of a commentary
line is wrong.

| Don't | Do | Why |
|---|---|---|
| The XI That Won It | Title-Winning XI | Names the squad, not the story |
| How It Splits | League & Cups | Says what the two figures are |
| Every Meeting | Previous Meetings | The standard football term |
| Not Too Xabi Against the League | Head-to-Head | The section's actual name |
| Cabinets | Trophy Cabinets | Complete noun |
| Also Appeared | Squad | The thing, not what it did |
| What's Happening | Activity | A name, not a question |
| Where Your Money Went | Spending | Same |

Tells that you have written a caption: it starts with How / What / Where / Why;
it contains "it", "that", or "we"; it is a question; it is a full clause with a
verb; it would work as a sentence in a match report.

Empty states are the exception — those *are* sentences ("No trophies yet"), and
they stay sentence case.

## Case

Names take **title case**: "Record Book", "Title-Winning XI", "Previous
Meetings". Minor words stay lowercase: a, an, and, as, at, but, by, for, from,
in, of, on, or, the, to, v, vs, with.

Buttons and short labels take **title case** too: "Save Lineup", "Join League",
"Active Roster". Duke reversed the old sentence-case rule for buttons on
2026-09-09. Never uppercase a label in the markup.

Prose (tooltips, `aria-label`, placeholders, descriptions, empty states, error
messages) stays sentence case and reads as a sentence.

## Nothing inanimate acts

Duke's most-repeated complaint (DECISIONS 2026-09-08). A key, button, tab,
card, dialog, page, board or rule is never the grammatical subject of a verb.
A person does the thing, or the string is an imperative or a plain name.

| Don't | Do |
|---|---|
| Enter opens it · Esc closes | Enter to open · Esc to return |
| This tab lets you view your squad | View your squad (or: Squad Overview) |
| The button submits your bid | Submit Bid |
| An asking price invites offers | Set an asking price to invite offers |
| The clause ends the auction | Meet the release clause to end the auction |
| €34m if it holds | projected €34m |

"Lets you" and "allows you to" are banned outright, even though the generic
`google-dev-style` skill recommends "lets you". Gaffa's rule wins.

Check every sentence you write: find its subject. If the subject is a thing on
screen, rewrite it so a person (you, a manager, a club) is the subject, or turn
it into an imperative.

## Vocabulary

Football-native where football has a word for it: fixture, matchweek, squad,
cabinet, honours, tie, leg, clean sheet. Never "FAAB" in anything a user reads —
it is **Club Balance**. Leagues never "complete"; they cycle.

Gaffa is not a themed costume (DECISIONS 2026-08-22). Football vocabulary, yes;
football pastiche, no.

## Running a sweep

1. `node scripts/extract-ui-copy.mjs --suspect` — the strings most likely wrong,
   as `file:line  kind  text`. Use the bare form for all 341.
2. Judge every row against the rules above. Most rows will be fine; say so
   rather than inventing changes. A rename must be clearly better, not merely
   different.
3. Report as a table: file:line, current, proposed, and the rule it breaks.
   **Do not edit yet** — a copy change is a product change and Duke approves it.
4. On approval, apply, then run `npm run check:ui` and `npm run build`.

Note `title="..."` on a plain DOM element is a tooltip, so it is prose, not a
name. The harvest cannot tell that apart from a component's `title` prop; judge
it by which one it is.

## Adding new copy

Write the name first, before the component. If you cannot name the section in
two or three words, you do not yet know what the section is — that is a design
signal, not a copy problem.
