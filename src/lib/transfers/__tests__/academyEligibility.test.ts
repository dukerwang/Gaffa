/**
 * Gaffa — proactive academy eligibility (migration 117)
 *
 * This gates whether BidDialog even shows the "send to academy" checkbox —
 * it must agree with the server-side re-check in resolve_single_player_auction_rpc
 * (age vs taxi_age_limit, occupancy vs taxi_size) or a manager sees an option
 * the server will refuse, or misses one the server would have honored.
 */

import { describe, it, expect } from 'vitest';
import { calculateAgeInYears, isAcademyEligible, getSeasonReferenceDate } from '../academyEligibility';

const REF = new Date('2026-08-07T00:00:00Z');
const academy = (current: number, max = 3, age_limit = 21) => ({ current, max, age_limit });

describe('getSeasonReferenceDate', () => {
    it('returns August 1 of the season start year for formatted season strings', () => {
        expect(getSeasonReferenceDate('2025-26').toISOString()).toBe('2025-08-01T00:00:00.000Z');
        expect(getSeasonReferenceDate('2026-27').toISOString()).toBe('2026-08-01T00:00:00.000Z');
    });

    it('anchors season age so a mid-season birthday does not age a player out early', () => {
        // Mainoo born 2005-04-19:
        // In 2025-26 season, kickoff anchor is 2025-08-01. Age on anchor = 20.
        const ref25 = getSeasonReferenceDate('2025-26');
        expect(calculateAgeInYears('2005-04-19', ref25)).toBe(20);
        expect(isAcademyEligible('2005-04-19', academy(0, 3, 21), ref25)).toBe(true);

        // In 2026-27 season, kickoff anchor is 2026-08-01. Age on anchor = 21.
        // Even when turning 22 during the season (2027-04-19), season age remains 21.
        const ref26 = getSeasonReferenceDate('2026-27');
        expect(calculateAgeInYears('2005-04-19', ref26)).toBe(21);
        expect(isAcademyEligible('2005-04-19', academy(0, 3, 21), ref26)).toBe(true);

        // In 2027-28 season, kickoff anchor is 2027-08-01. Age on anchor = 22.
        // Now he has aged out at season reset.
        const ref27 = getSeasonReferenceDate('2027-28');
        expect(calculateAgeInYears('2005-04-19', ref27)).toBe(22);
        expect(isAcademyEligible('2005-04-19', academy(0, 3, 21), ref27)).toBe(false);
    });
});

describe('calculateAgeInYears', () => {
    it('counts a birthday that already passed this year', () => {
        expect(calculateAgeInYears('2006-01-01', REF)).toBe(20);
    });

    it('does not count a birthday that has not happened yet this year', () => {
        expect(calculateAgeInYears('2006-12-31', REF)).toBe(19);
    });

    it('counts the birthday itself as already turned', () => {
        expect(calculateAgeInYears('2006-08-07', REF)).toBe(20);
    });
});

describe('isAcademyEligible', () => {
    it('is eligible for a U21 player when the academy has room', () => {
        expect(isAcademyEligible('2006-01-01', academy(1), REF)).toBe(true);
    });

    it('is not eligible once the academy is at capacity', () => {
        expect(isAcademyEligible('2006-01-01', academy(3, 3), REF)).toBe(false);
    });

    it('is not eligible for a player older than the age limit', () => {
        expect(isAcademyEligible('2000-01-01', academy(0), REF)).toBe(false);
    });

    it('is eligible exactly at the age limit', () => {
        expect(isAcademyEligible('2005-08-07', academy(0), REF)).toBe(true);
    });

    it('is not eligible without a date of birth on record', () => {
        expect(isAcademyEligible(null, academy(0), REF)).toBe(false);
        expect(isAcademyEligible(undefined, academy(0), REF)).toBe(false);
    });

    it('respects a league-specific age limit', () => {
        expect(isAcademyEligible('2003-01-01', academy(0, 3, 23), REF)).toBe(true);
        expect(isAcademyEligible('2003-01-01', academy(0, 3, 21), REF)).toBe(false);
    });
});
