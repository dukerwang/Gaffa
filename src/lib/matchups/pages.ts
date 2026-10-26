import type { SupabaseClient } from '@supabase/supabase-js';
import type { Player } from '@/types';
import type { FplStatus } from '@/lib/fpl/api';
import { processMatchupsForGameweek } from '@/lib/scoring/matchupProcessor';
import { fetchAllPagesIn } from '@/lib/supabase/pagination';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { loadManagers, loadMatchupContext } from '@/lib/matchups/context';
import { clubColour, loadMatchupView, matchState, type MatchupRow, type MatchupView, type PitchPlayer } from '@/lib/matchups/matchupView';
import { formOf, metaFor, resultOf, ribbonFor, tableAfter, type MatchupRowLite } from '@/lib/matchups/roundView';
import { loadAllResults, type Result } from '@/lib/heritage/results';
import { headToHead } from '@/lib/heritage/headToHead';
import type { RoundProps, MatchProps } from '@/components/gameweeks/Views';
import type { TeamLite, TieLite } from '@/components/gameweeks/types';
import type { RecordsData, SeasonTopRow, SpreadPlayer } from '@/components/gameweeks/RoundSections';
import type { H2HData } from '@/components/gameweeks/TeamSheets';

/**
 * The Gameweeks and Matchup pages' data, assembled on the server. The route
 * files keep auth and redirects; everything they render comes from here.
 */

export const MATCHUP_SELECT = `
    *,
    team_a:teams!matchups_team_a_id_fkey(id, team_name, crest_config),
    team_b:teams!matchups_team_b_id_fkey(id, team_name, crest_config)
`;

const FPL_FALLBACK: FplStatus = { currentGw: 1, isFinished: false, isLive: false, nextGwIsClose: false, nextDeadline: null, nextGw: null, displayGw: 1 };

async function loadTeams(admin: SupabaseClient, leagueId: string) {
    const [managers, { data: teamRows }] = await Promise.all([
        loadManagers(admin, leagueId),
        admin.from('teams').select('id, team_name, crest_config').eq('league_id', leagueId),
    ]);
    const teams: Record<string, TeamLite> = {};
    for (const t of (teamRows ?? []) as { id: string; team_name: string; crest_config: TeamLite['crest'] }[]) {
        teams[t.id] = { id: t.id, name: t.team_name, crest: t.crest_config, manager: managers[t.id] ?? null, color: clubColour(t.crest_config) };
    }
    return { managers, teams };
}

export type RoundResult = { redirect: string } | { props: RoundProps };

