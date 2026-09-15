import { describe, it, expect } from 'vitest';
import { buildFacilityViews, effectiveSlots, maxSlots, nextStep, remainingSteps } from '../facilities';

describe('effectiveSlots', () => {
  it('falls back to the league setting, then the standard size', () => {
    expect(effectiveSlots(null, null)).toEqual({ academy: 3, ir: 2, loansOut: 1 });
    expect(effectiveSlots({}, { taxi_size: 4, ir_size: 1, max_loan_outs: 2 })).toEqual({ academy: 4, ir: 1, loansOut: 2 });
  });

  it('prefers the club’s purchased slots over the league setting', () => {
    expect(
      effectiveSlots({ academy_slots: 5, ir_slots: 3, loan_out_slots: 2 }, { taxi_size: 3, ir_size: 2, max_loan_outs: 1 }),
    ).toEqual({ academy: 5, ir: 3, loansOut: 2 });
  });
});

describe('ladders', () => {
  it('prices each step, cheapest first', () => {
    expect(nextStep('academy', 3)).toEqual({ slots: 4, price: 60 });
    expect(nextStep('academy', 4)).toEqual({ slots: 5, price: 90 });
    expect(nextStep('ir', 2)).toEqual({ slots: 3, price: 60 });
    expect(nextStep('loans_out', 1)).toEqual({ slots: 2, price: 30 });
  });

  it('is fully built at the top of the ladder', () => {
    expect(nextStep('academy', 5)).toBeNull();
    expect(nextStep('ir', 3)).toBeNull();
    expect(nextStep('loans_out', 2)).toBeNull();
    expect(maxSlots('academy', 3)).toBe(5);
  });

  it('never offers a step that skips a slot', () => {
    // A league configured below the ladder's start has nothing to buy yet.
    expect(nextStep('academy', 2)).toBeNull();
    expect(remainingSteps('academy', 2).map((s) => s.slots)).toEqual([4, 5]);
  });

  it('totals €240m for every upgrade', () => {
    const total = [...remainingSteps('academy', 3), ...remainingSteps('ir', 2), ...remainingSteps('loans_out', 1)]
      .reduce((n, s) => n + s.price, 0);
    expect(total).toBe(240);
  });
});

describe('buildFacilityViews', () => {
  it('shows the next step and the later tiers separately', () => {
    const [academy, ir, loans] = buildFacilityViews(
      { academy: 3, ir: 3, loansOut: 1 },
      { academy: 3, ir: 1, loansOut: 0 },
    );
    expect(academy).toMatchObject({ name: 'Academy', slots: 3, used: 3, next: { slots: 4, price: 60 }, later: [{ slots: 5, price: 90 }] });
    expect(ir).toMatchObject({ name: 'Injured Reserve', slots: 3, used: 1, next: null, later: [] });
    expect(loans).toMatchObject({ name: 'Loans Out', next: { slots: 2, price: 30 }, later: [] });
  });
});
