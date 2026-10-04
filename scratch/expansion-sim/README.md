# Expansion draft analysis

Evidence for `docs/superpowers/specs/2026-10-04-expansion-and-takeovers-design.md`. It asks how strong a new club comes out under each expansion rule, and what the existing clubs lose.

## Running it

From the repo root (where `.env.local` and `node_modules` live):

```bash
node scratch/redraft-economy-sim/fetch.mjs
```

```bash
node scratch/expansion-sim/fetch.mjs
```

Then run the analysis and print the table:

```bash
GRID='[[8,2],[10,2],[12,2]]' OPTIONAL=1 SEEDS=12 node scratch/expansion-sim/analyze.mjs > scratch/expansion-sim/results.jsonl
```

```bash
node scratch/expansion-sim/table.mjs
```

`GRID` lists `[protected, taken per club]` pairs. `OPTIONAL=1` lets the new club pass on a club when a free agent is better, which the spec adopts. `SEEDS` sets how many simulated leagues are averaged per size.

## Method

- **Player value:** 60% last season's Gaffa points per gameweek and 40% the current blend of projection and points per game. Players with no 2025-26 record are shrunk by a quarter, because picking the best of 400 free agents on a month of form flatters them.
- **Club strength:** best XI plus a quarter of the best four outfield bench players and the reserve keeper.
- **Protection:** each club protects the players it would least like to lose, best XI first.
- **Picks:** the new club picks from the strongest club down, round-robin, so no club loses a second player before every club has lost one. It then fills to 22 from free agents.
- **Leagues tested:** the two real alpha leagues as they stand, and synthetic leagues of 6, 8, 10 and 12 clubs built by a snake draft in which each manager values players with their own error.
- **Grouping:** positions are grouped into four buckets (GK, DEF, MID, ATT).
