import { describe, it, expect } from 'vitest';
import { BENCH_FLEX_MAP, POSITION_FLEX_MAP, type BenchSlot, type GranularPosition, type Player } from '@/types';
import { calculateAgeInYears, getSeasonReferenceDate } from '@/lib/transfers/academyEligibility';

function isU21Eligible(player: Player, academyAgeLimit: number, seasonOrDate?: string | Date): boolean {
    if (!player.date_of_birth) return false;
    const refDate = seasonOrDate instanceof Date ? seasonOrDate : getSeasonReferenceDate(seasonOrDate);
    return calculateAgeInYears(player.date_of_birth, refDate) <= academyAgeLimit;
}

function isIrEligible(player: Player): boolean {
    return player.fpl_status === 'i' || player.fpl_status === 'u' || player.fpl_status === 'd';
}

function getPlayerPositions(player: Player): GranularPosition[] {
    return (player.primary_position ? [player.primary_position] : []).concat(player.secondary_positions ?? []);
}

function canPlaySlot(player: Player, slotPos: GranularPosition): boolean {
    return getPlayerPositions(player).some((p) => POSITION_FLEX_MAP[slotPos].includes(p));
}

function canPlayBenchSlot(player: Player, slot: BenchSlot): boolean {
    return getPlayerPositions(player).some((p) => BENCH_FLEX_MAP[slot].includes(p));
}

