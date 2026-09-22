# Decisions

Design and product decisions **Duke actually made**, in his own words, with dates.

## Why this file exists

Gaffa is a solo repo, so every commit is authored by Duke regardless of who wrote
the content. That makes git history useless for telling apart *"Duke decided
this"* from *"an agent wrote this and it stuck."*

That gap caused a real problem. On 2026-08-08 an agent wrote the phrase
`Green = Gaffa and "yours"` into `design-2.0/README.md` as a design law. Nothing
recorded that it was agent-authored. Later sessions read it as settled, cited it
back to Duke as his own rule, spread it to roughly twenty places across the
codebase, and then designed *around* the constraint it imposed — including
proposing workarounds for problems the rule itself had created. Duke found it on
2026-08-22 and said: *"it's probably written by claude, not me and i don't want
polluted context that affects your (and future agent) decisionmaking."*

**The rule for agents:** if it is not in this file and you cannot cite a file or
a user message, it is not a decision. Tag it `[inferred]` in `DESIGN.md` and move
on. Do not name it. Do not promote it. Do not cite it back to Duke as his own.

Add to this file only when Duke states something directly. Quote him. Date it.
Do not paraphrase into something more decisive than what he said.

---

## 2026-08-10 — Gaffa is not a newspaper

**Don't frame design work in print or editorial terms.**
> "keep in mind this is gaffa, the dynasty fantasy football platform, not a
> newspaper. the focus should be on elegant and impressive aesthetics but also
> ease of use."

Two requirements, not a style: impressive to look at, easy to use. Football
supplies the references when a visual move needs one — matchday, the crest, the
score bug, the pitch, the twelve-position spine. Print references (mastheads,
datelines, standfirsts, column measure) do not land.

Recorded here on 2026-09-12, a month late. It had been sitting only in agent
memory while `DESIGN.md`'s opening paragraph — agent-authored, tagged
`[inferred]` — described Gaffa as a "European broadsheet sports journal". Two
dashboard redesigns were built as newspapers off the back of that line before
anyone checked it against this quote. The gap is exactly what this file exists
to close: a decision that lives outside the repo does not defend itself.

---

## 2026-08-22 — Design system revision

**"One job per colour" is not binding.**
> "my focus is on making the best ui for gaffa possible, if that can be
> accomplished with more than one green i could not care less."

Supersedes decision 7 in `design-2.0/README.md`, which was agent-authored. Green
may carry chrome, primary action, positive delta, "yours", and success
simultaneously, provided the roles are named and the steps are distinguishable.

**Wingers stay green.**
> "i think we should keep wingers green, and i like the slight tweak you made to
> that color, i didn't like the terracotta color you wanted originally."

Terracotta is rejected. The 178° adjustment is approved — chosen because Duke
likes it, not because any rule requires it.

**Creams get brighter; beige is out.**
> "i think you did good by brightening some of the creams, i think the beigish
> colors we've been using before seem very old and outdated."

Direction of travel on neutrals: brighter, less saturated, less yellow.

**The green topbar stays.**
> "i think i actually ended up liking green topbar"

Reverses his earlier uncertainty about it. It is kept because he likes it.

**No coloured accent bars on container edges.**
> "i also hate colored accented ends by the way, it's by far the most annoying
> generic ai sign to me."

Covers top rules on cards, left-border accent cards, gradient header strips, and
coloured dots before labels.

**No eyebrow labels above page titles.**
> "i don't really love eyebrows as they are a sign of generic ai ui... it felt
> like every page was just an eyebrow header with a white gpanel laid on top of
> a cream background after it."

Also the clearest statement of what was wrong with the 2.0 page architecture:
the eyebrow → title → panel-on-cream pattern, repeated identically on every page.

**Gaffa is not a themed costume.**
> "at the end of the day it's a fantasy football app, made to be accessible for
> everyone... rather than creating a brilliant and sophisticated ui that
> may/may not be inspired by football aesthetics."

