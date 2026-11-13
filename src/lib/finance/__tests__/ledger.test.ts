import { describe, expect, it } from 'vitest';
import { buildLedger, rowAmount, type TransactionRow } from '../ledger';
import { committedTo, liveBidsFor, matchRevenueOutlook } from '../outlook';
import { DEFAULT_MERIT_RATES } from '@/lib/economy/meritPayments';

const tx = (id: string, type: string, at: string, faab_bid: number | null, compensation_amount: string | null = null, notes: string | null = null): TransactionRow => ({
  id, type, faab_bid, compensation_amount, notes, processed_at: at, player: null,
});

describe('rowAmount', () => {
  it('reads the bid first, so a signing with severance counts the bid alone', () => {
    // The drop row carries the same severance; counting it here too would double it.
    expect(rowAmount({ faab_bid: 20, compensation_amount: '4' })).toBe(20);
    expect(rowAmount({ faab_bid: null, compensation_amount: '4.00' })).toBe(4);
    expect(rowAmount({ faab_bid: 0, compensation_amount: null })).toBe(0);
  });
});

describe('loan fees', () => {
  it('reads the payer side, written negative, as money out', () => {
    const ledger = buildLedger({
      teamId: 'a', currentBalance: 92, clubName: () => '', trades: [],
      transactions: [tx('1', 'loan_fee', '2026-09-01T00:00:00Z', -8, null, 'Paid loan fee for player')],
    });
    expect(ledger.entries[0]).toMatchObject({ direction: 'out', amount: 8, balanceAfter: 92 });
    expect(ledger.opening).toBe(100);
  });

  it('reads every loan movement by its sign, for payer and receiver alike', () => {
    const rows = [
      tx('1', 'loan_bonus', '2026-09-02T00:00:00Z', -5),
      tx('2', 'loan_recall_penalty', '2026-09-03T00:00:00Z', 4),
      tx('3', 'loan_slot_buyback', '2026-09-04T00:00:00Z', -25),
    ];
    const ledger = buildLedger({ teamId: 'a', currentBalance: 74, clubName: () => '', trades: [], transactions: rows });
    expect(ledger.entries.map((e) => [e.direction, e.amount])).toEqual([['out', 5], ['in', 4], ['out', 25]]);
    expect(ledger.opening).toBe(100);
  });
});

describe('buildLedger', () => {
  const clubName = (id: string) => ({ a: 'Club A', b: 'Club B' })[id] ?? '?';

  it('derives the opening balance and running balances oldest first', () => {
    const ledger = buildLedger({
      teamId: 'a',
      currentBalance: 222,
      clubName,
      trades: [],
      transactions: [
        tx('3', 'merit_payment', '2026-09-20T00:00:00Z', 9, null, 'Match Revenue — GW1–4 (3W 0D 1L)'),
        tx('1', 'waiver_claim', '2026-08-25T00:00:00Z', 40, '3'),
        tx('2', 'drop', '2026-08-25T00:00:00Z', null, '3'),
        tx('4', 'free_agent_pickup', '2026-09-21T00:00:00Z', 0),
        tx('5', 'grant', '2026-09-01T12:00:00Z', 30, null, 'Transfer Deadline grant'),
      ],
    });
    expect(ledger.opening).toBe(222 - 39 + 43);
    expect(ledger.entries.map((e) => e.id)).toEqual(['1', '2', '5', '3']);
    expect(ledger.entries.map((e) => e.balanceAfter)).toEqual([186, 183, 213, 222]);
    expect(ledger.entries[3].detail).toBe('GW1–4 · 3W 0D 1L');
    expect(ledger.created).toBe(39);
    expect(ledger.totalIn).toBe(39);
    expect(ledger.totalOut).toBe(43);
  });

  it('reads trade cash from both sides of the deal', () => {
    const trades = [{ id: 't', team_a_id: 'a', team_b_id: 'b', offered_faab: 60, requested_faab: 0, updated_at: '2026-09-10T00:00:00Z' }];
    const a = buildLedger({ teamId: 'a', currentBalance: 190, clubName, trades, transactions: [] });
    const b = buildLedger({ teamId: 'b', currentBalance: 310, clubName, trades, transactions: [] });
    expect(a.entries[0]).toMatchObject({ direction: 'out', amount: 60, detail: 'With Club B' });
    expect(b.entries[0]).toMatchObject({ direction: 'in', amount: 60, detail: 'With Club A' });
    expect(a.opening).toBe(250);
    expect(b.opening).toBe(250);
  });

  it('names a signing from a listing as a transfer, not an auction win', () => {
    const ledger = buildLedger({
      teamId: 'a', currentBalance: 0, clubName, trades: [],
      transactions: [tx('1', 'waiver_claim', '2026-09-01T00:00:00Z', 21, '0', 'Signed X from Club B for €21m')],
    });
    expect(ledger.entries[0].label).toBe('Transfer In');
  });
});

