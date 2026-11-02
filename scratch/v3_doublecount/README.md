# V3 double-count audit (2026-11-02)

Which events does the V3 engine (as of 681d93e7, penalty rule included) pay
for more than once, and how much? Data: every 2025-26 appearance with FPL's
real ICT (11,353), joined to FotMob's match stats.

## Scripts

Run from the worktree root with `node_modules/.bin/tsx`.

- `data.ts`: builds and caches the dataset (`data.json`, git-ignored; delete it to rebuild).
- `bps.ts`: rebuilds BPS line by line from FPL's published table and FotMob's counts.
- `ict.ts`: OLS of FPL's Influence, Creativity and Threat on the same counts, per position group.
- `price.ts`: points one more event earns through each component, averaged over 90-minute appearances.
- `broad.ts`: correlation of Match Impact with Influence once goals and assists are out of Influence.

## What the data says about FPL's metrics

BPS rebuilds from the published table with R² 0.95 (mean error 1.6 BPS); a
free fit returns the published values for nearly every line. FPL's
`fpl_tackles` counts more than the successful tackles BPS pays for (fitted 1.15
per tackle against the published 2).

FPL's Influence is mostly goals and assists: about 30 per goal (penalty or
not) and 12 per assist for every outfield group, which is 31-33% of its
variance for midfielders and attackers. For defenders it is mostly defending
(25%) and then goals (18%). For keepers it is saves (74%).

Creativity is key passes (~10 each), assists (~8), xA and crosses (~4).
Threat is non-penalty xG (14-21 per 1.0) and shots on target (~10 each); a
penalty adds about 16 in total, which V3 now removes.

Match Impact and Influence (both with goals and assists out) correlate at
0.63-0.76 for DM to ST, 0.28-0.44 for GK, CB and full-backs.

## Points one more event earns, by component

Mean over 90-minute appearances. MI Match Impact, Infl Influence, Crea
Creativity, Thr Threat, Def Defensive, GI Goal Involvement, Fin Finishing.
Bold rows pay through two or more components by 0.1 points or more.

| Event | Position | Total | Split |
|---|---|---|---|
| **Goal, beyond its shot** | CB | 7.4 | GI 4.95, Fin 1.37, Infl 1.07 |
| | DM | 10.3 | Infl 9.25, GI 1.09 |
| | CM | 8.7 | Infl 6.33, GI 2.11 |
| | AM | 11.9 | GI 6.53, Fin 3.48, Infl 1.62 |
| | W | 14.5 | Fin 7.63, GI 5.81, Infl 0.84 |
| | ST | 15.2 | Fin 6.89, GI 6.61, Infl 1.48 |
| **Assist** | DM | 5.4 | Infl 4.13, GI 0.87, Crea 0.38 |
| | ST | 10.6 | GI 5.00, Fin 3.89, Crea 0.97, Infl 0.67 |
| **Clean sheet kept** | CB | 8.0 | MI 4.14, Def 3.86 |
| | FB | 7.2 | MI 3.94, Def 3.19 |
| | GK | 5.3 | Def 4.08, MI 1.14 |
| **Goal conceded** | CB | -4.7 | Def -3.21, MI -1.51 |
| **Tackle** | DM | 2.3 | MI 1.47, Infl 0.59, Def 0.22 |
| | CB | 1.4 | MI 0.87, Def 0.40, Infl 0.10 |
| **3 clearances/blocks/interceptions** | DM | 3.1 | Infl 1.71, MI 0.73, Def 0.68 |
| | CB | 1.3 | Def 0.61, MI 0.43, Infl 0.29 |
| **3 recoveries** | FB | 0.8 | Def 0.46, MI 0.38 |
| **Big chance created (+ its key pass)** | DM | 4.5 | MI 3.01, Infl 1.04, Crea 0.48 |
| | AM | 3.4 | Crea 2.49, MI 0.68, Infl 0.22 |
| **Key pass** | CM | 2.8 | Crea 1.96, MI 0.51, Infl 0.34 |
| **Cross** | CM | 1.3 | Crea 0.63, MI 0.51, Infl 0.15 |
| **Shot on target** | ST | 2.5 | Thr 1.57, MI 0.73, Infl 0.18 |
| | DM | 2.4 | MI 1.47, Infl 0.87 |
| **Save (inside the box)** | GK | 1.9 | Save 1.17, MI 0.33, Infl 0.27, Def 0.08 |
| Dribble | all | 0.3-1.1 | MI (DM/CM also Infl 0.2-0.3) |
| 3 line-breaking passes | all | 0.1-0.9 | MI |
| Cards, fouls, offsides, errors, dispossessed, pass completion | all | | MI only |

`price.json` has every event at every position.

## Findings

1. **Goals and assists count three or four times.** Goal Involvement,
   Finishing (a goal is +1 against xG) and Influence (about 30 per goal) all
   pay for the same goal, and Creativity also pays for an assist. Influence
   is the unintended copy: Match Impact already strips goals and assists from
   BPS, but nothing strips them from Influence.
2. **A goal's value depends on position by accident.** Goal Involvement uses
   one cross-position scale so a goal is worth the same to anyone, but the
   position weights undo that: a DM's goal is paid 90% through Influence
   (weight 0.25 plus flex) and only 1.1 points through Goal Involvement.
   Taking goals out of Influence without changing weights would make a DM's
   goal worth about 1-2 points.
3. **Match Impact pays for nearly everything a specialist component scores.**
   BPS includes clean sheets and goals conceded, saves, tackles, CBI and
   recoveries, key passes, big chances and crosses, and shots. For a CB, half
   of a clean sheet's value comes through BPS. For tackles and CBI at every
   outfield position, Match Impact pays more than Defensive does.
4. **Influence is a second Match Impact for midfielders and attackers**
   (r 0.63-0.76 with goals and assists out). For defenders and keepers it
   measures something different enough (r 0.28-0.44).
5. **Finishing doubles a goal by construction** (goals minus xG). This is a
   design question rather than an accident: it rewards scoring above the
   chance, but in points a winger's goal is paid more through Finishing (7.6)
   than through Goal Involvement (5.8).

Single-component events today: dribbles, line-breaking passes, discipline,
fouls, errors, dispossessions, offsides, pass completion (all Match Impact
only), aerial duels (Defensive only).

## Why the fixes interact

The position weights were set with these copies in place, so removing a copy
lowers what that event is worth unless a weight changes with it. Each fix is
therefore a strip plus a stated decision about the event's value, checked on
the leaderboard, one at a time.