Rejects direction proposals framed as football pastiche ("matchday programme",
"the instrument", "the kit"). The target is sophisticated, accessible product UI.

**Prototypes must diverge on the axis that matters.**
> "are these prototypes deliberately devoid of color? aside from spine."

Two of three League Home prototypes were built colour-sparse while "not enough
colour" was the original complaint. Divergence axes must be chosen against the
stated problem.

---

## 2026-08-23 — Squad editor opens next week at this week's last kickoff

Chose league-wide handoff (option A) over per-manager ("your last player has kicked off"):
> "alright yeah just do A."

Earlier: keep the two kickoff locks, but stop gluing the squad page to this week until scores
are final — that window is too small when midweek games roll into a Friday GW.
> "option 1 makes the most sense, i need to think more about choosing A and B."

A is the last Premier League kickoff of the gameweek, same moment for everyone. B would
have flipped each manager when their own last squad player kicked off.

---

## 2026-08-24 — Free-agent auctions settle at the clock

Approved options 1 and 3: free-agent auctions resolve when the bidding clock ends, and the card must not say "ended" until settlement. Kickoff deferral stays for manager listings, trades, loans, drops, and a locked drop-player on a winning bid.
> "ok so you're saying eliminate deferrences altogether. and where are they still - only for trades and stuff like that? i guess that makes sense to me. 1 and 3 is good"

---

## 2026-08-30 — Player hub, and how Futbolpedia data is grounded

**Availability leaves the outlook sidecar; dynasty value is explicit.**
> "availability - agreed" / "dynasty - sure"

**Facets must not be built on Gaffa scoring.** Duke caught `output_profile`
being computed from `fantasy_points`, which breaks the outlook spec's own
firewall.
> "i'm a bit confused, because i really don't know if these should be based on
> gaffa stats... in futbolpedia, wouldn't it be based more off of real life and
> overall rather than last season's gaffa stats?"

This produced the football/league layer split that the hub design is built on.
Note the distinction that survived the exchange is derived-vs-raw, not
Gaffa-vs-real-world: `player_stats` holds real Premier League match data that is
fine to use, plus two Gaffa-derived columns (`fantasy_points`, `match_rating`)
that are not.

**The stats page is a hub rework, not a redesign with an outlook section.**
> "my vision for the new stats page isn't just a simple redesign with an outlook
> section, i'm thinking more of a complete hub rework, like a really indepth
> player page with writing, stats, etc."

**Player-centric, with club and position as filters** rather than their own
sections.
> "i think player centric but it would also be helpful to filter by players from
> a specific club or position, etc."

**Cards are the default index view; the table stays as an alternate.**
> "the default card design looks great"

**The scatter is its own feature, and floor/ceiling is the wrong default.**
> "i also think direction b- landscape is interesting, but i think this is
> honestly a whole other component, definitely not floor/ceiling graph by
> default, maybe like ppg x market value or something. it would be like an
> actual graph stats feature that feels interactive and real data-ey."

**Mobile is a first-class target, not a reflow.**
> "i need everything to also be compatible and operational on mobile also,
> almost like it was designed with mobile too. think apple-design."

Full design: `docs/superpowers/specs/2026-08-30-player-hub-and-index-design.md`.

---

## 2026-09-04 — Heritage hub: surfaces, heading case, and naming

**No white panels floating on the cream ground.**
> "why are we going back to the gpanel look?? i don't know if it's recorded in
> decisions or design md but i don't like the look of that, it's like you're
> taking the cream/white background and adding white cards on top of it. it
> doesn't look like an actual sophisticated page."

