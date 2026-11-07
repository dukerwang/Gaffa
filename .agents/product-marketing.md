# Product Marketing Context

**Document version:** v1 (draft, auto-drafted from the repo; needs Duke's corrections)
**Last updated:** 2026-11-07

Items marked **[Duke]** are gaps only you can fill. Nothing here is a customer quote unless it is in quotation marks and attributed.

## Product Overview
**One-liner:** The most realistic fantasy football game: scores that match what you watched, transfers tied to the real Premier League market, and several trophies to play for.
**What it does:** Gaffa is a dynasty-style fantasy football (soccer) game for private leagues of friends. Players are scored against the baseline for their specific role instead of a flat points table, you buy and sell them at open auctions with a permanent Club Balance, and a league runs a table plus three parallel knockout cups.
**Product category:** Fantasy football (soccer), dynasty format. Buyers search for "dynasty fantasy football soccer," "FPL alternative," "FPL with friends."
**Product type:** Web app (consumer, multiplayer, league-based). Live at gaffa.live.
**Business model:** Free today. No pricing, no ads, no entry fees. **[Duke]** Intended model? (Constraint from past decisions: no contracts, wages or recurring costs for managers.)

## Target Audience
**Target users:** Football-obsessed adults who already play FPL (or Sleeper/Yahoo dynasty for American football) and have a friend group that argues about players.
**Decision-makers:** The commissioner. One person creates the league and recruits 5 to 11 friends, so the commissioner is the real customer.
**Primary use case:** A permanent league with friends where knowing footballers (not farming a points quirk) wins.
**Jobs to be done:**
- Prove I know football better than my friends, over years, not one season.
- Make the real-world transfer window matter to my fantasy team.
- Have something to play for in March, even when I'm out of the title race.
**Use cases:**
- Dynasty league: one draft ever, then auctions, trades and loans.
- Redraft league: a draft every season, with the transaction systems switched off.

## Personas
Not B2B. Two roles inside a league:

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Commissioner | A league that fills, runs itself and doesn't embarrass them | Recruiting 5+ friends to learn a new game | Invite link, Caretaker clubs for managers who drop out, automated resolution |
| Manager | Being right about footballers, banter, trophies | FPL feels the same every year and rewards quirks | Realistic scores, a real transfer market, cups |

## Problems & Pain Points
**Core problem:** Mainstream fantasy football scores the sport like a spreadsheet and resets every summer, so scores often disagree with what you watched and nothing you build lasts.
**Why alternatives fall short:**
- FPL: flat points table, three or four generic position buckets, redraft every year, no real market.
- Sleeper dynasty: true dynasty, but sport-generic slots and context-free scoring.
- Card games (Sorare and similar): ownership is a collectible, not a squad you manage against friends. **[Duke]** confirm how you see these.
**What it costs them:** A quiet 90 minutes from a centre-back scores like a clean-sheet masterclass; a brilliant wing-back is scored as a defender. The game feels arbitrary.
**Emotional tension:** "I watched him play well and he scored 2." Being wrong in front of friends for reasons that aren't about football.

## Competitive Landscape
**Direct:** Fantasy Premier League (about 13 million managers in 2025/26 per third-party sources, not an official figure). Falls short on depth, realism and permanence.
**Direct (dynasty):** Sleeper and other US dynasty platforms. Strong on dynasty, weak on football-specific scoring and positions.
**Direct (other football games):** Fantrax, Kickbase, Comunio, Biwenger, Sorare. **[Duke]** Research each before writing comparison pages; web search this session returned nothing reliable on them.
**Secondary:** FPL companion tools (AI tip apps). They improve FPL; they don't replace it.
**Indirect:** A WhatsApp group and a pub argument. Football Manager (club-running fantasy without friends).

## Differentiation
**Key differentiators:**
- Role-aware scoring: 12 tactical positions, each judged against its own baseline.
- A transfer market tied to real Premier League arrivals and departures.
- Three parallel cups, so every club has something to play for.
- True dynasty: one draft, ever.
- Open auction economy where part of every fee recirculates to the league.
**How we do it differently:** Sigmoid rating against position-specific medians, calibrated to match consensus match ratings.
**Why that's better:** Scores that match what you watched; a market that behaves like football's.
**Why customers choose us:** **[Duke]** Needs interviews with the alpha managers.

## Objections
| Objection | Response |
|-----------|----------|
| "I already play FPL." | Gaffa is the second game: FPL for the global rank, Gaffa for your friends and the long game. |
| "Too complicated." | **[Duke]** Draft the onboarding answer once the first-week flow is measured. |
| "I can't get enough friends." | Redraft mode, Caretaker clubs, and (planned) open leagues. **[Duke]** Is open matchmaking on the table? |

**Anti-persona:** Casual FPL players who want a single global rank, and anyone looking for a gambling or paid-entry product.

## Switching Dynamics
**Push:** Scores that don't match the match; yearly reset; no real market.
**Pull:** "Realistic" scoring, trophies, a transfer market that follows real news.
**Habit:** FPL is free, familiar and where everyone is; the group chat is already there.
**Anxiety:** Learning a new ruleset; friends won't join; it's new and unproven (about 12 managers across two leagues as of 2026-11-07).

## Customer Language
**How they describe the problem:** **[Duke]** None captured yet. Interview the 12 alpha managers and mine r/FantasyPL.
**How they describe us:** **[Duke]** None captured yet.
**Founder's words (2026-09-29):** "the most 'realistic' fantasy football game" and scores "that match what you watched."
**Words to use:** realistic, Club Balance, transfer, cup, role, manager, league.
**Words to avoid:** "FAAB" (internal only), "first" (Sorare, Kickbase and Comunio predate Gaffa), "completed" for a league, "TV & Matchday Revenue" (it is Match Revenue), mechanics-first pitches, "lets you."
**Glossary:**

| Term | Meaning |
|------|---------|
| Club Balance | Permanent, uncapped budget for auctions; carries over every season |
| Scout's Fee / solidarity | 10% to whoever opened an auction, 10% split among the other clubs |
| Academy | Slots for U21 prospects |
| Held | A player who arrives at a full squad and waits off the roster |
| Caretaker | The system manager of a club with no human |
| Transfer Day | When redraft auctions close |

## Brand Voice
Not yet defined from performing copy. Constraints that exist today: Google Developer Documentation Style (no inanimate agency, no "lets you," Title Case labels, sentence-case prose), football-native references, not editorial or newspaper framing, show rather than describe.

| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| **[Duke]** | | | |

**Tone by context:** **[Duke]**
**Terms we own:** Club Balance, Match Revenue, Scout's Fee, Caretaker.
**Never use (and why):** see Words to avoid.

## Proof Points
**Metrics (2026-11-07):** 2 live leagues, 12 human managers, both on 2026-27. GW1 and later gameweeks scored and banked. No public usage figures yet.
**Customers:** None named.
**Testimonials:** None captured.
**Value themes:**

| Theme | Proof |
|-------|-------|
| Realistic scoring | Ratings calibrated to consensus (FotMob agreement gate per position). Needs a publishable comparison. |
| Real transfer market | Auto-auction on any Premier League arrival of £50m or more. Needs a pinned example with famous players. |
| Cups | Three parallel knockouts. Needs a pinned example. |

## Goals
**Business goal:** **[Duke]** Proposed in `docs/GROWTH_PLAN.md`: 40 leagues by August 2027, 300 by the end of 2027-28.
**Conversion action:** Create a league and invite friends (commissioner); accept an invite and join (manager).
**Current metrics:** See Proof Points.

## Learnings
*Decisions and tested lessons. Newest first.*

| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-10-08 | Marketing surfaces use one pinned example per feature with famous players; never rotate with the latest gameweek. | Duke, after Khalaili appeared on the front page | Front page, feature intros, social | active |
| 2026-09-29 | Lead with realism, then transfers, scoring, cups. Describe what appeals, not the mechanics. | Duke's pitch statement | All copy | active |
| 2026-08-26 | Published scores never change retroactively. | Duke, about alpha leagues | Any claim about scoring | active |

## Changelog
*Newest first.*
- v1 (2026-11-07) — Initial draft from README, docs/DECISIONS.md, memory notes and a database count of leagues. Gaps marked **[Duke]**.
