# Gaffa Growth Plan

**Status:** Proposal, 2026-11-07. Targets are suggestions for Duke to accept or change. Read `.agents/product-marketing.md` first; every marketing skill reads it.

## Where Gaffa stands

Two live leagues, 12 human managers, three months in. Everything else in the database is test data. Gaffa has not yet shown that managers stay, that a league survives a season, or that a commissioner starts a second league. Growth work before that is proven wastes the one launch window that matters.

The competitor that sets the frame is Fantasy Premier League, with roughly 13 million managers in 2025/26 (third-party figure, not official). Those managers are the addressable pool, and the pitch to them is a different kind of game, not a smaller version of FPL.

## Strategy

**Position as fantasy football the way American fantasy sports work.** Duke's view (2026-11-07): Gaffa gives soccer the experience of fantasy American football or basketball, where you draft and own your players in a league with your friends. In FPL everyone can own the same player, which Duke finds lame. The wedge is exclusive ownership: nobody else in your league has your player. Global rank is a different product; Gaffa is about the league. Don't frame Gaffa as a "second game" or as only for "the long game."

**Two doors in.** Redraft is the easy-barrier entry: a draft every season, no auction economy to learn. Dynasty is the deeper game for people who stay. Marketing leads with ownership and the league, and sends newcomers to redraft first.

**Lead with realism and ownership.** Pillars in Duke's order of enthusiasm: transfers tied to real Premier League moves, scoring that matches what you watched, cups. Ownership is the headline difference from FPL; realism is the proof. Never claim "first."

**Users first, money second.** No monetization intent. Nothing in this plan depends on revenue.

**Grow by leagues, not users.** One commissioner brings 5 to 11 people. The acquisition target is the commissioner, and the product's job is to make filling a league easy. The hard part is reaching the first commissioner at all, so Stage 1 puts most of its effort into reach, not conversion tweaks.

## Stages

### Stage 0: Foundations (now to end of November)
1. **Interview all 12 alpha managers** (`customer-research`). Fill Customer Language, Objections and Why Customers Choose Us in the context doc. Highest value for lowest cost.
2. **Instrument the funnel.** Track league created, invite sent, invite accepted, league full, draft completed, lineup set per gameweek, second-season return. Without these, no later stage can be judged.
3. **Check the infrastructure ceiling.** Supabase free tier allows 200 concurrent Realtime connections and Vercel Hobby allows 1M invocations a month. Estimate the league count at which each breaks, and set a trigger to upgrade before it does. Vercel Hobby also restricts commercial use, which matters the moment there is any revenue or paid promotion.
4. **Run a rights check before public promotion.** The game uses Premier League club names and badges, and its data comes from the FPL API plus scrapers for SoFIFA and Transfermarkt that block cloud IPs. Both are fine for a private beta and riskier with visibility. A short legal read is cheap compared with a takedown after a launch.
5. **Set a latest start date for new leagues.** Today there is no limit. Reading `src/lib/schedule/insertMatchups.ts`: the schedule begins at the next gameweek when the draft finishes and is skipped only after gameweek 38. A league that finishes drafting at gameweek 37 would get a two-week partial round-robin, and cups are created whenever the season is past gameweek 7, so they likely can't finish either. I haven't tested this. Decide a cutoff (or a "starts next season" path) and enforce it at league creation and at draft completion, with a clear message.
6. **Finish the public front page** (PR #31) with fixed, famous-player examples, and lead it with ownership. Use `copywriting` for the draft and the `gaffa-ui-copy` rules for anything in the app.

### Stage 1: Seed 10 leagues (December to May 2027)
Goal: 10 live leagues, 80% of managers setting a lineup each gameweek, at least 3 commissioners starting a second league. Mid-season starts are supported; promote redraft as the entry point.

Finding the first users is the bottleneck, so spend most of the effort here on reach. Each channel below tests one question: where do FPL players who like owning their players hang out?

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
- **Open leagues.** A "join a league" board that fills incomplete leagues with strangers. Duke is open to it and wants the product refined and proven at scale first. It removes the biggest friction (finding five friends) and the biggest risk (abandonment, mitigated by Caretaker clubs). It needs moderation and reporting. Gate it on the Stage 0 infrastructure work and on at least one full season of league survival data. A narrower first step: open redraft leagues only, which are the lowest commitment for a stranger.
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
- **No monetization, by decision.** Users first. Two things still follow from it: Vercel Hobby's non-commercial terms stay satisfied only while nothing is charged, and free-tier ceilings become a cost Duke pays directly once growth starts.
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

Answered 2026-11-07: open leagues yes but later; no monetization; mid-season starts should work.

1. Target by August 2027, and is 40 leagues right?
2. Hours per week you can give to marketing?
3. Latest start date for a new league: which gameweek, and what happens after it (wait for next season, or a shortened format)?
4. Where do you already know FPL players congregate (subreddits, Discords, creators you follow)? That seeds the Stage 1 channel list.
