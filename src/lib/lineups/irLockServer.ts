import type { SupabaseClient } from '@supabase/supabase-js';
import { getLockedPlTeamIds } from '@/lib/fixtures/lockout';
import { resolveLineupEditMatchup } from '@/lib/lineups/editTarget';
import { resolveCurrentGw } from '@/lib/season/currentGameweek';
import type { MatchupLineup } from '@/types';
import { isIrChangeLocked, lineupPlayerIds } from './irLock';

/** Loads the scoring and squad-editor weeks once, then answers per player. */
export async function loadIrLockChecker(
    admin: SupabaseClient,
    teamId: string,
): Promise<(player: { id: string; pl_team_id: number | null }) => boolean> {
    const { data: scoring } = await admin
        .from('matchups')
        .select('gameweek, team_a_id, lineup_a, lineup_b')
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .in('status', ['scheduled', 'live'])
        .order('gameweek', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (!scoring) return () => false;

    const scoringLockedTeamIds = await getLockedPlTeamIds(admin, scoring.gameweek);
    const lineup = (scoring.team_a_id === teamId ? scoring.lineup_a : scoring.lineup_b) as MatchupLineup | null;
    const scoringLineupPlayerIds = new Set(lineupPlayerIds(lineup));

    const edit = await resolveLineupEditMatchup(admin, teamId, await resolveCurrentGw());
    const editingAhead = !!edit && edit.gameweek !== scoring.gameweek;
    const editLockedTeamIds = editingAhead && edit
        ? await getLockedPlTeamIds(admin, edit.gameweek)
        : new Set<number>();

    return (player) => isIrChangeLocked({
        playerId: player.id,
        plTeamId: player.pl_team_id,
        scoringLockedTeamIds,
        scoringLineupPlayerIds,
        editingAhead,
        editLockedTeamIds,
    });
}