Restates the second half of the 2026-08-22 eyebrow quote ("a white gpanel laid
on top of a cream background"), which had only ever been filed under eyebrows.
The positive rule, as League Home already builds it (`_home/home.module.css`):
a section is a serif title over a 2px `--color-text-primary` rule with **flat
content beneath it**, and only a genuinely bounded object — a hero, a board, a
table — gets `border: var(--line-strong)` + `--r-shell` + `--color-bg-card`.
Border, not shadow. `.g-panel` (shadow, no border) is the older device; it is
not the default for a new page.

> **Correction, 2026-09-15.** Only the quote above is Duke's. The paragraph
> after it — title over a 2px rule, border not shadow — was an agent's reading
> of how to satisfy it, and later sessions applied it as his rule. See
> 2026-09-15 below: the complaint stands, and the dashboard answers it a
> different way.

**Headings are title case.**
> "also, what is going on with these headers not being capitalized??? i'm tired
> of it."

Already true in code since `f2552ff2` (2026-08-19, "section headings switched
from sentence case to title case"), but `CLAUDE.md` still instructed agents to
use sentence case, and agents kept following it. That line is now corrected.
Buttons stay sentence case. (Reversed 2026-09-09: buttons are title case too.)

**Name things; don't narrate them.**
> "instead of saying soemthing human like "Title-Winning XI" or "The
> Champions", i don't know, you want to do this weird wording like "the xi that
> won it" "how it splits" ... why don't you actually try to just word things
> properly"

A heading is the name of the thing beneath it, not a caption about it. This is
not a `google-dev-style` requirement — that guide asks for plain, concrete
labels, which is the opposite of what was written.

---

## Earlier — recorded from CLAUDE.md and docs/USER_GUIDE.md

These predate this file and are load-bearing product decisions, kept here as
pointers rather than restated:

- **"Club Balance", never "FAAB"** in user-facing copy; uncapped, never rendered
  as a spent/remaining meter. (`CLAUDE.md`)
- **Twelve tactical positions, exact-position eligibility.** A bench CB never
  covers an LB slot. (`docs/USER_GUIDE.md`)
- **The draft happens once per league, ever.** No seasonal re-draft.
  (`docs/USER_GUIDE.md`)
- **Two themes are both first-class**, and WCAG AA is a hard requirement in both.
  (`PRODUCT.md`)

---

## 2026-09-08 — No inanimate agency in copy

**Keys, tools, and UI objects do not perform actions.**
> "making inanimate objects the subject of verb is one of the most pervasive and
> telling LLM-isms I can't un-notice it... a person would have written 'enter to
> open, esc to return, ctrl+c twice to quit'... i realize this is such a pervasive
> thing in gaffa and it pisses me the fuck off, it's so annoying."

- **Affordances**: Keyboard shortcuts and interaction hints must use infinitive purpose (`Enter to open · Esc to return · Ctrl+C twice to quit`) or direct imperatives (`Press Enter to open`), never keys or tools as active subjects (`Enter opens it`, `Escape closes`).
- **No UI agents**: UI elements (tabs, buttons, cards, dialogs, rules) must never be the grammatical subject of verbs like `shows`, `opens`, `closes`, `lets`, `allows`, `invites`, or `executes`.
- **Ban "allows you to" and "lets you"**: State user agency directly (`View your squad`, not `This tab lets you view your squad`).
- **No anthropomorphized status tags**: Avoid pseudo-passive tags like "if it holds" in metrics and captions — use concise sports-journal copy (`projected €34m`, not `€34m if it holds`).


---

## 2026-09-09 — Title Case for UI labels and buttons

**Buttons and labels are capitalized, not sentence case.**
> "the button also looks pretty bad, capitalize \"lineup\" for fuck sake.
> capitalize everything actually what the fuck"

Said of the lineup page's `Save lineup` button. This **reverses** the sentence-case
rule that `CLAUDE.md` and `DESIGN.md` §5 had carried since the 2.0 port, which
was inherited from the Google developer style guide rather than decided here.

- **Buttons**: `Save Lineup`, `Manage Squad`, `Free Agents` — not `Save lineup`.
- **Labels and stat keys**: `Active Roster`, `Injured Reserve`, `On Loan In`,
  `Smart-Lock Active`.
- **Unchanged**: labels already uppercased in CSS (`.g-label`, column heads,
  `.capacityStatKey`) are unaffected — this is about the strings in the markup.
- **Not extended to running prose**: full sentences in help text, error messages
  and state notices stay sentence case (`Over the cap. Drop or move a player out
  before the next signing.`). Duke has not ruled on those; if he wants them
  capitalized too, record it here rather than inferring it.

The rest of the Google style guidance in `CLAUDE.md` — active voice, no
throat-clearing, no inanimate agency, prose over lists — is untouched by this.

---

## 2026-09-10 — Targets: role, direct visibility, and rows over cards

**The `role` column stays as built, and "Roles" is the user-facing word.**

Migration `155_target_role.sql` and `src/lib/transfers/targetRole.ts` (both on
`feat/heritage-targets-projections`, not yet on `main`) added a required `role` (star / starter / bench / prospect) on profile targets, and
renamed the concept from "profile" to "Roles" in the UI. Neither was in the
approved spec — `docs/superpowers/specs/2026-09-04-targets-design.md` deliberates
the word "profile" at length and rejects four alternatives. Asked whether to
revert it, Duke chose:

> "Keep it exactly as built"

So the spec moves to match the code, not the other way round. A profile target
is a **role target**; the two kinds are a **named target** and a **role**.

**A third visibility: tell only the owner.**
> "i don't know if it replaces "public", but if i want cole palmer for example,
> wouldn't it make sense to have an option to only show/tell the owner of palmer
> that you want him? since it could be a disadvantage to show other managers
> your intentions."

Additive, not a replacement. The ladder is now: **Only you** (nobody sees it,
nobody is told) → **Only <the owning club>** (that club is told, nobody else) →
**Visible to the league** (your club is named on the board, and the owner is
told). A role target has no owner, so it keeps two rungs.

Duke also rejected the first attempt at labelling this on the board:
> "also, "only matchday militia" makes zero sense, every fuckin target/listing
> is only in the league. i also don't like the indicators that show visiblity,
> they take up space and fuck up the formatting"

The resolution: no tag line. Under **Your Targets** the first column already
carried your own club name on every row, so it carries the audience instead
(an eye glyph plus "The league" / the club / "You only"). Everywhere else it
stays blank unless the answer is something other than the league.

**Target cards are out; the board is rows.**
> "i think i'm going to have to retract the cards idea, i think it works for
> listings because it's sort of like you're shopping/posting your own player,
> but i think it starts to get confusing when you're posting a card for another
> manager's player."

A listing is an object you own and are putting up. A target is a sentence
somebody else is saying. A card frames its subject as a thing you can take,
which is wrong on another manager's player.

**One rule decides which section a row lands in: can you answer it from your
squad?** Duke caught the first draft applying this inconsistently:
> "how is "starting left-back" wanted from me, but if "vardy party" asks for a
> bench center-back that's somehow not "wanted from you""

Yes → **Wanted From You**, with buttons. No → **The Board**, with none. The
section and the buttons never disagree.

---

## 2026-09-10 — Transactions: scope, the position badge, and page headers

**The page covers completed transactions only. Bids are not transactions.**
> "since 'the wire' already covers so much of the economic and transfer stuff, i
> want the new activity page to cover purely just transactions, like when a
> player is signed, not whenever a new player gets bid for"

Asked where standalone money rows go — solidarity, prizes, merit revenue,
scout's fees — Duke chose to cut them entirely: a fee shows only as a property
of a transaction, and `/finance` keeps the full ledger. He also chose grouping
by calendar day over gameweek or transfer window, and a season selector that
defaults to the current season.

Implemented as `src/lib/transactions/buildRegister.ts` — a union of
`transactions`, `trade_proposals` and `player_loans`, because the old page read
`transactions` alone and its "Trades" filter could therefore never match
anything.

**There are two different things called The Wire, and only one keeps the name.**
> "do you think there's a world we can replace 'the wire', in the home page at
> least with an activity component? i do think the auction stuff like bidding is
> important to know though..."

The League Home rail called The Wire was already a transactions feed reading
`transactions` directly; the one on `/transfers` is the live market ticker
(bids, offers, listings). The home rail takes the page's name, the ticker keeps
The Wire, and bidding stays on Transfers where the auctions are.

**Nav and page are both "Transactions".**
> "let's call it Transactions in the nav too."

The route stays `/activity`; only the labels changed.

**A position badge belongs in the sentence, not beside it.**
> "i feel like the position badge should not be the kind of 'bullet' or
> 'headline' on the left hand side of each transactions, if anything it should be
> right in the title, like 'united... signed LW (badge) bradley barcola'."

So the register has no left-hand marker column at all. The badge sits on the
text baseline immediately before the player's name. Note this is NOT the
`.g-namerow` case: that device is a flex row, and a flex line would stop the
sentence wrapping.

**Title-plus-figures page headers are the generic-HTML tell.**
> "my only gripe is the header. i had the same issue in our lineups page
> redesign, it seems a ton of pages in gaffa have this generic html header and
> then a bunch of numbers on the right. gaffa should feel like a real app, not
> some html page"

This is about the `_home/home.module.css` `.mast` + `.figs` device — a 38px
display title with read-only figures floated right — which League Home
established and later pages copied. Offered three replacements, Duke chose the
working bar: one bounded control bar where the season's counts ride ON the
filters, plus search and the selects, and the totals in a divided strip along
its foot. A number becomes something to press rather than only to read.

He rejected deleting the page name along with it:
> "A looks good, but i didn't say just take the page title out entirely... like
> you can still say what page it is, just don't make it a generic h1 title or
> something"

The resolution: the name stays, demoted from heading to chrome — inside the bar,
at control scale, ahead of a divider. Shipped on
`activity/transactions.module.css`; `_home` and `team/roster` still carry the
old device.

---

## 2026-09-12 — Players who leave on loan

**A loan out of the Premier League is not a departure.**
> "i actually think it should just be similar to a retained right, but i guess it's
> different since you know for sure he's coming back ... at least while the player is
> gone he probably shouldn't count for another slot - you would also be able to drop
> or trade the player"

- A loanee abroad is held as an `on_loan` right: no Release/Retain choice, no
  compensation, no retained slot, no squad place. Tradeable, and droppable for
  nothing. (Migrations 159–160, `src/lib/departures/loanAbroad.ts`.)

---

## 2026-09-13 — Held players

**An arrival that finds a full squad is held, not dropped and not over the limit.**
Chosen in a design session; the spec is
`docs/superpowers/specs/2026-09-13-held-players-design.md` (rules R1–R21).

- **Manager activates.**
  > "manager activates - it's a bit like sleeper, where it tells you, you're 2 players
  > over the limit or something, and then after you free some space you can move
  > players in manually. although i do feel like this needs a bit of downside so you
  > can't just exploit it"
- **Not mid-gameweek.**
  > "i don't think you should be able to activate mid-gameweek."
- **The downside:** squad additions freeze at once; if a player is still held at
  the next gameweek's first kickoff, the lineup locks too (chosen over an immediate
  Sleeper-style lineup lock and over additions only).
- **Locked lineups** carry the last saved lineup forward, filling only slots that
  broke, and the manager is told.
  > "i think the user should still know that their lineup will be autoset, in fact,
  > which will tell them, hey, my lineup's locked, i have to fix my roster before i can
  > do things for next week."
  > "if there's truly no way of invalidating a lineup then do last saved."
  (A lineup can be invalidated, so gap-filling was chosen over regenerating it.)
- **Auctions:** the highest bidder with room wins; a hold only happens when nobody
  with room bid.
  > "only uncontested bids can be held basically, although i guess if both players
  > were over the limit the highest bidder would get the 'held'"
- **Trades while holding:** allowed only if they don't grow the squad (chosen over
  shrink-only and no trades).