describe('matchRevenueOutlook', () => {
  const m = (gameweek: number, a: string, b: string, winner: string | null, status = 'completed') => ({
    gameweek, team_a_id: a, team_b_id: b, winner_team_id: winner, status,
  });

  it('accrues the first unpaid period and counts the upside of matches still to play', () => {
    const out = matchRevenueOutlook({
      teamId: 'a',
      paidPeriods: new Set([1, 2]),
      rates: DEFAULT_MERIT_RATES,
      matchups: [m(9, 'a', 'b', 'a'), m(10, 'a', 'c', null), m(11, 'a', 'b', null, 'scheduled')],
    })!;
    expect(out.periodIndex).toBe(3);
    expect(out.pips.map((p) => p.result)).toEqual(['W', 'D', null, null]);
    expect(out.earned).toBe(4);
    expect(out.upside).toBe(5);
    expect(out.payAfterGw).toBe(12);
  });

  it('credits a bye when everyone else played', () => {
    const out = matchRevenueOutlook({ teamId: 'z', paidPeriods: new Set(), rates: DEFAULT_MERIT_RATES, matchups: [m(1, 'a', 'b', 'a')] })!;
    expect(out.pips[0].result).toBe('B');
  });

  it('is null once every period has paid, or when the league pays nothing', () => {
    expect(matchRevenueOutlook({ teamId: 'a', paidPeriods: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), rates: DEFAULT_MERIT_RATES, matchups: [] })).toBeNull();
    expect(matchRevenueOutlook({ teamId: 'a', paidPeriods: new Set(), rates: { win: 0, draw: 0, loss: 0, bye: 0 }, matchups: [] })).toBeNull();
  });
});

describe('live bids', () => {
  it('commits only the lots the club is winning', () => {
    const bids = liveBidsFor('a', [
      { player_id: 'p1', kind: 'free_agent', seller_team_id: null, highest_bid: 14, highest_bidder_team_id: 'a', bid_count: 2, bids: [{ team_id: 'b', amount: 12 }, { team_id: 'a', amount: 14 }], expires_at: '2026-10-28T10:00:00Z' },
      { player_id: 'p2', kind: 'free_agent', seller_team_id: null, highest_bid: 20, highest_bidder_team_id: 'b', bid_count: 2, bids: [{ team_id: 'a', amount: 18 }, { team_id: 'b', amount: 20 }], expires_at: '2026-10-27T10:00:00Z' },
      { player_id: 'p3', kind: 'free_agent', seller_team_id: null, highest_bid: 5, highest_bidder_team_id: 'b', bid_count: 1, bids: [{ team_id: 'b', amount: 5 }], expires_at: null },
    ]);
    expect(bids.map((b) => b.playerId)).toEqual(['p2', 'p1']);
    expect(bids[0]).toMatchObject({ myBid: 18, topBid: 20, winning: false });
    expect(committedTo(bids)).toBe(14);
  });
});
