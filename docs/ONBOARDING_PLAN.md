# Walkthroughs and the Barcola Example

**Status:** Proposal for Duke, revised 2026-11-08 after he saw the first prototype. Nothing here is built. Prototype: Claude Design project `a374f0d1-ef30-4e18-8345-68b69adeab26`, file `Walkthroughs.dc.html`.

## What changed

The first prototype was a playable fake auction. Duke (2026-11-08): "it doesn't need to be this interactive, with a fake bid and everything, just needs to be simple enough that users will understand how certain systems in gaffa work." The example should say that when Barcola moved from PSG to Liverpool in real life, he appeared in Gaffa's auctions and people could bid to sign him. Walkthroughs explain how you would do something; they don't make you practise it. He also asked for an explanation of auction timing, because "that's fairly complicated."

## Where each piece lives

**Front page: the Barcola example.** A four-stop panel in the Transfer Wire section: Real Life (PSG to Liverpool), In Gaffa (a free-agent lot in every league), Bidding (the real auction's price line, 26 bids from 5 clubs), Signed (€164m). No input. A door at the foot, How Auctions Work, opens the timing steps. Signed-in users with no league see the same page, so this reaches both visitors and fresh signups.

**Help: Walkthroughs.** Four chapters above the existing links: My Club, Lineups, Transfer Market, Cups. Today Help is two links and a report form.

**On the real pages: the walkthrough itself.** A chapter dims the real page, spotlights one part at a time and explains it in a sentence, with Next and Back only. Nothing can be bought, dropped or bid through it. The Transfer Market chapter covers The Board, Standing Bid, Bid, Club Balance and Closes, then four timing steps.

**Auction timing.** The `?` beside The Auction Room today opens three short sentences (`AuctionTimingHelp`). It would open the four timing steps instead, each with a diagram:

| Step | Shows |
|------|-------|
| Minimum Length | 12h, 24h, 48h or 72h by market value (`tierInitialFloorMs`) |
| After Each Bid | The countdown each bid restarts: 6h, 4h, 2h, 1h as the auction ages (`DECAY_BANDS`) |
| The Close | Barcola's real timeline: 72h minimum, last bid at about 74h, closed 2 hours later |
| Overnight | Nothing closes between 23:00 and midday (`civilSettleFor`) |

Left out for simplicity, and still in the guide: the uncontested weekend lot under €20m that settles at 06:45, and Transfer Day in redraft leagues, which needs its own timing step if a redraft league opens this chapter.

## Build notes

- The tour runs from a static list of steps in the bundle and reads the page's own data, so it makes no API calls.
- Seen state goes in `localStorage`, so a first visit can offer the chapter once and dismiss once.
- The Barcola panel uses figures the front page already loads (`loadShowcase.ts`: value, winning bid, bid amounts, bid and club counts). PSG isn't in that data and would be a pinned constant.
- Don't rebuild the pitch or player card. Spotlights target shipped elements through a `data-tour` attribute.
- Chapters still to write after the Transfer Market is approved: My Club, Lineups, Cups.

## How to tell if it works

`scripts/funnel.mjs` (PR 119) can't see anyone before an account exists, and real signups are rare, so early readings will be anecdotes. For in-league chapters, compare the rate of first bids and first lineups between managers who finish a chapter and those who don't, using a flag stored on the member row when a chapter finishes.
