/**
 * Which scoring engine a gameweek is scored with.
 *
 * Published scores never change, so V3 starts at a gameweek that hasn't been
 * played yet and everything before it stays V2. The engine reads the version
 * from each row's stats (`engine_version`), so a V2 row keeps scoring as V2
 * wherever it is re-scored later.
 *
 * V3_START is null until a start gameweek is chosen: with it null, nothing
 * anywhere scores as V3.
 */
export const V3_START: { season: string; gameweek: number } | null = null;

export type EngineVersion = 'v2' | 'v3';

/** Seasons are "YYYY-YY", which sort correctly as strings. */
export function engineVersionFor(
    season: string,
    gameweek: number,
    start: { season: string; gameweek: number } | null = V3_START,
): EngineVersion {
    if (!start) return 'v2';
    if (season > start.season) return 'v3';
    if (season === start.season && gameweek >= start.gameweek) return 'v3';
    return 'v2';
}
