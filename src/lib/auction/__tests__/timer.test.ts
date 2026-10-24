/**
 * Gaffa — auction close timing with Market Value Tiers & Smart Overnight Protection
 */

import { describe, it, expect } from 'vitest';
import {
    MIN_DURATION_MS,
    INITIAL_WINDOW_MS,
    DEFAULT_QUIET_HOURS,
    TIER_1_FLOOR_MS,
    TIER_2_FLOOR_MS,
    TIER_3_FLOOR_MS,
    TIER_4_FLOOR_MS,
    tierInitialFloorMs,
    inactivityTimeoutMs,
    applyQuietHours,
    calculateExpiresAt,
    initialAuctionExpiry,
    nextCivilRelease,
} from '../timer';
import type { QuietHours } from '../timer';

const H = 60 * 60 * 1000;
const at = (iso: string) => Date.parse(iso);

// A fixed, DST-free reference point: Wed 2026-02-11 12:00:00 UTC.
const T0 = Date.parse('2026-02-11T12:00:00.000Z');

// Quiet hours in UTC keep the tests readable — the timezone path is exercised separately below.
const UTC_QUIET: QuietHours = { start: '00:00', end: '08:00', timeZone: 'UTC' };

describe('tierInitialFloorMs', () => {
    it('assigns correct floor durations across market value tiers', () => {
        expect(tierInitialFloorMs(0)).toBe(TIER_1_FLOOR_MS); // 12h for < €25m
        expect(tierInitialFloorMs(15)).toBe(TIER_1_FLOOR_MS); // 12h
        expect(tierInitialFloorMs(24.9)).toBe(TIER_1_FLOOR_MS); // 12h
        expect(tierInitialFloorMs(25)).toBe(TIER_2_FLOOR_MS); // 24h for €25m–€50m
        expect(tierInitialFloorMs(45)).toBe(TIER_2_FLOOR_MS); // 24h
        expect(tierInitialFloorMs(50)).toBe(TIER_3_FLOOR_MS); // 48h for €50m–€80m
        expect(tierInitialFloorMs(79.9)).toBe(TIER_3_FLOOR_MS); // 48h
        expect(tierInitialFloorMs(80)).toBe(TIER_4_FLOOR_MS); // 72h for ≥ €80m
        expect(tierInitialFloorMs(120)).toBe(TIER_4_FLOOR_MS); // 72h
    });
});

describe('inactivityTimeoutMs', () => {
    it('decays across the four bands starting at 6 hours', () => {
        expect(inactivityTimeoutMs(0)).toBe(6 * H);
        expect(inactivityTimeoutMs(47 * H)).toBe(6 * H);
        expect(inactivityTimeoutMs(48 * H)).toBe(4 * H);
        expect(inactivityTimeoutMs(71 * H)).toBe(4 * H);
        expect(inactivityTimeoutMs(72 * H)).toBe(2 * H);
        expect(inactivityTimeoutMs(95 * H)).toBe(2 * H);
        expect(inactivityTimeoutMs(96 * H)).toBe(1 * H);
        expect(inactivityTimeoutMs(1000 * H)).toBe(1 * H);
    });

    it('never returns zero, so no bid can leave the close unmoved', () => {
        for (const age of [0, 1, 47.9, 48, 72, 96, 500, 10000]) {
            expect(inactivityTimeoutMs(age * H)).toBeGreaterThan(0);
        }
    });

    it('is monotonically non-increasing, so an auction always converges', () => {
        let prev = Infinity;
        for (let age = 0; age <= 200 * H; age += H) {
            const t = inactivityTimeoutMs(age);
            expect(t).toBeLessThanOrEqual(prev);
            prev = t;
        }
    });

    it('treats a negative age as a fresh auction rather than throwing', () => {
        expect(inactivityTimeoutMs(-5 * H)).toBe(6 * H);
    });
});

