/**
 * One matchup, scored and shaped for the Gameweeks and Matchup pages.
 *
 * This is the matchup detail page's own scoring path (calculateTeamScore,
 * applyCountedPoints, buildLineupPerformance) moved behind one function, so
 * the round page's fixture strips and the matchup page read the same numbers.
 * Every per-player figure here is the one the side's total counted.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BenchSlot, Matchup, MatchupLineup, Player, RawStats, ReferenceStats } from '@/types';
import { FULL_PLAYER_SELECT } from '@/lib/constants/queries';
import { getEffectiveLineupForTeam } from '@/lib/lineups/carryForward';
import { generateMatchReport, type MatchReport } from '@/lib/narrative/matchReport';
import {
  applyCountedPoints,
  applySubsToLineup,
  attachLineupSlotScores,
  buildLineupPerformance,
  calculateTeamScore,
  emptyTeamScoreDetail,
  type MatchupPlayerDetail,
  type PlayerScoreRecord,
  type TeamScoreDetail,
} from '@/lib/scoring/matchups';
import { getPlayerFixture, type ClubGameweekFixture } from '@/lib/fixtures/gameweekFixtures';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import type { PerfGroup } from '@/lib/scoring/perfBand';
import type { CrestConfig } from '@/components/crest/types';

export type MatchState = 'final' | 'provisional' | 'live' | 'upcoming';
export type ChipStatus = 'played' | 'dnp' | 'pend';
export type Line = 'Goalkeeper' | 'Defence' | 'Midfield' | 'Attack';

export interface FixtureLite {
  opponent: string;
  opponentShort: string;
  kickoffTime: string | null;
}

export interface PitchPlayer {
  id: string;
  name: string;
  /** The slot he was fielded in; a bench player's own position. */
  slot: string;
  club: string | null;
  photoUrl: string | null;
  photoVersion: string | null;
  headTopPct: number | null;
  headWidthPct: number | null;
  points: number;
  rating: number | null;
  status: ChipStatus;
  /** Goals and assists first, then the position's own stats. */
  stats: string[];
  fixture: FixtureLite | null;
  perf: PerfGroup[] | null;
  subIn?: boolean;
  replacedName?: string;
}

export interface BenchPlayer extends PitchPlayer {
  benchSlot: BenchSlot;
  /** What the bench bonus paid for him; 0 when he did not play or came on. */
  credit: number;
  cameOn: boolean;
}

export interface SideView {
  teamId: string;
  name: string;
  crest: CrestConfig | null;
  manager: string | null;
  formation: string | null;
  score: number;
  xi: number;
  bench: number;
  /** Starters whose club has kicked off. */
  played: number;
  toPlay: number;
  lines: Record<Line, number>;
  starters: PitchPlayer[];
  benchPlayers: BenchPlayer[];
}

export interface SlotGain { id: string; name: string; slot: string; points: number; bench: boolean; photoUrl: string | null; photoVersion: string | null }
export interface SlotView {
  t: string;
  a: number;
  b: number;
  cumA: number;
  cumB: number;
  /** The slot has kicked off. */
  started: boolean;
  whoA: SlotGain[];
  whoB: SlotGain[];
  /** Starters still to play in this slot, per side (live and upcoming). */
  toPlayA: SlotGain[];
  toPlayB: SlotGain[];
}

export interface MatchupView {
  id: string;
  gameweek: number;
  state: MatchState;
  a: SideView;
  b: SideView;
  slots: SlotView[];
  report: MatchReport | null;
  firstKickoff: string | null;
  lastKickoff: string | null;
  /** Rows the player card needs, keyed by id, so a chip opens instantly. */
  players: Record<string, Partial<Player>>;
}

