# Gaffa Growth Plan

**Status:** Proposal, 2026-11-07. Targets are suggestions for Duke to accept or change. Read `.agents/product-marketing.md` first; every marketing skill reads it.

## Where Gaffa stands

Two live leagues, 12 human managers, three months in. Everything else in the database is test data. Gaffa has not yet shown that managers stay, that a league survives a season, or that a commissioner starts a second league. Growth work before that is proven wastes the one launch window that matters.

The competitor that sets the frame is Fantasy Premier League, with roughly 13 million managers in 2025/26 (third-party figure, not official). Gaffa won't beat it on scale. It can win a niche FPL can't serve: people who want depth, permanence and realism, and who already have a friend group.

## Strategy

**Position as the second game.** "FPL for the global rank, Gaffa for your friends and the long game." This avoids a head-on fight, turns FPL's 13 million players into the addressable pool, and matches how dynasty works in American football, where people play both formats.

**Lead with realism.** Duke's pitch: the most realistic fantasy football game. Pillars in his order of enthusiasm: transfers tied to real Premier League moves, scoring that matches what you watched, cups. Never claim "first."

**Grow by leagues, not users.** One commissioner brings 5 to 11 people. The acquisition target is the commissioner, and the product's job is to make filling a league easy.

## Stages

### Stage 0: Foundations (now to end of November)
1. **Interview all 12 alpha managers** (`customer-research`). Fill Customer Language, Objections and Why Customers Choose Us in the context doc. Highest value for lowest cost.
2. **Instrument the funnel.** Track league created, invite sent, invite accepted, league full, draft completed, lineup set per gameweek, second-season return. Without these, no later stage can be judged.
3. **Check the infrastructure ceiling.** Supabase free tier allows 200 concurrent Realtime connections and Vercel Hobby allows 1M invocations a month. Estimate the league count at which each breaks, and set a trigger to upgrade before it does. Vercel Hobby also restricts commercial use, which matters the moment there is any revenue or paid promotion.
4. **Run a rights check before public promotion.** The game uses Premier League club names and badges, and its data comes from the FPL API plus scrapers for SoFIFA and Transfermarkt that block cloud IPs. Both are fine for a private beta and riskier with visibility. A short legal read is cheap compared with a takedown after a launch.
5. **Finish the public front page** (PR #31) with fixed, famous-player examples, and write the "Gaffa vs FPL" framing once. Use `copywriting` for the draft and the `gaffa-ui-copy` rules for anything in the app.

### Stage 1: Seed 10 leagues (December to May 2027)
Goal: 10 live leagues, 80% of managers setting a lineup each gameweek, at least 3 commissioners starting a second league. Mid-season entry is easiest through redraft mode; confirm it works from a mid-season start before promoting it.

- **Creator leagues.** Give 5 to 10 mid-size FPL YouTubers, podcasters and streamers a free league with their audience. A live auction or draft is watchable content for them, and every viewer who joins is already in the target group. Use `community-marketing` and `social` for outreach.
- **Reddit and X, by hand.** r/FantasyPL and FPL X. Share receipts (below), not links. One commissioner per post is the goal.
- **Friends of friends.** Each alpha manager gets an invite kit to start one more league.
- **Commissioner kit.** A one-page "run your Gaffa league" guide, a shareable rules summary, and a pre-written invite message for a WhatsApp group.

### Stage 2: The summer launch (June to August 2027)
Summer is the window: FPL registration opens, the transfer window is the loudest news cycle of the year, and Gaffa's transfer system is its strongest pillar. Use `launch` for the checklist.

- A public launch the week the transfer window peaks, built around one pinned example of a real transfer playing out in Gaffa.
- Waitlist plus a cap on new leagues per week so infrastructure and support hold.
- Product Hunt, Reddit, FPL creator partnerships from Stage 1, and a Premier League–adjacent press pitch.
- Target: 40 leagues live by the start of 2027-28.

### Stage 3: Compound (2027-28)
- **Open leagues.** A "join a league" board that fills incomplete leagues with strangers. This removes the biggest friction (finding five friends) and the biggest risk (abandonment, mitigated by Caretaker clubs). It needs moderation and reporting, so build it after Stage 2.
- **Public player pages and weekly ratings.** Gaffa Team of the Week, with each player's Gaffa rating beside his FPL points. Indexable pages feed `seo-audit`, `ai-seo`, `schema` and `site-architecture`.
- **Comparison pages** (`competitors`): "Gaffa vs FPL," "FPL dynasty alternative," "soccer dynasty fantasy." Research each competitor properly first.
- Target: 300 leagues by the end of 2027-28.

## Content engine: receipts

Content that proves the pitch without describing mechanics:

- **Rating vs points:** a defender FPL scored at 2 and Gaffa rated among the week's best, with the match context. Pinned famous players only.
- **Transfer stories:** a real Premier League arrival and what the Gaffa auction paid for him.
- **Cup drama:** a bracket tie broken by best individual performer.
- **League-generated artifacts:** match reports, trophy cabinets and Heritage records as shareable images with proper OpenGraph cards. Every one posted to a group chat is an ad for the next commissioner.

Plan the calendar with `content-strategy`; edit with `copy-editing`.

## Lifecycle

Use `onboarding` and `signup` for the commissioner flow (create, invite, fill, draft) and the manager flow (join, set first lineup before the first kickoff). Measure the invite step first; most leagues will stall there. Use `cro` on the front page and invite page once there is traffic.

## Metrics

North star: leagues where at least 80% of managers set a lineup this gameweek.

| Metric | Why it matters |
|--------|----------------|
| Invites accepted per commissioner | Growth loop strength |
| Leagues that fill within 7 days | Friction in recruiting |
| Draft completion rate | Activation |
| Lineup-set rate per gameweek | Retention |
| Commissioners starting a second league | Product-market fit |
| League return rate for season two | Dynasty promise kept |

## Risks

- **Scale before trust.** A scoring change that alters published results costs more than slow growth. Hold scoring changes (V3) until after a gap between gameweeks.
- **Infrastructure and data terms.** See Stage 0.
- **Monetization is undecided.** Free tiers and Hobby terms suggest deciding before paid promotion. Past decisions rule out contracts, wages and recurring manager costs. Paid-entry contests carry legal exposure; avoid.
- **Complexity.** The guide runs 645 lines. New leagues need the first week to feel simple.
- **Founder time.** One person is running product, data pipelines and marketing. Prefer channels that compound (creators, shareable artifacts, SEO) over ones that need daily attention.

## Skills, in order of use

1. `product-marketing`: finish the context doc.
2. `customer-research`: alpha-manager interviews.
3. `copywriting` / `copy-editing`: front page and invite copy (in-app copy follows `gaffa-ui-copy`).
4. `community-marketing` and `social`: creator leagues, Reddit, X.
5. `content-strategy`: receipts calendar.
6. `seo-audit`, `ai-seo`, `schema`, `site-architecture`, `competitors`: Stage 3 pages.
7. `launch`: summer 2027.

Skills in the repo's banned list (`industrial-brutalist-ui`, `high-end-visual-design`, `design-taste-frontend`, `minimalist-ui`, `stitch-design-taste`, `image-to-code`) stay off for any design work.

## Open questions for Duke

1. Target by August 2027, and is 40 leagues right?
2. Hours per week you can give to marketing?
3. Open leagues with strangers: yes, no, or later?
4. Monetization intent?
5. Is a mid-season league start supported today, or must it be tested first?