describe('applyQuietHours', () => {
    it('leaves a daytime expiry untouched', () => {
        const t = at('2026-02-11T14:30:00.000Z'); // Wed 14:30 UTC
        expect(applyQuietHours(t, UTC_QUIET)).toBe(t);
    });

    it('pushes a weekday overnight expiry to 12:00 PM (Noon) the same day', () => {
        // Wed 04:00 UTC -> Wed 12:00 UTC (Noon)
        expect(applyQuietHours(at('2026-02-11T04:00:00.000Z'), UTC_QUIET))
            .toBe(at('2026-02-11T12:00:00.000Z'));
    });

    it('pushes a 11:30 PM (23:30) weekday expiry to 12:00 PM (Noon) the next day', () => {
        // Wed 23:30 UTC -> Thu 12:00 UTC (Noon)
        expect(applyQuietHours(at('2026-02-11T23:30:00.000Z'), UTC_QUIET))
            .toBe(at('2026-02-12T12:00:00.000Z'));
    });

    it('pushes a weekend uncontested streamer (< €20m, 1 bid) to 6:45 AM', () => {
        // Sat 2026-02-14 03:00 UTC -> Sat 06:45 UTC
        const sat3am = at('2026-02-14T03:00:00.000Z');
        expect(applyQuietHours(sat3am, UTC_QUIET, { marketValue: 5, bidCount: 1 }))
            .toBe(at('2026-02-14T06:45:00.000Z'));
    });

    it('pushes a weekend contested auction (2+ bids) to 12:00 PM (Noon)', () => {
        // Sat 2026-02-14 03:00 UTC -> Sat 12:00 UTC (Noon)
        const sat3am = at('2026-02-14T03:00:00.000Z');
        expect(applyQuietHours(sat3am, UTC_QUIET, { marketValue: 5, bidCount: 2 }))
            .toBe(at('2026-02-14T12:00:00.000Z'));
    });

    it('pushes a weekend high-value auction (≥ €20m) to 12:00 PM (Noon) even if 1 bid', () => {
        // Sat 2026-02-14 03:00 UTC -> Sat 12:00 UTC (Noon)
        const sat3am = at('2026-02-14T03:00:00.000Z');
        expect(applyQuietHours(sat3am, UTC_QUIET, { marketValue: 50, bidCount: 1 }))
            .toBe(at('2026-02-14T12:00:00.000Z'));
    });

    it('pushes a Friday night overnight bid to Saturday morning according to streamer rules', () => {
        // Friday 2026-02-13 23:30 UTC -> natural expiry in Saturday early AM:
        // Uncontested streamer -> Saturday 06:45 UTC
        const friNight = at('2026-02-13T23:30:00.000Z');
        expect(applyQuietHours(friNight, UTC_QUIET, { marketValue: 5, bidCount: 1 }))
            .toBe(at('2026-02-14T06:45:00.000Z'));

        // Contested / high value -> Saturday 12:00 UTC (Noon)
        expect(applyQuietHours(friNight, UTC_QUIET, { marketValue: 80, bidCount: 2 }))
            .toBe(at('2026-02-14T12:00:00.000Z'));
    });

    it('respects non-UTC timezone (America/New_York)', () => {
        // 04:00 New York on Wed 2026-02-11 is 09:00 UTC.
        // It is overnight in NY, so pushed to 12:00 PM NY = 17:00 UTC.
        const ny: QuietHours = { start: '00:00', end: '08:00', timeZone: 'America/New_York' };
        expect(applyQuietHours(at('2026-02-11T09:00:00.000Z'), ny))
            .toBe(at('2026-02-11T17:00:00.000Z'));
    });

    it('is a no-op when quiet hours are disabled', () => {
        const t = at('2026-02-11T04:00:00.000Z');
        expect(applyQuietHours(t, null)).toBe(t);
    });
});

describe('applyQuietHours: the morning up to noon', () => {
    const ny: QuietHours = { start: '00:00', end: '08:00', timeZone: 'America/New_York' };

    it('pushes a close just past 08:00 to noon (Neto: Tue 08:33 EDT)', () => {
        expect(applyQuietHours(at('2026-10-20T12:33:42.000Z'), ny, { marketValue: 60, bidCount: 2 }))
            .toBe(at('2026-10-20T16:00:00.000Z'));
    });

    it('pushes an 11:59 close to noon and leaves a 12:00 close alone', () => {
        expect(applyQuietHours(at('2026-10-20T15:59:00.000Z'), ny, { marketValue: 60, bidCount: 2 }))
            .toBe(at('2026-10-20T16:00:00.000Z'));
        const noon = at('2026-10-20T16:00:00.000Z');
        expect(applyQuietHours(noon, ny, { marketValue: 60, bidCount: 2 })).toBe(noon);
    });

    it('moves a €60m lot to noon on a Saturday, never 06:45', () => {
        // Sat 2026-10-17 03:00 EDT, one bid, but €60m.
        expect(applyQuietHours(at('2026-10-17T07:00:00.000Z'), ny, { marketValue: 60, bidCount: 1 }))
            .toBe(at('2026-10-17T16:00:00.000Z'));
    });

    it('lets an uncontested weekend streamer close between 06:45 and noon', () => {
        const sat0900 = at('2026-10-17T13:00:00.000Z'); // Sat 09:00 EDT
        expect(applyQuietHours(sat0900, ny, { marketValue: 10, bidCount: 1 })).toBe(sat0900);
        // ...but not before 06:45: Sat 03:00 EDT goes to 06:45 EDT (10:45 UTC).
        expect(applyQuietHours(at('2026-10-17T07:00:00.000Z'), ny, { marketValue: 10, bidCount: 1 }))
            .toBe(at('2026-10-17T10:45:00.000Z'));
    });

    it('sends a weekday streamer to noon, not 06:45', () => {
        expect(applyQuietHours(at('2026-10-20T07:00:00.000Z'), ny, { marketValue: 10, bidCount: 1 }))
            .toBe(at('2026-10-20T16:00:00.000Z'));
    });
});

