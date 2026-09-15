import type { MatchupLineup } from '@/types';

/** Every player the saved lineup names, starters and bench alike. */
export function lineupPlayerIds(lineup: MatchupLineup | null | undefined): string[] {
    if (!lineup) return [];
    return [
        ...(lineup.starters ?? []).map((s) => s.player_id),
        ...(lineup.bench ?? []).map((b) => b.player_id),
    ].filter((id): id is string => !!id);
}

/**
 * Whether a player's IR status is frozen right now. Client-safe, so the team
 * page and the IR route agree.
 *
 * The scoring-week lock exists because the final resolve strips IR players
 * from the saved lineup: moving a player who has played onto IR would zero his
 * points, and taking one off IR would restore points he was stripped of. Both
 * only matter for a player the scoring lineup names. So once the squad editor
 * has moved on to next week (the last kickoff has passed), a player outside
 * this week's lineup follows next week's kickoffs instead, like the rest of
 * the squad editor. Before that handoff, every player whose club has kicked
 * off stays locked, as before.
 */
export function isIrChangeLocked(args: {
    playerId: string;
    plTeamId: number | null | undefined;
    scoringLockedTeamIds: Set<number>;
    scoringLineupPlayerIds: ReadonlySet<string>;
    editingAhead: boolean;
    editLockedTeamIds: Set<number>;
}): boolean {
    const { playerId, plTeamId, scoringLockedTeamIds, scoringLineupPlayerIds, editingAhead, editLockedTeamIds } = args;
    if (plTeamId == null) return false;
    if (scoringLockedTeamIds.has(plTeamId)) {
        if (!editingAhead || scoringLineupPlayerIds.has(playerId)) return true;
    }
    return editingAhead && editLockedTeamIds.has(plTeamId);
}