export async function loadRoundPage(
    admin: SupabaseClient,
    opts: { leagueId: string; gwParam?: string; myTeamId?: string; leagueStatus?: string | null; leagueSeason?: string | null; fplStatus: FplStatus | null },
): Promise<RoundResult> {
    const { leagueId, gwParam: gw, myTeamId } = opts;
    const fplStatus = opts.fplStatus ?? FPL_FALLBACK;
    const [{ data: allMatchupsData }, { managers, teams }] = await Promise.all([
        admin.from('matchups').select(MATCHUP_SELECT).eq('league_id', leagueId).order('gameweek', { ascending: true }),
        loadTeams(admin, leagueId),
    ]);
    const currentFplGw = fplStatus.currentGw ?? 1;
    const isCurrentFplGwFinished = fplStatus.isFinished ?? false;

    let matchupsList = (allMatchupsData ?? []) as MatchupRow[];
    let gameweeks = Array.from(new Set(matchupsList.map((row) => row.gameweek))).sort((a, b) => a - b);

    // Self-healing safety net if schedule missing
    if (opts.leagueStatus === 'active' && gameweeks.length === 0) {
        const { ensureSeasonScaffold } = await import('@/lib/schedule/ensureSeasonScaffold');
        const scaffold = await ensureSeasonScaffold(admin, leagueId, opts.leagueSeason ?? null);
        if (scaffold.matchupsCreated) {
            const { data: refreshed } = await admin.from('matchups').select(MATCHUP_SELECT).eq('league_id', leagueId).order('gameweek', { ascending: true });
            matchupsList = (refreshed ?? []) as MatchupRow[];
            gameweeks = Array.from(new Set(matchupsList.map((row) => row.gameweek))).sort((a, b) => a - b);
        }
    }

    let targetGw = parseInt(gw ?? '0', 10);
    if (!targetGw) {
        if (currentFplGw > 1) targetGw = currentFplGw;
        else if (gameweeks.length > 0) {
            const active = matchupsList.find((m) => m.status === 'live' || m.status === 'scheduled');
            targetGw = active ? active.gameweek : gameweeks[gameweeks.length - 1];
        } else targetGw = 1;
    }
    if (gameweeks.length > 0 && !gameweeks.includes(targetGw)) {
        const snapped = gameweeks.find((g) => g >= targetGw) ?? gameweeks[gameweeks.length - 1]!;
        return { redirect: `/league/${leagueId}/matchups?gw=${snapped}` };
    }

    // If this is the current gameweek and every score still reads 0.00, score
    // it before rendering, so the page never flashes a round of zeroes.
    const needsSync = targetGw === currentFplGw && matchupsList.some((m) =>
        m.gameweek === targetGw && m.status !== 'completed' && Number(m.score_a) === 0 && Number(m.score_b) === 0);
    if (needsSync) {
        try {
            await processMatchupsForGameweek(targetGw, isCurrentFplGwFinished);
        } catch (err) {
            console.error('[matchups] Score sync failed; rendering stored scores:', err);
        }
        const { data: fresh } = await admin.from('matchups').select(MATCHUP_SELECT).eq('league_id', leagueId).order('gameweek', { ascending: true });
        if (fresh) matchupsList = fresh as MatchupRow[];
    }

    const names = Object.fromEntries(Object.values(teams).map((t) => [t.id, t.name]));
    const teamIds = Object.keys(teams);
    const rows = matchupsList as unknown as MatchupRowLite[];

    const ctx = await loadMatchupContext(admin, targetGw, { currentGw: currentFplGw, isFinished: isCurrentFplGwFinished }, managers);
    const gwRows = matchupsList.filter((m) => m.gameweek === targetGw);
    const stateOf = (m: MatchupRow) => matchState(m, ctx);
    const mineRow = gwRows.find((m) => m.team_a_id === myTeamId || m.team_b_id === myTeamId) ?? null;
    const state = mineRow ? stateOf(mineRow) : gwRows[0] ? stateOf(gwRows[0]) : 'upcoming';

    // Open every tie once the round has kicked off; before it, only yours
    // (nobody else's lineup is set until its kickoff).
    const views = await Promise.all(gwRows.map((m) => {
        if (!m.team_b_id) return Promise.resolve(null);
        if (state === 'upcoming' && m.id !== mineRow?.id) return Promise.resolve(null);
        return loadMatchupView(admin, m, ctx);
    }));
    const ties: TieLite[] = gwRows.map((m, i) => {
        const v = views[i];
        return {
            id: m.id,
            a: teams[m.team_a_id] ?? { id: m.team_a_id, name: m.team_a?.team_name ?? 'TBD', crest: m.team_a?.crest_config ?? null, manager: null, color: clubColour(m.team_a?.crest_config) },
            b: m.team_b_id ? (teams[m.team_b_id] ?? null) : null,
            scoreA: v ? v.a.score : Number(m.score_a),
            scoreB: v ? v.b.score : Number(m.score_b),
            state: stateOf(m),
            view: v,
        };
    });
    // Your fixture leads the list.
    ties.sort((x, y) => Number(y.id === mineRow?.id) - Number(x.id === mineRow?.id));

    // One weekend clock for every tie.
    const clock = [...new Set(views.flatMap((v) => v?.slots.map((x) => x.t) ?? []))].sort((a, b) => Date.parse(a) - Date.parse(b));
    const kicks = Object.values(ctx.fixtureMap).map((f) => f.kickoffTime).filter(Boolean).sort() as string[];
    const window = { first: kicks[0] ?? null, last: kicks[kicks.length - 1] ?? null };
    const deadline = state === 'upcoming' && fplStatus.nextGw === targetGw ? fplStatus.nextDeadline : null;

    // The table as this round left it, and how it moved.
    const table = tableAfter(rows, teamIds, names, targetGw);
    const before = tableAfter(rows, teamIds, names, targetGw - 1);
    const moves = Object.fromEntries(table.map((r) => [r.teamId, (before.find((b) => b.teamId === r.teamId)?.rank ?? r.rank) - r.rank]));
    const metas = metaFor(table, rows, targetGw);
    const gwRes: Record<string, { r: 'W' | 'D' | 'L'; my: number; opp: number }> = {};
    for (const id of teamIds) {
        const f = formOf(rows, id, targetGw).find((x) => x.gw === targetGw);
        if (f) gwRes[id] = { r: f.r, my: f.my, opp: f.opp };
    }
    const liveGw = state === 'live' ? targetGw : (currentFplGw && !isCurrentFplGwFinished && gameweeks.includes(currentFplGw) ? currentFplGw : null);
    const ribbon = ribbonFor(rows, myTeamId, gameweeks, liveGw);
    const record = myTeamId ? metas[myTeamId] ?? null : null;

    // Round records, once every tie has a result.
    let records: RecordsData | null = null;
    if (state === 'final' || state === 'provisional') {
        const scored = ties.filter((t) => t.b);
        const bars = scored.flatMap((t) => [{ teamId: t.a.id, v: t.scoreA }, { teamId: t.b!.id, v: t.scoreB }]).sort((x, y) => y.v - x.v);
        const close = scored.slice().sort((x, y) => Math.abs(x.scoreA - x.scoreB) - Math.abs(y.scoreA - y.scoreB))[0];
        if (bars.length && close) {
            const winner = close.scoreA >= close.scoreB;
            const seasonHigh = Math.max(bars[0].v, ...matchupsList.filter((m) => m.status === 'completed').flatMap((m) => [Number(m.score_a), Number(m.score_b)]));
            records = {
                top: bars[0],
                close: { a: winner ? close.a.id : close.b!.id, b: winner ? close.b!.id : close.a.id, margin: Math.abs(close.scoreA - close.scoreB) },
                seasonHigh,
                bars,
            };
        }
    }

    // Every starter's points this round, for the spread.
    let spread: SpreadPlayer[] | null = null;
    if (state !== 'upcoming') {
        spread = [];
        for (const t of ties) {
            if (!t.view || !t.b) continue;
            for (const [k, owner, opp] of [['a', t.a.id, t.b.id], ['b', t.b.id, t.a.id]] as const) {
                for (const p of t.view[k].starters as PitchPlayer[]) if (p.status === 'played') spread.push({ p, owner, opp });
            }
        }
    }

    // Before the round: the season's leaders among the league's players.
    let seasonTop: SeasonTopRow[] | null = null;
    const players: Record<string, Partial<Player>> = {};
    for (const v of views) if (v) Object.assign(players, v.players);
    if (state === 'upcoming' && teamIds.length) {
        seasonTop = await loadSeasonTop(admin, teamIds, ctx.currentSeason, players);
    }

    return {
        props: {
            leagueId,
            gw: targetGw,
            gameweeks,
            myTeamId,
            state,
            window,
            deadline,
            ribbon,
            record,
            ties,
            clock,
            metas,
            teams,
            table,
            moves,
            gwRes,
            records,
            spread,
            seasonTop,
            players,
        },
    };
}