describe('calculateExpiresAt', () => {
    it('honours tier floors on fresh auctions', () => {
        // Tier 1 (< €25m): 12h floor
        expect(Date.parse(calculateExpiresAt(T0, T0, null, { marketValue: 10 })))
            .toBe(T0 + 12 * H);

        // Tier 2 (€25m–€50m): 24h floor
        expect(Date.parse(calculateExpiresAt(T0, T0, null, { marketValue: 35 })))
            .toBe(T0 + 24 * H);

        // Tier 3 (€50m–€80m): 48h floor
        expect(Date.parse(calculateExpiresAt(T0, T0, null, { marketValue: 60 })))
            .toBe(T0 + 48 * H);

        // Tier 4 (≥ €80m): 72h floor
        expect(Date.parse(calculateExpiresAt(T0, T0, null, { marketValue: 80 })))
            .toBe(T0 + 72 * H);
    });

    it('closes 6 hours after the last bid once past the initial floor', () => {
        const first = T0;
        const last = T0 + 30 * H; // past Tier 2 (24h) floor, age 30h -> 6h timeout
        expect(Date.parse(calculateExpiresAt(first, last, null, { marketValue: 30 })))
            .toBe(last + 6 * H);
    });

    it('uses the decayed timeout deep into a contested auction', () => {
        const first = T0;
        for (const [ageH, timeoutH] of [[50, 4], [80, 2], [120, 1]] as const) {
            const last = first + ageH * H;
            expect(Date.parse(calculateExpiresAt(first, last, null, { marketValue: 30 })))
                .toBe(last + timeoutH * H);
        }
    });

    it('never freezes — within each decay band, a later bid yields a later close', () => {
        const first = T0;
        // Band 1: age 24h..48h
        let prev = Date.parse(calculateExpiresAt(first, first + 24 * H, null, { marketValue: 10 }));
        for (let ageH = 25; ageH <= 47; ageH++) {
            const out = Date.parse(calculateExpiresAt(first, first + ageH * H, null, { marketValue: 10 }));
            expect(out).toBeGreaterThan(prev);
            prev = out;
        }
    });

    it('protects the Bouaddi scenario (Saturday night bid on €80m player)', () => {
        // First bid Friday 15:40 EDT (19:40 UTC)
        const ny: QuietHours = { start: '00:00', end: '08:00', timeZone: 'America/New_York' };
        const first = at('2026-08-28T19:40:55.000Z');
        // Saturday 21:08 EDT (Sunday 01:08 UTC)
        const last = at('2026-08-30T01:08:20.000Z');

        // €80m player (Tier 4, 72h floor), bidCount = 6
        const expiresAt = calculateExpiresAt(first, last, ny, { marketValue: 80, bidCount: 6 });
        const expiresMs = Date.parse(expiresAt);

        // In NY timezone, must not expire at 9:08 AM EDT! Must stay open through at least Sunday 12:00 PM EDT (16:00 UTC)
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(new Date(expiresMs));
        const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');

        // It must resolve at or after 12:00 PM EDT
        expect(hour).toBeGreaterThanOrEqual(12);
    });
});