export interface MatchupContext {
  currentSeason: string;
  refStats: Record<string, ReferenceStats>;
  fixtureMap: Record<string, ClubGameweekFixture>;
  finishedPlTeamIds: Set<number>;
  /** Clubs whose match has kicked off; null when it could not be read. */
  startedPlTeamIds: Set<number> | null;
  finalised: boolean;
  /** FPL's current gameweek and whether it has finished. */
  currentFplGw: number;
  isCurrentFplGwFinished: boolean;
  managers: Record<string, string | null>;
  now: number;
}

type TeamRow = { id: string; team_name: string; crest_config: CrestConfig | null };
export type MatchupRow = Matchup & { team_a: TeamRow | null; team_b: TeamRow | null };

const ZONE: Record<string, Line> = {
  GK: 'Goalkeeper', CB: 'Defence', LB: 'Defence', RB: 'Defence', LWB: 'Defence', RWB: 'Defence',
  DM: 'Midfield', CM: 'Midfield', AM: 'Midfield', LW: 'Attack', RW: 'Attack', ST: 'Attack',
};
export const lineOf = (slot: string): Line => ZONE[slot] ?? 'Midfield';

/** Goals and assists lead for every position: what scored comes before what defended. */
export function statTokens(stats: RawStats | undefined | null, slot: string): string[] {
  if (!stats) return [];
  const s = stats as unknown as Record<string, number | boolean | undefined>;
  const out: string[] = [];
  const g = Number(s.goals ?? 0), a = Number(s.assists ?? 0);
  if (g) out.push(`${g}G`);
  if (a) out.push(`${a}A`);
  if (slot === 'GK') {
    if (Number(s.saves ?? 0)) out.push(`${s.saves} Sv`);
    if (s.clean_sheet) out.push('CS');
  } else if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'DM'].includes(slot)) {
    if (s.clean_sheet) out.push('CS');
    if (Number(s.fpl_tackles ?? 0)) out.push(`${s.fpl_tackles} Tk`);
  } else if (['CM', 'AM'].includes(slot)) {
    const xa = Number(s.expected_assists ?? 0);
    if (xa >= 0.05) out.push(`${xa.toFixed(2)} xA`);
  } else {
    const xg = Number(s.expected_goals ?? 0);
    if (xg >= 0.05) out.push(`${xg.toFixed(2)} xG`);
  }
  return out;
}

/**
 * The gameweek state, from the row and FPL's clock. A completed row is Final
 * once the post-lockdown pass has run (gameweekState.ts), Provisional before.
 * A row FPL has finished but the processor has not locked yet is Provisional
 * too: its scores are in, they just are not settled.
 */
export function matchState(
  m: Pick<Matchup, 'status' | 'gameweek'>,
  ctx: Pick<MatchupContext, 'currentFplGw' | 'isCurrentFplGwFinished' | 'finalised' | 'startedPlTeamIds'>,
): MatchState {
  if (m.status === 'completed') return ctx.finalised ? 'final' : 'provisional';
  const fplDone = ctx.currentFplGw > m.gameweek || (ctx.currentFplGw === m.gameweek && ctx.isCurrentFplGwFinished);
  if (fplDone) return 'provisional';
  if (m.status === 'live') return 'live';
  if (ctx.currentFplGw === m.gameweek && (ctx.startedPlTeamIds?.size ?? 0) > 0) return 'live';
  return 'upcoming';
}

const fixtureLite = (f: ClubGameweekFixture | null | undefined): FixtureLite | null =>
  (f ? { opponent: f.opponent, opponentShort: f.opponentShort, kickoffTime: f.kickoffTime } : null);