- **Dropping a held player** costs normal severance (chosen over free and reduced).
- **Retained returns** use the hold instead of the 48-hour window, and keep a free
  Decline.
- Where Duke said "just do what's right" (live bids when a hold begins), bids are
  withdrawn at once and recalls need room; those are agent decisions, recorded as
  such in the spec.

---

## 2026-09-13 — Scout's Fee is paid win or lose, and ships with held players

**The manager who opens an auction gets the Scout's Fee whether they win it or not.**
Duke asked about rewarding the first bidder "beyond just the scout's fee, like a
discount". The version he accepted keeps the fee at 10% and pays it on a win
too, as a rebate after settlement, with the bid itself unchanged:
> "ah okay i see. so it's not a discount, just the scout's fee going both ways."

The reasoning he was shown: a fee paid only on losing makes a scout stop
bidding at v / 1.1 of their valuation, and the same 10% on a win moves that
back to v. A rebate above 10% was argued against because it would let the
nominator outbid clubs that value the player more. [inferred] Duke accepted
the 10% version but didn't rule on the rate separately.

**It ships in the same update as the held-players work.**
> "these econ changes, as well as the \"held\" work we're working on regarding
> being able to keep players even if you're over the roster limit, i want them
> to all ship at the same time in an update."

Held players reached production first, on 2026-09-14 (#6, #7); Scout's Fee
followed on 2026-09-15 after Duke said "let's just start pushing everything to
production". No changelog had been published in between.

---

## 2026-09-15 — Club Facilities

Spec: `docs/superpowers/specs/2026-09-15-club-facility-upgrades-design.md`.
Design canvas: "Club Facilities" artifact.

**Facilities use the names managers already see.** Asked whether the UI should
say Academy / Injured Reserve / Loans Out or new facility names (Youth Academy,
Medical Centre, Loan Office), Duke picked the existing names. Only the section
is called Club Facilities.

**Rivals can see a club's facilities, read-only.** Chosen over owner-only.

**Purchases are ledger-only.** First answered yes to announcing purchases in
the league activity feed, then:
> "actually, no for the last question"

**Facilities must not be buried.** Said while implementation was under way:
> "these upgrade options shouldn't be obscure, by the way. i don't want it to
> become buried in the clubs page because it's an important part of the economy
> and decisions in gaffa"

Asked where else they should appear, Duke chose the top of the club page (not
the foot), a link in the topbar Club Balance menu, and a League Home reminder.
Not chosen: a Transfers tab. On the menu link:
> "not sure what the club balance menu would look like though so bit skeptical
> on that one until i inspect it"

On the reminder:
> "league home reminder but don't make it super annoying, having to dismiss it
> every single time"

So the reminder shows only when the Academy or IR is full and the next slot is
affordable, and a dismissal holds until the next slot is on offer.

---

## 2026-09-15 — The dashboard is the reference for a finished page

**Cards are fine when they belong to a composition; the problem was loose tiles
on a blank field.**
> "the no white panels floating is a different vibe to this though. this looks
> more like parts of a cohesive app page, whereas the results i was getting
> before was more just like a blank white/cream background with white tiles on
> top. the dashboard actually looks like a sophisticated design that's worthy
> of a real app, and i want to get results like this when i prototype
> consistently"

This refines 2026-09-04 rather than reversing it. The quote there objects to
"white cards on top" of cream; the dashboard's cards are not that, because each
is anchored to something — they rise out of the green shelf, carry club crests
and live data, and sit among objects of different kinds. Shipped in PR #11
(`src/app/(dashboard)/dashboard/`).

**Section heads should be more than text.**
> "i don't like headers are just generic html headers, like just letters
> basically, i wish that i was more sophisticated design wise."
> "(also a common theme in gaffa right now that i want to move away from)"

**Imagery belongs on the page.**
> "would probably be better if it was more visual, with player portraits and
> stuff"

**Desktop and mobile are each designed, not reflowed.**
> "make sure it fits both desktop and mobile properly - remember that it should
> look optimized and built for each respectively."

**A card that leads somewhere looks like it does.**
> "the 'league card' has to seem more clickable, because people should still be
> going to the league home page by default, my squad and matchups are there to
> be helpful but i feel like the general 'design philosophy' should not be to
> kind of emphasize two big buttons, there's no implication that the league
> card is clickable."

The whole card is the link; secondary destinations are quiet shortcuts.

What the dashboard does to meet these is described, as agent inference with
file citations, in `DESIGN.md` § "Composing a Page". Those techniques are not
decisions; these quotes are.

---

## 2026-09-22 — Targets review: what makes a page read as unfinished

Said while reviewing the Targets prototype. Record of his words; the fixes
named after each quote are what the prototype did, not rules.

**Every page got the same pitch header.**
> "i asked to make things more visually appealing like the new dashboard page,
> and what's happened is now every page claude is designing is using the exact
> same pitch header."

**Generic HTML headers are an app-wide problem, still unsolved.**
> "i'm just saying this generic html header problem is an app-wide problem in
> terms of scope, i'm still trying to figure out how to elevate this for the
> app so it seems more like an actual production-ready visually appealing app,
> not an html page."

The green strip is not the agreed answer; no header pattern is settled.

**Wrapped text looks broken.**
> "anytime when something has to wrap in ui it ends up looking horrible."

**Data lines under headings mostly add clutter.**
> "you add a lot of these things underneath like "3 approaches . 1 private"
> that don't always add too much to the page's information while cluttering it."

**The faded badge behind a card doesn't work.**
> "we keep using this "faded badge" design, like the arsenal badge with saliba
> - it doesn't look good, it's cool that you're trying to add something cool
> visually but it doesn't land right.."

**Pill tags read as lazy.** Of "At Auction" and "You want him too":
> "the "at auction" and "you want him too" button designs are super lazy"

**Archivo Narrow may be on its way out.** Not a decision yet:
> "i think i'm growing tired of one of the fonts, its the font that the buttons
> like "add target" are in, i don't think it matches the rest of our fonts"

---

## 2026-09-22 — Transfer Board: Listings and Targets merge

Spec: `docs/superpowers/specs/2026-09-22-transfer-board-design.md`. Chosen from
options in a design session; the spec lists each choice.

**Market stays the transfers home.**
> "my original idea for market was as almost like a "transfers home" a page
> that tells you everything that's going on and leads to more of the
> subfeatures, like free agency, auctions, listings, etc."

It gains Your Move (every open decision across Transfers). Listings and
Targets merge into one tab, provisionally called Board:
> "go with board i guess. don't love the name, but i won't waste time on it
> until i can think of a better one."

**The merge has to be one feature, not two pages side by side.**
> "i want both the interface that houses them and the actual code logic, flow
> and feature process itself to be harmonious and flow together beautifully
> from a human gaffa user standpoint."

**Every choice should come with how it improves Gaffa.**
> "if we merge things i would need to know how this changes and how it
> improves gaffa. but i mean likewise i would want to know that for any other
> decision too"

**Small lines must earn their space.** Applies app-wide, not just to the Board.
> "make sure they're actually informative and as least noisy as possible, again
> i don't want ui elements that take up space but don't contribute anything
> meaningful in terms of data or appearance. and please make sure they are
> formatted properly and don't mess with the look of the page"

**Sofia Sans Semi Condensed is the preferred replacement for Archivo Narrow.**
Not yet applied app-wide:
> "sofia sans actually looks pretty good to me."

**Skills should load when the work calls for them.**
> "i don't know for sure if i want to force every design session to use certain
> skills, but damn it should know to do so if the specific circumstance
> requires it."