/** The six league players with the most points this season, and who owns them. */
async function loadSeasonTop(
    admin: SupabaseClient,
    teamIds: string[],
    season: string,
    players: Record<string, Partial<Player>>,
): Promise<SeasonTopRow[]> {
    const { data: roster } = await admin.from('roster_entries').select('player_id, team_id').in('team_id', teamIds);
    const owner = new Map(((roster ?? []) as { player_id: string; team_id: string }[]).map((r) => [r.player_id, r.team_id]));
    const ids = [...owner.keys()];
    if (!ids.length) return [];
    const stats = await fetchAllPagesIn<{ id: string; player_id: string; fantasy_points: number; stats: { minutes_played?: number } | null }>(ids, (chunk, from, to) =>
        admin.from('player_stats').select('id, player_id, fantasy_points, stats').eq('season', season).in('player_id', chunk).order('id').range(from, to) as never,
    );
    const tot = new Map<string, { pts: number; apps: number }>();
    for (const r of stats) {
        const t = tot.get(r.player_id) ?? { pts: 0, apps: 0 };
        t.pts += Number(r.fantasy_points) || 0;
        if ((r.stats?.minutes_played ?? 0) > 0) t.apps += 1;
        tot.set(r.player_id, t);
    }
    const top = [...tot.entries()].sort((a, b) => b[1].pts - a[1].pts).slice(0, 6);
    if (!top.length) return [];
    const { data: rows } = await admin.from('players').select(FULL_PLAYER_SELECT).in('id', top.map(([id]) => id));
    const byId = new Map(((rows ?? []) as unknown as Partial<Player>[]).map((p) => [p.id as string, p]));
    return top.map(([id, t]) => {
        const p = byId.get(id) ?? {};
        players[id] = p;
        return {
            id,
            name: p.web_name ? getPlayerDisplayName(p) : '—',
            slot: (p.primary_position as string | undefined) ?? 'N/A',
            club: (p.pl_team as string | undefined) ?? null,
            photoUrl: (p.photo_url as string | undefined) ?? null,
            photoVersion: (p.photo_version as string | undefined) ?? null,
            headTopPct: (p.portrait_head_top_pct as number | undefined) ?? null,
            headWidthPct: (p.portrait_head_width_pct as number | undefined) ?? null,
            owner: owner.get(id)!,
            pts: t.pts,
            apps: t.apps,
        };
    });
}

