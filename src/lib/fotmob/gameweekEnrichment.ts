/**
 * FotMob fields for a gameweek's appearances, keyed by FPL fixture id and the
 * player's FPL code (which equals FotMob's optaId).
 *
 * The V3 engine reads four fields FPL doesn't provide: penalty goals (for the
 * goal BPS strip), line-breaking passes, and aerial duels won and lost. A
 * FotMob match maps to an FPL fixture by its two clubs, and a player maps by
 * Opta id, so no names are compared.
 */
import { resolveClub } from '@/lib/clubs/registry';
import type { RawStats } from '@/types';
import { fetchFotmobFixtures, fetchFotmobMatch, type FotmobFixture, type FotmobMatch } from './matchDetails';

export interface FotmobAppearanceFields {
    penalty_goals: number;
    line_breaking_passes: number;
    aerials_won: number;
    aerials_lost: number;
}

export interface FplFixtureClubs {
    fplFixtureId: number;
    homeSlug: string;
    awaySlug: string;
}

export interface GameweekEnrichment {
    /** Key: `${fplFixtureId}:${fplCode}`. */
    byAppearance: Map<string, FotmobAppearanceFields>;
    /** One entry per FPL fixture asked for; `ok` false means its FotMob match couldn't be loaded. */
    fixtures: { fplFixtureId: number; fotmobMatchId: number | null; ok: boolean; error?: string }[];
}

export const appearanceKey = (fplFixtureId: number, fplCode: number) => `${fplFixtureId}:${fplCode}`;

/** Pairs each FPL fixture with its FotMob match by home and away club. */
export function matchFixtures(fpl: FplFixtureClubs[], fotmob: FotmobFixture[]): Map<number, number | null> {
    const byClubs = new Map<string, number>();
    for (const f of fotmob) {
        const home = resolveClub(f.home.name)?.slug, away = resolveClub(f.away.name)?.slug;
        if (home && away) byClubs.set(`${home}|${away}`, f.matchId);
    }
    return new Map(fpl.map((f) => [f.fplFixtureId, byClubs.get(`${f.homeSlug}|${f.awaySlug}`) ?? null]));
}

/** The four V3 fields for every player in a FotMob match who played. */
export function fieldsFromMatch(match: FotmobMatch): Map<number, FotmobAppearanceFields> {
    const out = new Map<number, FotmobAppearanceFields>();
    for (const p of match.players) {
        if (p.optaId == null || (p.stats['Minutes played']?.value ?? 0) <= 0) continue;
        const aerial = p.stats['Aerial duels won'];
        const won = aerial?.value ?? 0;
        out.set(p.optaId, {
            penalty_goals: p.penaltyGoals,
            line_breaking_passes: p.stats['Line breaking passes']?.value ?? 0,
            aerials_won: won,
            aerials_lost: Math.max(0, (aerial?.total ?? won) - won),
        });
    }
    return out;
}

export async function fetchGameweekEnrichment(
    season: string,
    fixtures: FplFixtureClubs[],
    options: { concurrency?: number } = {},
): Promise<GameweekEnrichment> {
    const byAppearance = new Map<string, FotmobAppearanceFields>();
    let fotmobFixtures: FotmobFixture[];
    try {
        fotmobFixtures = await fetchFotmobFixtures(season);
    } catch (e) {
        const error = `fixture list: ${(e as Error).message}`;
        return { byAppearance, fixtures: fixtures.map((f) => ({ fplFixtureId: f.fplFixtureId, fotmobMatchId: null, ok: false, error })) };
    }
    const paired = matchFixtures(fixtures, fotmobFixtures);
    const results: GameweekEnrichment['fixtures'] = [];
    const concurrency = options.concurrency ?? 4;
    for (let i = 0; i < fixtures.length; i += concurrency) {
        await Promise.all(fixtures.slice(i, i + concurrency).map(async (f) => {
            const fotmobMatchId = paired.get(f.fplFixtureId) ?? null;
            if (fotmobMatchId == null) {
                results.push({ fplFixtureId: f.fplFixtureId, fotmobMatchId, ok: false, error: 'no FotMob match for these clubs' });
                return;
            }
            try {
                const match = await fetchFotmobMatch(fotmobMatchId);
                for (const [code, fields] of fieldsFromMatch(match)) byAppearance.set(appearanceKey(f.fplFixtureId, code), fields);
                results.push({ fplFixtureId: f.fplFixtureId, fotmobMatchId, ok: true });
            } catch (e) {
                results.push({ fplFixtureId: f.fplFixtureId, fotmobMatchId, ok: false, error: (e as Error).message });
            }
        }));
    }
    return { byAppearance, fixtures: results };
}

/**
 * A V3 row: the engine marker, the player's FPL element type, and the FotMob
 * fields. An appearance FotMob doesn't list is marked fotmob_missing so it can
 * be found later; the engine reads its FotMob fields as zero.
 */
export function withV3Fields(
    rawStats: RawStats,
    elementType: 1 | 2 | 3 | 4 | undefined,
    fotmob: FotmobAppearanceFields | undefined,
): RawStats {
    return {
        ...rawStats,
        engine_version: 'v3',
        ...(elementType ? { fpl_element_type: elementType } : {}),
        ...(fotmob ?? {}),
        ...(!fotmob && rawStats.minutes_played > 0 ? { fotmob_missing: true } : {}),
    };
}
