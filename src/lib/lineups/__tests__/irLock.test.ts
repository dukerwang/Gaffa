import { describe, expect, it } from 'vitest';
import { isIrChangeLocked, lineupPlayerIds } from '../irLock';

const base = {
    playerId: 'p1',
    plTeamId: 1,
    scoringLockedTeamIds: new Set([1]),
    scoringLineupPlayerIds: new Set<string>(),
    editingAhead: false,
    editLockedTeamIds: new Set<number>(),
};

describe('isIrChangeLocked', () => {
    it('locks any player whose club has kicked off before the handoff', () => {
        expect(isIrChangeLocked(base)).toBe(true);
    });

    it('unlocks a player outside the scoring lineup once the editor is on next week', () => {
        expect(isIrChangeLocked({ ...base, editingAhead: true })).toBe(false);
    });

    it('keeps a scoring-lineup player locked after the handoff', () => {
        expect(isIrChangeLocked({ ...base, editingAhead: true, scoringLineupPlayerIds: new Set(['p1']) })).toBe(true);
    });

    it("follows next week's kickoffs after the handoff", () => {
        expect(isIrChangeLocked({
            ...base,
            scoringLockedTeamIds: new Set(),
            editingAhead: true,
            editLockedTeamIds: new Set([1]),
        })).toBe(true);
    });

    it('never locks a player without a club', () => {
        expect(isIrChangeLocked({ ...base, plTeamId: null })).toBe(false);
    });
});

describe('lineupPlayerIds', () => {
    it('lists starters and bench', () => {
        expect(lineupPlayerIds({
            formation: '4-3-3',
            starters: [{ player_id: 'a', slot: 'CB' }],
            bench: [{ player_id: 'b', slot: 'DEF' }],
        })).toEqual(['a', 'b']);
        expect(lineupPlayerIds(null)).toEqual([]);
    });
});
