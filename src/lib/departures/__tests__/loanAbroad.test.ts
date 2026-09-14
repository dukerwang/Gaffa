/**
 * Loan-vs-permanent classification. The news strings below are copied from
 * real FPL elements on 2026-09-12 (departure_decisions joined to players).
 */

import { describe, it, expect } from 'vitest';
import { parseLoanNews, findLoanAbroad } from '../loanAbroad';
import type { FplElement } from '@/lib/players/plPresence';

describe('parseLoanNews', () => {
  it('reads a season-long loan and the club', () => {
    expect(parseLoanNews('Has joined Juventus on loan for the rest of the season')).toEqual({ club: 'Juventus' });
    expect(parseLoanNews('Has joined ACF Fiorentina on loan for the rest of the season')).toEqual({ club: 'ACF Fiorentina' });
    expect(parseLoanNews('Has joined RC Strasbourg on loan for the rest of the season')).toEqual({ club: 'RC Strasbourg' });
  });

  it('accepts loan phrasings without a named club', () => {
    expect(parseLoanNews('Currently on a season-long loan')).toEqual({ club: null });
  });

  it('rejects permanent moves', () => {
    expect(parseLoanNews('Has joined Al Hilal permanently')).toBeNull();
    expect(parseLoanNews('Has joined Internazionale permanently')).toBeNull();
  });

  it('rejects anything it cannot read as a loan', () => {
    expect(parseLoanNews('not included in squad.')).toBeNull();
    expect(parseLoanNews('Loan move made permanent')).toBeNull();
    expect(parseLoanNews('Knee injury - Expected back 01 Oct')).toBeNull();
    expect(parseLoanNews('')).toBeNull();
    expect(parseLoanNews(null)).toBeNull();
  });
});

describe('findLoanAbroad', () => {
  const el = (overrides: Partial<FplElement>): FplElement => ({
    id: 700,
    first_name: 'Nick',
    second_name: 'Woltemade',
    web_name: 'Woltemade',
    team: 15,
    status: 'u',
    news: 'Has joined Juventus on loan for the rest of the season',
    ...overrides,
  });

  it('finds the loan on the matching element', () => {
    expect(findLoanAbroad({ fpl_id: 700, name: 'Nick Woltemade' }, [el({})])).toEqual({ club: 'Juventus' });
  });

  it('ignores an element that is not flagged unavailable', () => {
    expect(findLoanAbroad({ fpl_id: 700, name: 'Nick Woltemade' }, [el({ status: 'a' })])).toBeNull();
  });

  it('ignores a reassigned id that now belongs to someone else', () => {
    const other = el({ first_name: 'Harvey', second_name: 'Elliott', web_name: 'Elliott' });
    expect(findLoanAbroad({ fpl_id: 700, name: 'Nick Woltemade' }, [other])).toBeNull();
  });

  it('returns null without an fpl_id or a live element', () => {
    expect(findLoanAbroad({ fpl_id: null, name: 'Nick Woltemade' }, [el({})])).toBeNull();
    expect(findLoanAbroad({ fpl_id: 701, name: 'Nick Woltemade' }, [el({})])).toBeNull();
  });
});