export async function loadMatchupView(
  admin: SupabaseClient,
  matchup: MatchupRow,
  ctx: MatchupContext,
): Promise<MatchupView> {
  const gw = matchup.gameweek;
  const [lineupA, lineupB] = await Promise.all([
    getEffectiveLineupForTeam(admin, { teamId: matchup.team_a_id, gameweek: gw, currentLineup: matchup.lineup_a as MatchupLineup | null }),
    matchup.team_b_id
      ? getEffectiveLineupForTeam(admin, { teamId: matchup.team_b_id, gameweek: gw, currentLineup: matchup.lineup_b as MatchupLineup | null })
      : Promise.resolve(null),
  ]);

  const ids = new Set<string>();
  for (const l of [lineupA, lineupB]) {
    l?.starters.forEach((s) => ids.add(s.player_id));
    (l?.bench ?? []).forEach((b) => ids.add(b.player_id));
  }
  const idList = [...ids];
  const [{ data: playerRows }, { data: rankRows }, { data: statRows }] = await Promise.all([
    idList.length ? (admin.from('players').select(FULL_PLAYER_SELECT).in('id', idList) as unknown as Promise<{ data: Record<string, unknown>[] | null }>) : Promise.resolve({ data: [] }),
    idList.length ? admin.from('player_rankings').select('*').in('player_id', idList) : Promise.resolve({ data: [] }),
    idList.length
      ? admin.from('player_stats').select('player_id, fantasy_points, match_rating, stats, perf').eq('season', ctx.currentSeason).eq('gameweek', gw).in('player_id', idList)
      : Promise.resolve({ data: [] }),
  ]);

  const playerMap: Record<string, Partial<Player>> = {};
  const rankMap = new Map(((rankRows ?? []) as Record<string, unknown>[]).map((r) => [r.player_id as string, r]));
  for (const p of (playerRows ?? []) as Record<string, unknown>[]) {
    const r = rankMap.get(p.id as string) as Record<string, unknown> | undefined;
    playerMap[p.id as string] = { ...(p as Partial<Player>), overall_rank: r?.overall_rank as number | undefined, position_ranks: r?.position_ranks as Player['position_ranks'] };
  }

  const detailMap: Record<string, MatchupPlayerDetail> = {};
  const record = new Map<string, PlayerScoreRecord>();
  for (const s of (statRows ?? []) as Record<string, unknown>[]) {
    const stats = (s.stats as RawStats | null) ?? null;
    detailMap[s.player_id as string] = {
      points: Number(s.fantasy_points),
      rating: s.match_rating != null ? Number(s.match_rating) : null,
      stats: stats ?? undefined,
      perf: (s.perf as PerfGroup[] | null) ?? null,
      primaryPosition: playerMap[s.player_id as string]?.primary_position ?? null,
    };
    record.set(s.player_id as string, { fixtures: [{ minutes: stats?.minutes_played ?? 0, fantasyPoints: Number(s.fantasy_points) || 0, stats }] });
  }

  const positions = new Map<string, string[]>();
  const plTeam = new Map<string, number>();
  const primary = new Map<string, string | undefined>();
  for (const [id, p] of Object.entries(playerMap)) {
    positions.set(id, [p.primary_position, ...(p.secondary_positions ?? [])].filter(Boolean) as string[]);
    if (p.pl_team_id != null) plTeam.set(id, Number(p.pl_team_id));
    primary.set(id, p.primary_position ?? undefined);
  }

  const dA: TeamScoreDetail = emptyTeamScoreDetail();
  const dB: TeamScoreDetail = emptyTeamScoreDetail();
  const computedA = calculateTeamScore(lineupA, record, positions, plTeam, ctx.refStats, ctx.finalised, ctx.finishedPlTeamIds, dA);
  const computedB = calculateTeamScore(lineupB, record, positions, plTeam, ctx.refStats, ctx.finalised, ctx.finishedPlTeamIds, dB);
  const effA = applySubsToLineup(lineupA, dA);
  const effB = applySubsToLineup(lineupB, dB);
  attachLineupSlotScores(detailMap, [effA, effB], primary, ctx.refStats);
  const completed = matchup.status === 'completed';
  const reproduces = (c: number, published: number | null | undefined) => !completed || Math.abs(c - Number(published)) < 0.005;
  applyCountedPoints(detailMap, [reproduces(computedA, matchup.score_a) ? dA : undefined, reproduces(computedB, matchup.score_b) ? dB : undefined], ctx.refStats);
  // A bench player who played earned his club's bench bonus at his own position, so he gets the same
  // explanation a starter does. Starters and auto-subs keep theirs: they are scored at the slot they fill.
  const benchAsStarters = (l: MatchupLineup | null) => ({
    starters: (l?.bench ?? []).map((b) => ({ player_id: b.player_id, slot: String(playerMap[b.player_id]?.primary_position ?? '') })),
  });
  const perfMap = {
    ...buildLineupPerformance(detailMap, [benchAsStarters(lineupA), benchAsStarters(lineupB)], ctx.refStats),
    ...buildLineupPerformance(detailMap, [effA, effB], ctx.refStats),
  };

  const state = matchState(matchup, ctx);
  const started = (pid: string) => {
    if (state === 'final' || state === 'provisional') return true;
    if (state === 'upcoming') return false;
    const t = plTeam.get(pid);
    return ctx.startedPlTeamIds ? (t != null && ctx.startedPlTeamIds.has(t)) : true;
  };

  const chip = (pid: string, slot: string, extra?: Partial<PitchPlayer>): PitchPlayer => {
    const p = playerMap[pid] ?? {};
    const d = detailMap[pid];
    const at = d?.bySlot?.[slot];
    const mins = Number(d?.stats?.minutes_played ?? 0);
    const st: ChipStatus = !started(pid) ? 'pend' : mins > 0 || extra?.subIn ? 'played' : 'dnp';
    return {
      id: pid,
      name: p.web_name ? getPlayerDisplayName(p) : '—',
      slot,
      club: (p.pl_team as string | undefined) ?? null,
      photoUrl: (p.photo_url as string | undefined) ?? null,
      photoVersion: (p.photo_version as string | undefined) ?? null,
      headTopPct: (p.portrait_head_top_pct as number | undefined) ?? null,
      headWidthPct: (p.portrait_head_width_pct as number | undefined) ?? null,
      points: at?.points ?? d?.points ?? 0,
      rating: at?.rating ?? d?.rating ?? null,
      status: st,
      stats: statTokens(d?.stats, slot),
      fixture: fixtureLite(getPlayerFixture(p, ctx.fixtureMap)),
      perf: perfMap[pid] ?? null,
      ...extra,
    };
  };

  const side = (
    team: TeamRow | null, lineup: MatchupLineup | null, detail: TeamScoreDetail, computed: number, published: number,
  ): SideView => {
    const subsByOut = new Map(detail.subs.map((s) => [s.outId, s]));
    const subIns = new Set(detail.subs.map((s) => s.inId));
    const starters = (lineup?.starters ?? []).map((s) => {
      const sub = subsByOut.get(s.player_id);
      if (sub) {
        const out = playerMap[s.player_id];
        return chip(sub.inId, s.slot, { subIn: true, replacedName: out?.web_name ? getPlayerDisplayName(out) : undefined, points: sub.points });
      }
      return chip(s.player_id, s.slot);
    });
    const credit = new Map(detail.benchBonus.map((b) => [b.playerId, b.credit]));
    const benchPlayers: BenchPlayer[] = (lineup?.bench ?? []).map((b) => {
      const p = playerMap[b.player_id];
      const c = chip(b.player_id, (p?.primary_position as string | undefined) ?? 'N/A');
      return { ...c, benchSlot: (b.slot ?? 'FLEX') as BenchSlot, credit: credit.get(b.player_id) ?? 0, cameOn: subIns.has(b.player_id) };
    });
    const lines: Record<Line, number> = { Goalkeeper: 0, Defence: 0, Midfield: 0, Attack: 0 };
    for (const p of starters) if (p.status === 'played') lines[lineOf(p.slot)] += p.points;
    const score = completed ? published : computed;
    const benchTotal = detail.benchBonusTotal;
    const playedN = starters.filter((p) => p.status !== 'pend').length;
    return {
      teamId: team?.id ?? '',
      name: team?.team_name ?? 'TBD',
      crest: team?.crest_config ?? null,
      manager: team ? ctx.managers[team.id] ?? null : null,
      formation: lineup?.formation ?? null,
      score: Math.round(score * 100) / 100,
      xi: Math.round((score - benchTotal) * 100) / 100,
      bench: benchTotal,
      played: playedN,
      toPlay: starters.length - playedN,
      lines,
      starters,
      benchPlayers,
    };
  };

  const a = side(matchup.team_a, lineupA, dA, computedA, Number(matchup.score_a));
  const b = side(matchup.team_b, lineupB, dB, computedB, Number(matchup.score_b));

  // The weekend clock: every kickoff either side has a player in, and what
  // each side banked in it. Bench bonus lands with the bench player's match.
  const slotMap = new Map<string, SlotView>();
  const slotFor = (t: string) => {
    if (!slotMap.has(t)) slotMap.set(t, { t, a: 0, b: 0, cumA: 0, cumB: 0, started: Date.parse(t) <= ctx.now, whoA: [], whoB: [], toPlayA: [], toPlayB: [] });
    return slotMap.get(t)!;
  };
  const gain = (p: PitchPlayer, points: number, bench: boolean): SlotGain => ({ id: p.id, name: p.name, slot: p.slot, points, bench, photoUrl: p.photoUrl, photoVersion: p.photoVersion });
  for (const [key, s] of [['A', a], ['B', b]] as const) {
    for (const p of s.starters) {
      if (!p.fixture?.kickoffTime) continue;
      const slot = slotFor(p.fixture.kickoffTime);
      if (p.status === 'pend') (key === 'A' ? slot.toPlayA : slot.toPlayB).push(gain(p, 0, false));
      else {
        if (key === 'A') { slot.a += p.points; slot.whoA.push(gain(p, p.points, false)); }
        else { slot.b += p.points; slot.whoB.push(gain(p, p.points, false)); }
      }
    }
    for (const bp of s.benchPlayers) {
      if (!bp.credit || !bp.fixture?.kickoffTime) continue;
      const slot = slotFor(bp.fixture.kickoffTime);
      if (key === 'A') { slot.a += bp.credit; slot.whoA.push(gain(bp, bp.credit, true)); }
      else { slot.b += bp.credit; slot.whoB.push(gain(bp, bp.credit, true)); }
    }
  }
  const slots = [...slotMap.values()].sort((x, y) => Date.parse(x.t) - Date.parse(y.t));
  let ca = 0, cb = 0;
  for (const s of slots) {
    ca += s.a; cb += s.b;
    s.cumA = Math.round(ca * 100) / 100;
    s.cumB = Math.round(cb * 100) / 100;
    s.whoA.sort((x, y) => y.points - x.points);
    s.whoB.sort((x, y) => y.points - x.points);
  }

  const kicks = Object.values(ctx.fixtureMap).map((f) => f.kickoffTime).filter(Boolean) as string[];
  kicks.sort();

  const report = state === 'upcoming' ? null : generateMatchReport(matchup, lineupA, lineupB, playerMap, detailMap, a.score, b.score, dA, dB);

  return {
    id: matchup.id,
    gameweek: gw,
    state,
    a,
    b,
    slots,
    report,
    firstKickoff: kicks[0] ?? null,
    lastKickoff: kicks[kicks.length - 1] ?? null,
    players: playerMap,
  };
}

/** Club colour for the scoreboard ground: the first crest colour that is neither near-black nor near-white. */
export function clubColour(crest: CrestConfig | null | undefined): string {
  const lum = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    if (Number.isNaN(n)) return 0.2;
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const options = [crest?.primaryColor, crest?.iconColor, crest?.secondaryColor].filter(Boolean) as string[];
  return options.find((h) => { const l = lum(h); return l > 0.035 && l < 0.6; }) ?? options[0] ?? '#146B40';
}
