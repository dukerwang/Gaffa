# App-wide copy sweep — 2026-09-12

Wording-only changes from a Google developer style and inanimate-agency sweep,
made on `feat/projected-points` and left **uncommitted** there. No logic changed.
Build passed; 685/685 tests passed after the matching test assertions were updated.

Review one change at a time below. To undo everything, reverse the patch:

```bash
git apply -R docs/reviews/2026-09-12-app-copy-sweep.patch
```

To undo a single change, edit that string back by hand; the "Before" column is
exact. The patch contains ONLY these replacements, even in files that had other
sessions' uncommitted work at the time.

Left alone on purpose: Privacy and Terms ("we" is standard in legal text),
generated match-report prose, and celebratory broadcast copy ("HERE WE GO!",
trophy wins).

| # | File | Before | After |
|---|---|---|---|
| 1 | `…/league/_home/Fixture.tsx` | open. Release takes the compensation and bars you from his return auction; retain keeps the claim and pays nothing. | open. Release him and you take the compensation but can’t bid in his return auction. Retain him and you keep the claim at no cost. |
| 2 | `…/league/_home/Sections.tsx` | Pays is the placement prize at that finish, on today&rsquo;s table. Form reads newest first. | Pays: the placement prize for that finish on today&rsquo;s table. Form: newest result first. |
| 3 | `…/league/transfers/auctions/AuctionsClient.tsx` | title="Bidding decides this — you cannot withdraw it" | title="You can’t withdraw this lot. The highest bidder signs him." |
| 4 | `…/league/transfers/auctions/AuctionsClient.tsx` | Triggering the buyout ends the auction immediately. | Trigger the buyout to sign him immediately and end the auction. |
| 5 | `src/components/settings/SettingsClient.tsx` | In-game mail always arrives. Push and email follow the switches below. | You always get in-game mail. Use the switches below to turn push and email on or off. |
| 6 | `src/components/transfers/ProposeBuilder.tsx` | Likely bonus if he holds {recentPPG.toFixed(2)} PPG | Projected bonus at {recentPPG.toFixed(2)} PPG |
| 7 | `src/components/transfers/ProposeBuilder.tsx` | ? `Leaves ${money(Math.max(0, budget - deal.netFaab))} of ${money(budget)}` : `Takes you to ${money(budget - deal.netFaab)}` | ? `${money(Math.max(0, budget - deal.netFaab))} left of ${money(budget)}` : `Balance after: ${money(budget - deal.netFaab)}` |
| 8 | `src/lib/transfers/describeDeal.ts` | 'Cash for cash just moves budget around — put a player or a retained right on the table.' | 'A cash-for-cash swap changes nothing. Add a player or a retained right.' |
| 9 | `…/league/inbox/InboxClient.tsx` | 'You have catch up on all events! Switch back to "All Alerts" to review historical ledger logs.' | 'You’re all caught up. Switch to All Alerts to see earlier events.' |
| 10 | `…/league/inbox/InboxClient.tsx` | 'There are no active notifications for your manager profile in this league yet.' | 'You have no notifications in this league yet.' |
| 11 | `…/league/team/roster/SquadViews.tsx` | 'Showing only players who can actually be fielded this week.' | 'Showing only players you can field this week.' |
| 12 | `src/components/auth/AuthShowcase.tsx` | 'Our scoring engine values actual on-pitch contributions — not arbitrary points. Flip any premium card to view real game logs, form ratings, and granular match statistics.' | 'Gaffa scores what a player does on the pitch, not an arbitrary points table. Flip any premium card to view real game logs, form ratings, and granular match statistics.' |
| 13 | `src/lib/email/templates.ts` | (€${thresholdM}m+ valuation) have just been posted to the auction board. | (€${thresholdM}m+ valuation) are on the auction board. |
| 14 | `src/lib/email/templates.ts` | baseTemplate('Player Sold!', body) | baseTemplate('Player Sold', body) |
| 15 | `src/lib/email/templates.ts` | baseTemplate('The Draft is Starting!', body) | baseTemplate('The Draft Is Starting', body) |
| 16 | `…/league/draft/DraftRoom.tsx` | 'Network error. Please try again.' | 'Network error. Try again.' |
| 17 | `…/league/draft/DraftRoom.tsx` | 'Timer expired! (Auto-pick disabled for Demo/Test leagues)' | 'Time expired. Auto-pick is off in demo and test leagues.' |
| 18 | `…/league/draft/DraftRoom.tsx` | 'Time expired! Auto-picking...' | 'Time expired. Auto-picking…' |
| 19 | `src/app/(auth)/login/page.tsx` | in Vercel. Please add NEXT_PUBLIC_SUPABASE_URL | in Vercel. Add NEXT_PUBLIC_SUPABASE_URL |
| 20 | `src/app/api/leagues/[leagueId]/auctions/bid/route.ts` | Cannot place a bid while you have a healthy player occupying an IR slot. Please activate them first. | You can’t bid while a healthy player is on IR. Activate him first. |
| 21 | `src/app/api/leagues/[leagueId]/trades/route.ts` | Cannot propose trades while you have a healthy player occupying an IR slot. Please activate them first. | You can’t propose a trade while a healthy player is on IR. Activate him first. |
| 22 | `src/app/api/leagues/[leagueId]/trades/route.ts` | One or more offered players are currently out on loan and cannot be traded | One or more offered players are out on loan and can’t be traded |
| 23 | `src/app/api/leagues/[leagueId]/trades/route.ts` | One or more requested players are currently out on loan and cannot be traded | One or more requested players are out on loan and can’t be traded |
| 24 | `src/app/api/leagues/[leagueId]/loans/route.ts` | . Please set a loan fee | . Set a loan fee |
| 25 | `…/league/PreDraftLobby.tsx` | set your queue, and configure scouting lists! | set your queue, and configure scouting lists. |
| 26 | `…/league/SidebarChat.tsx` | Write the first message! | Write the first message. |
| 27 | `…/league/trades/TradesClient.tsx` | Loan recalled! Penalty paid: | Loan recalled. Penalty paid: |
| 28 | `…/league/trades/TradesClient.tsx` | Slot buyback activated! Paid | Slot buyback activated. Paid |
| 29 | `…/league/trades/TradesClient.tsx` | Loan request sent! They will be notified to review your terms. | Loan request sent. They’ll get a notification to review your terms. |
| 30 | `…/league/trades/TradesClient.tsx` | No players are currently listed on the market. | No players are on the market. |
| 31 | `src/lib/notifications/valueTiers.ts` | 'Closing now!' | 'Closing now.' |
| 32 | `src/lib/notifications/valueTiers.ts` | `On the market now! ${window} to bid.` | `On the market now. ${window} to bid.` |
| 33 | `src/lib/notifications/valueTiers.ts` | : 'On the market now!'; | : 'On the market now.'; |
| 34 | `src/lib/notifications/copy.ts` | at ${euro(amount)}. ${timeClause}!` | at ${euro(amount)}. ${timeClause}.` |
| 35 | `src/lib/notifications/copy.ts` | ADVANCING: ${playerName} to ${abbr} (${euro(amount)}). ${timeClause}!` | ADVANCING: ${playerName} to ${abbr} (${euro(amount)}). ${timeClause}.` |
| 36 | `src/lib/roster/executeDrop.ts` | Returned loan activated! ** | Returned loan activated. ** |
| 37 | `…/league/team/PitchUI.tsx` | Fill all 4 bench slots. Currently ${benchPayload.length}/4. | Fill all 4 bench slots (${benchPayload.length}/4 filled). |
| 38 | `src/app/api/leagues/[leagueId]/draft/start/route.ts` | Currently only | So far only |
| 39 | `src/app/api/leagues/[leagueId]/listings/route.ts` | Cannot list a player currently loaned out | You can’t list a player who’s out on loan |
| 40 | `src/app/api/teams/[teamId]/ir/route.ts` | 'Target player is not currently on IR' | 'Target player isn’t on IR' |
| 41 | `src/app/api/teams/[teamId]/ir/route.ts` | 'Player is not currently on IR' | 'Player isn’t on IR' |
| 42 | `src/app/api/teams/[teamId]/taxi/route.ts` | 'Target player is not currently in the academy' | 'Target player isn’t in the academy' |
| 43 | `src/app/api/teams/[teamId]/taxi/route.ts` | 'Player is not currently in the academy' | 'Player isn’t in the academy' |
| 44 | `src/lib/departures/decisions.ts` | Those rights are not currently held. | You don’t hold those rights. |
| 45 | `src/app/api/teams/[teamId]/ir/__tests__/route.test.ts` | toBe('Player is not currently on IR') | toBe('Player isn’t on IR') |
| 46 | `src/app/api/teams/[teamId]/ir/__tests__/route.test.ts` | toBe('Target player is not currently on IR') | toBe('Target player isn’t on IR') |
| 47 | `src/lib/notifications/__tests__/valueTiers.test.ts` | On the market now! | On the market now. |
| 48 | `src/lib/notifications/__tests__/valueTiers.test.ts` | Closing now! | Closing now. |
| 49 | `src/lib/notifications/__tests__/copy.test.ts` | 2h left to bid! | 2h left to bid. |
| 50 | `src/app/api/leagues/[leagueId]/trades/__tests__/route.test.ts` | /healthy player occupying an IR slot/ | /healthy player is on IR/ |
| 51 | `src/app/api/leagues/[leagueId]/trades/__tests__/route.test.ts` | /offered players are currently out on loan/ | /offered players are out on loan/ |
| 52 | `src/app/api/leagues/[leagueId]/trades/__tests__/route.test.ts` | /requested players are currently out on loan/ | /requested players are out on loan/ |
| 53 | `src/app/api/leagues/[leagueId]/auctions/bid/__tests__/route.test.ts` | /healthy player occupying an IR slot/ | /healthy player is on IR/ |