describe('calculateExpiresAt: bids placed overnight', () => {
    const ny: QuietHours = { start: '00:00', end: '08:00', timeZone: 'America/New_York' };

    it('holds an overnight bid open until noon even when the floor close is just past quiet hours (Neto)', () => {
        // Opened Sun 2026-10-18 08:33 EDT (12:33 UTC); €60m -> 48h floor -> Tue 08:33 EDT.
        const first = at('2026-10-18T12:33:42.000Z');
        // Rival bids Tue 00:47 EDT (04:47 UTC), 7h46m before the floor close.
        const last = at('2026-10-20T04:47:12.000Z');
        // Noon EDT Tue is 16:00 UTC.
        expect(Date.parse(calculateExpiresAt(first, last, ny, { marketValue: 60, bidCount: 2 })))
            .toBe(at('2026-10-20T16:00:00.000Z'));
    });

    it('rolls a 23:30 bid to noon the next day when the floor close is just past quiet hours', () => {
        const first = at('2026-10-18T12:33:42.000Z');
        const last = at('2026-10-19T03:30:00.000Z'); // Sun 23:30 EDT; €30m floor closes Mon 08:33 EDT
        expect(Date.parse(calculateExpiresAt(first, last, ny, { marketValue: 30, bidCount: 2 })))
            .toBe(at('2026-10-19T16:00:00.000Z'));
    });

    it('leaves an afternoon bid and an afternoon close on the same clock as before', () => {
        const first = at('2026-10-18T18:00:00.000Z'); // Sun 14:00 EDT
        const last = at('2026-10-20T00:47:12.000Z'); // Mon 20:47 EDT
        expect(Date.parse(calculateExpiresAt(first, last, ny, { marketValue: 60, bidCount: 2 })))
            .toBe(first + 48 * H);
    });

    it('never closes earlier than the clock it would have had without the overnight rule', () => {
        const first = at('2026-10-18T12:33:42.000Z');
        const last = at('2026-10-20T04:47:12.000Z');
        const withGuard = Date.parse(calculateExpiresAt(first, last, ny, { marketValue: 60, bidCount: 2 }));
        const without = Date.parse(calculateExpiresAt(first, last, null, { marketValue: 60, bidCount: 2 }));
        expect(withGuard).toBeGreaterThanOrEqual(without);
    });

    it('does not delay an uncontested weekend first bid past its normal 12h window', () => {
        // Sat 2026-10-17 00:30 EDT first bid on a €10m player: 12h floor -> Sat 12:30, past 6:45.
        const first = at('2026-10-17T04:30:00.000Z');
        expect(Date.parse(calculateExpiresAt(first, first, ny, { marketValue: 10, bidCount: 1 })))
            .toBe(first + 12 * H);
    });
});

describe('initialAuctionExpiry', () => {
    it('opens tiered initial windows based on market value', () => {
        expect(Date.parse(initialAuctionExpiry(T0, null, 10))).toBe(T0 + 12 * H);
        expect(Date.parse(initialAuctionExpiry(T0, null, 30))).toBe(T0 + 24 * H);
        expect(Date.parse(initialAuctionExpiry(T0, null, 60))).toBe(T0 + 48 * H);
        expect(Date.parse(initialAuctionExpiry(T0, null, 80))).toBe(T0 + 72 * H);
    });

    it('defaults to 72h when market value is not provided', () => {
        expect(Date.parse(initialAuctionExpiry(T0, null))).toBe(T0 + INITIAL_WINDOW_MS);
        expect(INITIAL_WINDOW_MS).toBe(72 * H);
    });
});


/**
 * A marquee mid-season arrival is swept in by the nightly player sync, which
 * can fire at any hour. The lot itself is blind, but its "auction is live"
 * notification is not — released at 4am it reaches whoever happens to be awake.
 */
describe('nextCivilRelease', () => {
    const ny: QuietHours = { start: '00:00', end: '08:00', timeZone: 'America/New_York' };

    function nyTime(iso: string): number {
        return new Date(iso).getTime();
    }

    it('defers a small-hours sweep to the same day at noon', () => {
        // 04:00 America/New_York on a Wednesday (08:00 UTC, EDT = UTC-4).
        const at4am = nyTime('2026-09-02T08:00:00Z');
        const out = nextCivilRelease(at4am, ny);
        expect(out).not.toBeNull();
        expect((out! - at4am) / (60 * 60 * 1000)).toBe(8);
    });

    it('defers an afternoon sweep to the following noon', () => {
        // 16:00 America/New_York (20:00 UTC).
        const at4pm = nyTime('2026-09-02T20:00:00Z');
        const out = nextCivilRelease(at4pm, ny);
        expect((out! - at4pm) / (60 * 60 * 1000)).toBe(20);
    });

    it('opens immediately when the sweep already runs at noon', () => {
        expect(nextCivilRelease(nyTime('2026-09-02T16:00:00Z'), ny)).toBeNull();
    });

    it('opens immediately when a league has quiet hours disabled', () => {
        expect(nextCivilRelease(nyTime('2026-09-02T08:00:00Z'), null)).toBeNull();
    });

    it('gives a deferred lot its full tier window from the open, not the sweep', () => {
        const at4am = nyTime('2026-09-02T08:00:00Z');
        const opensAt = nextCivilRelease(at4am, ny)!;
        // Barcola: €65m is tier 3, so 48h from the noon he actually goes live.
        const expiry = new Date(initialAuctionExpiry(opensAt, ny, 65)).getTime();
        expect((expiry - opensAt) / (60 * 60 * 1000)).toBe(48);
    });
});
