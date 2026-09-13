# Heritage copy sweep — 2026-09-12

Wording-only changes to the Heritage hub, made on `feat/heritage-targets-projections`
in the worktree `/private/tmp/gaffa-worktrees/heritage-copy-sweep` and left
**uncommitted** there. No logic changed. `tsc` clean, 37/37 Heritage tests,
UI-rules check clean, `next build --webpack` passes. (Turbopack can't build that
worktree because its `node_modules` is a symlink to the main checkout.)

This patch applies to the Heritage branch, not `feat/projected-points`. To undo
it from the worktree: `git checkout -- src/app`, or `git apply -R` this patch.

| # | Rule | File | Before | After |
|---|---|---|---|---|
| 1 | title-case | `heritage/HeritageOverview.tsx` | stake="Seasons completed" | stake="Seasons Completed" |
| 2 | title-case | `heritage/HeritageOverview.tsx` | stake="Trophies awarded" | stake="Trophies Awarded" |
| 3 | title-case | `heritage/HeritageOverview.tsx` | stake="League titles" | stake="League Titles" |
| 4 | title-case, name | `heritage/HeritageOverview.tsx` | stake="Trophies in total" | stake="Total Trophies" |
| 5 | title-case | `heritage/HeritageOverview.tsx` | {c.total === 1 ? 'trophy' : 'trophies'} | {c.total === 1 ? 'Trophy' : 'Trophies'} |
| 6 | title-case | `heritage/HeritageOverview.tsx` | stake="Matches played" | stake="Matches Played" |
| 7 | title-case | `heritage/HeritageOverview.tsx` | stake="Win rate" | stake="Win Rate" |
| 8 | title-case | `heritage/HeritageOverview.tsx` | stake="All-time record" | stake="All-Time Record" |
| 9 | title-case | `heritage/HeritageOverview.tsx` | stake="Points scored" | stake="Points Scored" |
| 10 | title-case | `heritage/head-to-head/[opponentId]/PairingView.tsx` | >Points for</div> | >Points For</div> |
| 11 | title-case | `heritage/head-to-head/[opponentId]/PairingView.tsx` | >Points against</div> | >Points Against</div> |
| 12 | title-case | `heritage/seasons/SeasonsView.tsx` | <div className={styles.figS}>points</div> | <div className={styles.figS}>Points</div> |
| 13 | title-case | `heritage/seasons/SeasonsView.tsx` | >Players used</div> | >Players Used</div> |
| 14 | name, not caption | `heritage/cabinets/CabinetsView.tsx` | >Still Waiting</h2> | >Empty Cabinets</h2> |
| 15 | name, not caption | `heritage/head-to-head/RivalriesView.tsx` | >Around the League</h2> | >Other Rivalries</h2> |
| 16 | figurative | `heritage/HeritageOverview.tsx` | {leagueName} crowns its first champion at the end of {currentSeason}. Until then the board below is a wall waiting to be filled. | {leagueName} crowns its first champion at the end of {currentSeason}. |
| 17 | agency, passive | `heritage/HeritageOverview.tsx` | 'No completed fixtures yet. Your record fills in as the season is scored.' | 'No completed fixtures yet. You’ll see your record after your first one.' |
| 18 | passive | `heritage/HeritageOverview.tsx` | 'Head-to-head records are shown for managers with a club in this league.' | 'You need a club in this league to see head-to-head records.' |
| 19 | agency, passive | `heritage/records/RecordBookView.tsx` | Nothing is on record yet. The first completed gameweek sets every one of these. | No records yet. You’ll see them after the first completed gameweek. |
| 20 | passive | `heritage/head-to-head/RivalriesView.tsx` | No club has met another yet. Records appear once the first gameweek is scored. | No club has played another yet. You’ll see records after the first completed gameweek. |
| 21 | contraction | `heritage/head-to-head/[opponentId]/PairingView.tsx` | These two have not met in a completed fixture yet. | These two haven’t met in a completed fixture yet. |
| 22 | passive | `heritage/cabinets/CabinetsView.tsx` | : 'Nothing has been won yet' | : 'No club has won a trophy yet' |
| 23 | passive, figurative | `heritage/seasons/SeasonsView.tsx` | No season has been archived yet. {currentSeason} is the league&rsquo;s first, and it lands here when it ends. | No completed seasons yet. {currentSeason} is the league&rsquo;s first, and you&rsquo;ll see it here once it ends. |
| 24 | em dash, passive | `heritage/seasons/SeasonsView.tsx` | `${currentSeason} in progress — nothing archived yet` | `${currentSeason} in progress. No completed seasons yet.` |
| 25 | passive | `heritage/seasons/SeasonsView.tsx` | No lineups were archived for {selected}, so the winning side cannot be reconstructed. | Gaffa has no saved lineups for {selected}, so it can’t show the winning side. |
