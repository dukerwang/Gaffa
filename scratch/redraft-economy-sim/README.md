# Redraft economy simulation

Evidence for `docs/superpowers/specs/2026-10-04-redraft-mode-design.md`. It asks one question: in a redraft league with a snake draft, does free-agent money decide anything?

## Running it

```bash
node scratch/redraft-economy-sim/fetch.mjs
```

Run that from the repo root (it reads `.env.local`). It writes `data.json`, which is git-ignored. Then, from this folder:

```bash
node run.mjs '{"floorName":"flat1","seeds":24}'
```

A configuration with the money test takes about 5 minutes; add `"perturb":false` to skip that test and finish in about 30 seconds.

## The model

`sim.mjs` plays one season on the real 2025-26 Gaffa points for 796 players over 38 gameweeks.

- **Draft.** A snake draft on preseason beliefs: points per appearance and availability, each with proportional error.
- **Beliefs.** They update each week from what each player has scored so far. Injury and selection news is public and known 85% of the time for the coming week, falling to 20% four weeks out.
- **Bidding.** Each week, managers bid on the top 50 free agents. A manager notices any one player 80% of the time; that rate reproduces the alpha leagues' 18–23% contested-auction rate. A manager bids only when the player improves their best XI by at least 0.4 points a week. The bid is a share of their balance equal to this upgrade's rest-of-season gain against the gain they expect to buy later in the season, which is learned from earlier runs of the same league.
- **Settlement.** Open auction: the price is the second-highest bid plus €1m, or the floor if there's only one bidder.
- **Lineups.** Picked on beliefs and scored on real points. A starter who doesn't play is auto-subbed from the bench within the same group.

Positions are grouped into four buckets (GK, DEF, MID, ATT) rather than Gaffa's 12 exact positions. Exact eligibility makes specific players scarcer, so the real game probably values depth, and money, somewhat more than this model does.

## Floors and options

| Option | Meaning |
|---|---|
| `flat1` | €1m minimum bid |
| `mv60`, `mv50`, `mv20` | Minimum bid at that share of Transfermarkt value |
| `proj` with `phiK` | Minimum bid scaled to projected rest-of-season points above replacement level |
| `incomeName` | `merit` (Match Revenue scaled to the budget), `catchup` (inverse Match Revenue) or `flat` |
| `weeklyName: "window"` | A January top-up of `windowAmt` at gameweek 19 |

## Metrics

| Metric | Meaning |
|---|---|
| `spentPct` | Share of the money available that was spent |
| `atFloorPct` | Share of auctions that closed at the minimum bid, because nobody else bid |
| `draftVsFinal` | Rank correlation between draft strength and final points |
| `extraBudgetAtStart_pts` | Season points gained by one team given `perturbPct` extra budget at the start (default +20%), replaying the same seasons |

## Results (2026-10-03)

10 teams, 18-man squads, €100m budget, 24 seeds per row. A team scores about 4,150 points a season, and the spread between teams (one standard deviation) is about 285.

| Scenario | Spent | At floor | Buys per team | Price vs points | Draft vs final | +20% budget (pts) |
|---|---|---|---|---|---|---|
| €1m floor | 58% | 67% | 8.3 | 0.41 | 0.85 | −4 ± 5 |
| 60% of market value | 80% | 73% | 5.5 | 0.15 | 0.82 | −2 ± 7 |
| 20% of market value | 71% | 69% | 7.8 | 0.16 | 0.83 | −1 ± 6 |
| Projected-points floor, low | 75% | 75% | 6.5 | 0.42 | 0.84 | +15 ± 8 |
| Projected-points floor, high | 72% | 75% | 6.4 | 0.45 | 0.84 | +10 ± 7 |
| Budget €30m | 68% | 67% | 7.9 | 0.43 | 0.84 | −2 ± 5 |
| Budget €300m | 55% | 67% | 8.3 | 0.40 | 0.85 | −8 ± 6 |
| Match Revenue | 53% | 67% | 8.3 | 0.40 | 0.84 | −6 ± 5 |
| Catch-up income | 54% | 67% | 8.3 | 0.39 | 0.85 | −8 ± 5 |
| January top-up | 53% | 67% | 8.3 | 0.38 | 0.84 | −2 ± 5 |
| 12 teams | 55% | 67% | 6.5 | 0.34 | 0.85 | 0 ± 4 |
| 8 teams | 59% | 73% | 10.4 | 0.45 | 0.80 | −2 ± 7 |
| 15-man squads | 72% | 65% | 14.8 | n/a | 0.75 | −4 ± 9 |

Doubling one team's budget (16 seeds) gained +9 to +18 points a season (±10) in every configuration tested: under a twentieth of the spread between teams, and less than one league point.

Separately, after a draft by preseason ranking only 7 to 10 undrafted players a season outscore the league's worst regular starter, whether the league has 6, 10 or 12 teams. That pool is all free-agent money competes for.
