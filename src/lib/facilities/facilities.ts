/**
 * src/lib/facilities/facilities.ts
 *
 * Club Facilities: permanent, one-time upgrades that raise one club's Academy,
 * Injured Reserve and Loans Out capacity above the league default.
 *
 * The price ladders are duplicated in `purchase_facility_upgrade_rpc`
 * (migration 166), which is what actually charges the club. Keep the two in
 * step. `docs/USER_GUIDE.md` states the same prices.
 */

export type FacilityKey = 'academy' | 'ir' | 'loans_out';

export const FACILITY_KEYS: readonly FacilityKey[] = ['academy', 'ir', 'loans_out'];

/** Slot count reached -> price in €m to buy it. */
export const FACILITY_LADDERS: Record<FacilityKey, Record<number, number>> = {
  academy: { 4: 60, 5: 90 },
  ir: { 3: 60 },
  loans_out: { 2: 30 },
};

export const FACILITY_NAMES: Record<FacilityKey, string> = {
  academy: 'Academy',
  ir: 'Injured Reserve',
  loans_out: 'Loans Out',
};

export interface TeamSlotOverrides {
  academy_slots?: number | null;
  ir_slots?: number | null;
  loan_out_slots?: number | null;
}

export interface LeagueSlotDefaults {
  taxi_size?: number | null;
  ir_size?: number | null;
  max_loan_outs?: number | null;
}

/** Mirrors `team_academy_slots` / `team_ir_slots` / `team_loan_out_slots` in SQL. */
export function effectiveSlots(team: TeamSlotOverrides | null | undefined, league: LeagueSlotDefaults | null | undefined) {
  return {
    academy: team?.academy_slots ?? league?.taxi_size ?? 3,
    ir: team?.ir_slots ?? league?.ir_size ?? 2,
    loansOut: team?.loan_out_slots ?? league?.max_loan_outs ?? 1,
  };
}

export interface FacilityStep {
  /** Slot count after buying this step. */
  slots: number;
  price: number;
}

/** Every step above the current count, cheapest-first. The first is buyable now. */
export function remainingSteps(key: FacilityKey, current: number): FacilityStep[] {
  return Object.entries(FACILITY_LADDERS[key])
    .map(([slots, price]) => ({ slots: Number(slots), price }))
    .filter((s) => s.slots > current)
    .sort((a, b) => a.slots - b.slots);
}

/** The upgrade a club can buy next, or null when the facility is fully built. */
export function nextStep(key: FacilityKey, current: number): FacilityStep | null {
  const next = remainingSteps(key, current)[0];
  return next && next.slots === current + 1 ? next : null;
}

/** The highest slot count the ladder reaches. */
export function maxSlots(key: FacilityKey, current: number): number {
  const steps = remainingSteps(key, current);
  return steps.length ? steps[steps.length - 1].slots : current;
}

/** One facility as a surface renders it. */
export interface FacilityView {
  key: FacilityKey;
  name: string;
  /** Slots owned now. */
  slots: number;
  /** Slots in use now. */
  used: number;
  next: FacilityStep | null;
  /** Steps after `next`, shown as later tiers. */
  later: FacilityStep[];
}

export function buildFacilityViews(
  slots: ReturnType<typeof effectiveSlots>,
  used: { academy: number; ir: number; loansOut: number },
): FacilityView[] {
  const current: Record<FacilityKey, number> = { academy: slots.academy, ir: slots.ir, loans_out: slots.loansOut };
  const inUse: Record<FacilityKey, number> = { academy: used.academy, ir: used.ir, loans_out: used.loansOut };
  return FACILITY_KEYS.map((key) => {
    const steps = remainingSteps(key, current[key]);
    const next = nextStep(key, current[key]);
    return {
      key,
      name: FACILITY_NAMES[key],
      slots: current[key],
      used: inUse[key],
      next,
      later: next ? steps.slice(1) : [],
    };
  });
}