export async function loadMatchPage(
    admin: SupabaseClient,
    opts: { leagueId: string; matchupId: string; myTeamId?: string; fplStatus: FplStatus | null },
): Promise<MatchProps | null> {
    const { leagueId, matchupId, myTeamId } = opts;
    const fplStatus = opts.fplStatus ?? FPL_FALLBACK;
    const [{ data: matchupData }, { data: allRows }, { managers, teams }] = await Promise.all([
        admin.from('matchups').select(MATCHUP_SELECT).eq('id', matchupId).eq('league_id', leagueId).maybeSingle(),
        admin.from('matchups').select(MATCHUP_SELECT).eq('league_id', leagueId).order('gameweek', { ascending: true }),
        loadTeams(admin, leagueId),
    ]);
    if (!matchupData) return null;
    const matchup = matchupData as MatchupRow;
    const gw = matchup.gameweek;
    const rowsAll = (allRows ?? []) as MatchupRow[];


    const ctx = await loadMatchupContext(admin, gw, { currentGw: fplStatus.currentGw ?? 1, isFinished: fplStatus.isFinished ?? false }, managers);
    const view = await loadMatchupView(admin, matchup, ctx);

    const A = teams[matchup.team_a_id];
    const B = matchup.team_b_id ? teams[matchup.team_b_id] : null;
    if (!A || !B) return null;

    const rows = rowsAll as unknown as MatchupRowLite[];
    const names = Object.fromEntries(Object.values(teams).map((t) => [t.id, t.name]));
    const table = tableAfter(rows, Object.keys(teams), names, gw);
    const metas = metaFor(table, rows, gw);

    // The round's other ties, for the switcher. Stored scores are the live
    // running scores during the gameweek (migration 103), so no rescoring here.
    const ties: TieLite[] = rowsAll.filter((m) => m.gameweek === gw && m.team_b_id).map((m) => ({
        id: m.id,
        a: teams[m.team_a_id],
        b: teams[m.team_b_id!] ?? null,
        scoreA: m.id === matchup.id ? view.a.score : Number(m.score_a),
        scoreB: m.id === matchup.id ? view.b.score : Number(m.score_b),
        state: m.id === matchup.id ? view.state : matchState(m, ctx),
        view: null,
    })).filter((t) => t.a);
    const current: TieLite = { id: matchup.id, a: A, b: B, scoreA: view.a.score, scoreB: view.b.score, state: view.state, view };

    const kicks = Object.values(ctx.fixtureMap).map((f) => f.kickoffTime).filter(Boolean).sort() as string[];
    const window = { first: kicks[0] ?? null, last: kicks[kicks.length - 1] ?? null };
    const deadline = view.state === 'upcoming' && fplStatus.nextGw === gw ? fplStatus.nextDeadline : null;

    // Head-to-head, all-time and across every competition, from your side.
    const h2h = view.state === 'live' ? null : await loadHeadToHead(admin, {
        leagueId, season: ctx.currentSeason, gw, state: view.state, a: A.id, b: B.id, myTeamId, names, rows: rowsAll, isThisMeeting: (r) => r.competition === 'league' && r.season === ctx.currentSeason && r.gameweek === gw,
    });

    return { leagueId, myTeamId, view, teams: { a: A, b: B }, ties, current, metas, h2h, window, deadline };
}