describe('Lineup Selection Eligibility', () => {
    const mockDefender: Player = {
        id: 'p-def',
        name: 'William Saliba',
        web_name: 'Saliba',
        primary_position: 'CB',
        secondary_positions: [],
        fpl_status: 'a',
        date_of_birth: '2001-03-24',
        pl_team: 'Arsenal',
        pl_team_id: 1,
    } as unknown as Player;

    const mockYoungMid: Player = {
        id: 'p-young-mid',
        name: 'Ethan Nwaneri',
        web_name: 'Nwaneri',
        primary_position: 'AM',
        secondary_positions: ['CM'],
        fpl_status: 'a',
        date_of_birth: '2007-03-21',
        pl_team: 'Arsenal',
        pl_team_id: 1,
    } as unknown as Player;

    const mockInjuredStriker: Player = {
        id: 'p-inj-striker',
        name: 'Alexander Isak',
        web_name: 'Isak',
        primary_position: 'ST',
        secondary_positions: ['LW'],
        fpl_status: 'i',
        date_of_birth: '1999-09-21',
        pl_team: 'Newcastle',
        pl_team_id: 4,
    } as unknown as Player;

    describe('Bench Slot Eligibility', () => {
        it('allows any outfield player in FLEX bench slot', () => {
            expect(canPlayBenchSlot(mockDefender, 'FLEX')).toBe(true);
            expect(canPlayBenchSlot(mockYoungMid, 'FLEX')).toBe(true);
            expect(canPlayBenchSlot(mockInjuredStriker, 'FLEX')).toBe(true);
        });

        it('restricts DEF bench slot to defenders only', () => {
            expect(canPlayBenchSlot(mockDefender, 'DEF')).toBe(true);
            expect(canPlayBenchSlot(mockYoungMid, 'DEF')).toBe(false);
            expect(canPlayBenchSlot(mockInjuredStriker, 'DEF')).toBe(false);
        });

        it('restricts MID bench slot to midfielders only', () => {
            expect(canPlayBenchSlot(mockDefender, 'MID')).toBe(false);
            expect(canPlayBenchSlot(mockYoungMid, 'MID')).toBe(true);
            expect(canPlayBenchSlot(mockInjuredStriker, 'MID')).toBe(false);
        });

        it('restricts ATT bench slot to attackers only', () => {
            expect(canPlayBenchSlot(mockDefender, 'ATT')).toBe(false);
            expect(canPlayBenchSlot(mockYoungMid, 'ATT')).toBe(false);
            expect(canPlayBenchSlot(mockInjuredStriker, 'ATT')).toBe(true);
        });
    });

    describe('Pitch Position Slot Eligibility', () => {
        it('matches primary and secondary positions strictly', () => {
            expect(canPlaySlot(mockDefender, 'CB')).toBe(true);
            expect(canPlaySlot(mockDefender, 'LB')).toBe(false);

            expect(canPlaySlot(mockYoungMid, 'AM')).toBe(true);
            expect(canPlaySlot(mockYoungMid, 'CM')).toBe(true);
            expect(canPlaySlot(mockYoungMid, 'DM')).toBe(false);

            expect(canPlaySlot(mockInjuredStriker, 'ST')).toBe(true);
            expect(canPlaySlot(mockInjuredStriker, 'LW')).toBe(true);
            expect(canPlaySlot(mockInjuredStriker, 'RW')).toBe(false);
        });
    });

    describe('Academy and IR Eligibility', () => {
        it('identifies U21 eligible players correctly', () => {
            const refDate = new Date('2026-09-01');
            expect(isU21Eligible(mockYoungMid, 21, refDate)).toBe(true);
            expect(isU21Eligible(mockDefender, 21, refDate)).toBe(false);
        });

        it('keeps player eligible for the rest of the season when turning 21 or 22 mid-season', () => {
            const mockMidseasonGraduate: Player = {
                id: 'player-graduate',
                name: 'Kobbie Mainoo',
                primary_position: 'DM',
                date_of_birth: '2005-04-19',
            };
            // 2025-26 season: turns 21 in April 2026, but season age is 20 -> eligible
            expect(isU21Eligible(mockMidseasonGraduate, 21, '2025-26')).toBe(true);
            // 2026-27 season: turns 22 in April 2027, but season age is 21 -> still eligible for rest of season!
            expect(isU21Eligible(mockMidseasonGraduate, 21, '2026-27')).toBe(true);
            // 2027-28 season: season age is 22 -> aged out at reset
            expect(isU21Eligible(mockMidseasonGraduate, 21, '2027-28')).toBe(false);
        });

        it('identifies IR eligible players by FPL injury status', () => {
            expect(isIrEligible(mockInjuredStriker)).toBe(true);
            expect(isIrEligible(mockDefender)).toBe(false);
            expect(isIrEligible(mockYoungMid)).toBe(false);
        });
    });

    describe('Direct-to-Pitch Activation and Grandfather Rules', () => {
        interface LineupTargetContext {
            selection: { type: 'taxi' | 'ir' | 'starter' | 'bench-slot' | 'pool'; playerId?: string; slotIndex?: number; slot?: BenchSlot };
            slots: GranularPosition[];
            assignments: Record<number, string | null>;
            benchAssignments: Record<BenchSlot, string | null>;
            playerMap: Map<string, { player: Player; status: string }>;
            taxiEntries: { player: Player; status: string }[];
            irEntries: { player: Player; status: string }[];
            capacity: { open: number; academy: number; academyLimit: number; ir: number; irLimit: number };
            holding: boolean;
            academyAgeLimit: number;
        }

        function getValidTargets(ctx: LineupTargetContext): Set<string> {
            const targets = new Set<string>();
            const { selection, slots, assignments, benchAssignments, playerMap, taxiEntries, irEntries, capacity, holding, academyAgeLimit } = ctx;

            if (selection.type === 'taxi') {
                const taxiPlayer = taxiEntries.find((t) => t.player.id === selection.playerId);
                if (taxiPlayer) {
                    for (let i = 0; i < slots.length; i++) {
                        const pid = assignments[i];
                        const e = pid ? playerMap.get(pid) : null;
                        if (e && e.status !== 'loan_in' && e.status !== 'loan_out' && e.status !== 'held' && isU21Eligible(e.player, academyAgeLimit)) {
                            targets.add(`starter-${i}`);
                        }
                        if (!e && capacity.open > 0 && !holding && canPlaySlot(taxiPlayer.player, slots[i])) {
                            targets.add(`starter-${i}`);
                        }
                    }
                    const benchSlots: BenchSlot[] = ['DEF', 'MID', 'ATT', 'FLEX'];
                    for (const slot of benchSlots) {
                        const pid = benchAssignments[slot];
                        const e = pid ? playerMap.get(pid) : null;
                        if (e && e.status !== 'loan_in' && e.status !== 'loan_out' && e.status !== 'held' && isU21Eligible(e.player, academyAgeLimit)) {
                            targets.add(`bench-${slot}`);
                        }
                        if (!e && capacity.open > 0 && !holding && canPlayBenchSlot(taxiPlayer.player, slot)) {
                            targets.add(`bench-${slot}`);
                        }
                    }
                    if (capacity.open > 0 && !holding) targets.add('tier-pool');
                }
            }

            if (selection.type === 'starter') {
                const currentPid = assignments[selection.slotIndex!];
                const currentEntry = currentPid ? playerMap.get(currentPid) : null;
                if (currentEntry && currentEntry.status !== 'loan_in' && currentEntry.status !== 'loan_out' && currentEntry.status !== 'held' && isU21Eligible(currentEntry.player, academyAgeLimit)) {
                    const agedOutEntries = taxiEntries.filter((t) => !isU21Eligible(t.player, academyAgeLimit));
                    if (agedOutEntries.length === 1) {
                        targets.add(`taxi-${agedOutEntries[0].player.id}`);
                    } else if (agedOutEntries.length === 0) {
                        for (const t of taxiEntries) targets.add(`taxi-${t.player.id}`);
                        if (capacity.academy < capacity.academyLimit) targets.add('tier-taxi');
                    }
                }
            }

            return targets;
        }

        it('targets empty starter and bench slots when activating with open roster space', () => {
            const ctx: LineupTargetContext = {
                selection: { type: 'taxi', playerId: 'p-young-mid' },
                slots: ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'AM', 'CM', 'LW', 'ST', 'RW'],
                assignments: { 6: null }, // Slot 6 (AM) is empty!
                benchAssignments: { DEF: null, MID: null, ATT: null, FLEX: null }, // Bench MID & FLEX empty
                playerMap: new Map(),
                taxiEntries: [{ player: mockYoungMid, status: 'taxi' }],
                irEntries: [],
                capacity: { open: 1, academy: 1, academyLimit: 3, ir: 0, irLimit: 2 },
                holding: false,
                academyAgeLimit: 21,
            };

            const targets = getValidTargets(ctx);
            expect(targets.has('starter-6')).toBe(true); // Empty AM slot
            expect(targets.has('bench-MID')).toBe(true); // Empty MID bench slot
            expect(targets.has('bench-FLEX')).toBe(true); // Empty FLEX bench slot
            expect(targets.has('bench-DEF')).toBe(false); // Young mid cannot play DEF
            expect(targets.has('tier-pool')).toBe(true); // Activate to reserves
        });

        it('does not target empty slots if active roster is full or holding', () => {
            const ctxFull: LineupTargetContext = {
                selection: { type: 'taxi', playerId: 'p-young-mid' },
                slots: ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'AM', 'CM', 'LW', 'ST', 'RW'],
                assignments: { 6: null },
                benchAssignments: { DEF: null, MID: null, ATT: null, FLEX: null },
                playerMap: new Map(),
                taxiEntries: [{ player: mockYoungMid, status: 'taxi' }],
                irEntries: [],
                capacity: { open: 0, academy: 1, academyLimit: 3, ir: 0, irLimit: 2 },
                holding: false,
                academyAgeLimit: 21,
            };
            const targetsFull = getValidTargets(ctxFull);
            expect(targetsFull.has('starter-6')).toBe(false);
            expect(targetsFull.has('tier-pool')).toBe(false);

            const ctxHolding: LineupTargetContext = {
                ...ctxFull,
                capacity: { ...ctxFull.capacity, open: 1 },
                holding: true,
            };
            const targetsHolding = getValidTargets(ctxHolding);
            expect(targetsHolding.has('starter-6')).toBe(false);
            expect(targetsHolding.has('tier-pool')).toBe(false);
        });

        it('enforces grandfather rule: freezes tier-taxi additions and restricts swaps to the aged-out player', () => {
            const agedOutTaxiPlayer: Player = {
                id: 'p-aged-out',
                name: 'Aged Out Mid',
                date_of_birth: '2000-01-01',
            } as unknown as Player;

            const youngTaxiPlayer: Player = {
                id: 'p-young-taxi',
                name: 'Young Taxi',
                date_of_birth: '2006-01-01',
            } as unknown as Player;

            const starterU21: Player = {
                id: 'p-starter-u21',
                name: 'Active U21',
                date_of_birth: '2005-01-01',
            } as unknown as Player;

            const playerMap = new Map();
            playerMap.set(starterU21.id, { player: starterU21, status: 'active' });

            const ctxWithAgedOut: LineupTargetContext = {
                selection: { type: 'starter', slotIndex: 1 },
                slots: ['GK', 'CB'],
                assignments: { 1: starterU21.id },
                benchAssignments: { DEF: null, MID: null, ATT: null, FLEX: null },
                playerMap,
                taxiEntries: [
                    { player: agedOutTaxiPlayer, status: 'taxi' },
                    { player: youngTaxiPlayer, status: 'taxi' },
                ],
                irEntries: [],
                capacity: { open: 0, academy: 2, academyLimit: 3, ir: 0, irLimit: 2 },
                holding: false,
                academyAgeLimit: 21,
            };

            const targets = getValidTargets(ctxWithAgedOut);
            // tier-taxi drop target must NOT be available because an aged out player is present
            expect(targets.has('tier-taxi')).toBe(false);
            // Swapping is only permitted with the aged-out player to resolve the grandfather state
            expect(targets.has(`taxi-${agedOutTaxiPlayer.id}`)).toBe(true);
            expect(targets.has(`taxi-${youngTaxiPlayer.id}`)).toBe(false);
        });

        it('excludes held players and loaned players from taxi swaps', () => {
            const heldU21: Player = {
                id: 'p-held',
                name: 'Held U21',
                date_of_birth: '2006-01-01',
            } as unknown as Player;

            const loanU21: Player = {
                id: 'p-loan',
                name: 'Loan U21',
                date_of_birth: '2006-01-01',
            } as unknown as Player;

            const playerMap = new Map();
            playerMap.set(heldU21.id, { player: heldU21, status: 'held' });
            playerMap.set(loanU21.id, { player: loanU21, status: 'loan_in' });

            const ctxHeld: LineupTargetContext = {
                selection: { type: 'starter', slotIndex: 1 },
                slots: ['GK', 'CB'],
                assignments: { 1: heldU21.id },
                benchAssignments: { DEF: null, MID: null, ATT: null, FLEX: null },
                playerMap,
                taxiEntries: [{ player: mockYoungMid, status: 'taxi' }],
                irEntries: [],
                capacity: { open: 0, academy: 1, academyLimit: 3, ir: 0, irLimit: 2 },
                holding: false,
                academyAgeLimit: 21,
            };
            expect(getValidTargets(ctxHeld).has(`taxi-${mockYoungMid.id}`)).toBe(false);

            const ctxLoan: LineupTargetContext = {
                ...ctxHeld,
                assignments: { 1: loanU21.id },
            };
            expect(getValidTargets(ctxLoan).has(`taxi-${mockYoungMid.id}`)).toBe(false);
        });
    });
});