const fmtM = (v: number) => v.toFixed(2);

/**
 * The all-time head-to-head between two clubs, across every competition, from
 * the viewer's side: the league matchup page and the cup tie page both use it.
 */
export async function loadHeadToHead(
    admin: SupabaseClient,
    o: {
        leagueId: string; season: string; gw: number; state: MatchupView['state']; a: string; b: string; myTeamId?: string;
        names: Record<string, string>; rows: MatchupRow[]; isThisMeeting: (r: Result) => boolean;
    },
): Promise<H2HData> {
    const { leagueId, season, gw, state, myTeamId, names } = o;
    const rows = o.rows as unknown as MatchupRowLite[];
    const mineId = o.b === myTeamId ? o.b : o.a;
    const otherId = mineId === o.a ? o.b : o.a;
    const all = await loadAllResults(admin, leagueId, season).catch(() => []);
    const hh = headToHead(all, mineId, otherId);
    const shortSeason = (s: string) => s.replace(/^\d{2}(\d{2})-(\d{2})$/, '$1/$2');
    const meetings = hh.meetings.map((r, i) => {
        const isA = r.teamAId === mineId;
        const my = isA ? r.scoreA : r.scoreB, opp = isA ? r.scoreB : r.scoreA;
        const stage = r.competition === 'league' && r.gameweek != null ? `GW${r.gameweek}` : r.stage;
        const label = r.season === season ? stage : `${shortSeason(r.season)} ${stage}`;
        const letter = r.competition === 'league' ? resultOf(my, opp) : (r.winnerId === mineId ? 'W' : 'L');
        const isThis = o.isThisMeeting(r);
        return { key: `${r.season}-${r.competition}-${r.stage}-${i}`, label, my, opp, r: letter as 'W' | 'D' | 'L', isThis };
    });
    const next = o.rows.find((m) => m.gameweek > gw && ((m.team_a_id === mineId && m.team_b_id === otherId) || (m.team_a_id === otherId && m.team_b_id === mineId)));
    const viewerIn = mineId === myTeamId;
    let note = '';
    if (!meetings.length) note = 'First meeting between these two clubs.';
    else if (meetings.length === 1 && meetings[0].isThis) note = 'The first meeting between these two clubs.';
    else if (state === 'upcoming' && meetings[0]) {
        const m0 = meetings[0];
        const d = fmtM(Math.abs(m0.my - m0.opp));
        const who = viewerIn ? 'You' : names[mineId];
        note = m0.r === 'W' ? `${who} beat ${names[otherId]} by ${d} last time, ${m0.label}.`
            : m0.r === 'L' ? `${names[otherId]} beat ${viewerIn ? 'you' : names[mineId]} by ${d} last time, ${m0.label}.`
            : `${names[mineId]} and ${names[otherId]} drew last time, ${m0.label}.`;
    }
    const formUpto = state === 'upcoming' ? gw : gw - 1;
    return {
        won: hh.won, drawn: hh.drawn, lost: hh.lost,
        meetings,
        nextLabel: next ? `GW${next.gameweek}` : null,
        note,
        formMine: formOf(rows, mineId, formUpto).slice(-5).map((x) => x.r),
        formOther: formOf(rows, otherId, formUpto).slice(-5).map((x) => x.r),
        formLabel: state === 'upcoming' ? 'Form' : 'Form Before This Match',
    };
}
