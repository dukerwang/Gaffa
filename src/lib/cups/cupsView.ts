/**
 * The Cups page as a pure model: the trophy shelf, your next tie, and each
 * round of the selected cup as a page of the pager. No I/O, so every status
 * and label here is unit-tested (spec: docs/superpowers/specs/
 * 2026-10-25-cups-redesign-design.md, § 2).
 */
import type { CrestConfig } from '@/components/crest/types';
import type { HonourKind } from '@/lib/honours/getClubHonours';
import { getSeeding } from '@/lib/tournaments/engine';
import type { TournamentType } from '@/types';

// ─── Inputs ──────────────────────────────────────────────────

export interface CupClub {
  id: string;
  name: string;
  crest: CrestConfig | null;
}

export interface CupRow {
  id: string;
  type: TournamentType;
  name: string;
  status: 'pending' | 'active' | 'completed';
  season?: string;
}

export interface RoundRow {
  id: string;
  tournament_id: string;
  name: string;
  round_number: number;
  start_gameweek: number;
  end_gameweek: number;
  is_two_leg: boolean;
  drawn_at: string | null;
}

export interface TieRow {
  id: string;
  round_id: string;
  bracket_position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_score_leg1: number;
  team_b_score_leg1: number;
  team_a_score_leg2: number;
  team_b_score_leg2: number;
  winner_id: string | null;
  decided_by: 'score' | 'best_performer' | 'position' | null;
  next_matchup_id: string | null;
  status: 'pending' | 'active' | 'completed';
}

export interface CupsInput {
  leagueId: string;
  myTeamId: string | null;
  /** The viewer's crest colours, for the trophy ribbons. */
  myCrest: CrestConfig | null;
  clubs: Record<string, CupClub>;
  clubCount: number;
  cups: CupRow[];
  rounds: RoundRow[];
  ties: TieRow[];
  /** FPL deadline per matchweek, ISO. */
  deadlines: Record<number, string>;
  currentGw: number;
  currentGwFinished: boolean;
  /** Each club's running score for the current matchweek, from its league matchup. */
  liveScores: Record<string, number>;
  prizes: Partial<Record<TournamentType, { winner: number; runnerUp: number }>>;
  selectedCupId: string | null;
  /** FPL's season ("2026-27"); a cup from another season gets no dates or live state. */
  currentSeason?: string | null;
}

// ─── Output ──────────────────────────────────────────────────

export type TieState = 'upcoming' | 'live' | 'done';

export interface TieLine {
  club: CupClub | null;
  /** Shown in place of a club: "Not Too Xabi or tottenyang FC", "Semi-Final Winner". */
  label: string | null;
  seed: number | null;
  /** Total across legs; null before the tie has started. */
  score: number | null;
  legs: (number | null)[];
  won: boolean;
  lost: boolean;
  mine: boolean;
  tag: 'Bye' | 'In' | null;
}

export interface TieModel {
  id: string;
  href: string | null;
  state: TieState;
  a: TieLine;
  b: TieLine;
  mine: boolean;
  bye: boolean;
  /** "Best Performer", "League Position" or "Seeding"; null on score or unfinished. */
  decidedLabel: string | null;
}

export interface RoundPage {
  id: string;
  name: string;
  short: string;
  /** "MW16", "MW21 · 24". */
  mw: string;
  /** "Sat 19 Dec", "Two Legs · Sat 16 Jan & Sat 6 Feb". */
  when: string;
  live: boolean;
  ties: TieModel[];
  /** An undrawn round: its ties are pairs of lines in one pool, not real ties. */
  pool: boolean;
  /** Sentence under an undrawn round. */
  note: string | null;
  prize: { winner: number; runnerUp: number } | null;
}

export interface ShelfItem {
  cupId: string | null;
  type: TournamentType;
  kind: HonourKind;
  name: string;
  short: string;
  status: string;
  selected: boolean;
  href: string | null;
}

export type NextTie =
  | { kind: 'tie'; cupName: string; round: string; mw: string; when: string; tie: TieModel; legs: boolean }
  | { kind: 'through'; cupName: string; round: string; next: string; note: string; bye: boolean }
  | { kind: 'out'; cupName: string; round: string; tie: TieModel }
  | { kind: 'winner'; cupName: string; club: CupClub; mine: boolean };

export interface CupsModel {
  shelf: ShelfItem[];
  selected: { id: string; name: string; type: TournamentType; seeded: boolean } | null;
  next: NextTie | null;
  rounds: RoundPage[];
  initialRound: number;
  club: { primary: string; secondary: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────

const ORDER: TournamentType[] = ['primary_cup', 'secondary_cup', 'consolation_cup'];
const KIND: Record<TournamentType, HonourKind> = { primary_cup: 'champions_cup', secondary_cup: 'league_cup', consolation_cup: 'consolation_cup' };
const NAME: Record<TournamentType, string> = { primary_cup: 'Champions Cup', secondary_cup: 'League Cup', consolation_cup: 'Consolation Cup' };
const SHORT_NAME: Record<TournamentType, string> = { primary_cup: 'Champions', secondary_cup: 'League Cup', consolation_cup: 'Consolation' };

export function roundShort(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('quarter')) return 'QF';
  if (n.includes('semi')) return 'SF';
  if (n === 'final') return 'Final';
  const m = name.match(/(\d+)/);
  return m ? `R${m[1]}` : name;
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
/** "Sat 19 Dec" from a matchweek's deadline. */
export function dayLabel(iso: string | undefined): string {
  if (!iso) return '';
  const parts = DAY.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`;
}

function roundMw(r: RoundRow): string {
  return r.start_gameweek === r.end_gameweek ? `MW${r.start_gameweek}` : `MW${r.start_gameweek} · ${r.end_gameweek}`;
}

function roundWhen(r: RoundRow, deadlines: Record<number, string>): string {
  if (r.is_two_leg) return `Two Legs · ${dayLabel(deadlines[r.start_gameweek])} & ${dayLabel(deadlines[r.end_gameweek])}`;
  return dayLabel(deadlines[r.start_gameweek]);
}

function roundLive(r: RoundRow, gw: number, finished: boolean): boolean {
  return gw >= r.start_gameweek && gw <= r.end_gameweek && !(gw === r.end_gameweek && finished);
}

const decidedLabel = (t: TieRow, r: RoundRow): string | null =>
  t.decided_by === 'best_performer' ? 'Best Performer'
    : t.decided_by === 'position' ? (r.drawn_at ? 'League Position' : 'Seeding')
    : null;

// ─── Ties ────────────────────────────────────────────────────

interface Ctx {
  input: CupsInput;
  cup: CupRow;
  rounds: RoundRow[];
  tiesByRound: Map<string, TieRow[]>;
  seeds: Map<string, number>;
  seeded: boolean;
  /** The cup belongs to a season FPL has moved on from: no dates, nothing live. */
  pastSeason: boolean;
}

function legScore(ctx: Ctx, r: RoundRow, t: TieRow, side: 'a' | 'b', leg: 1 | 2): number | null {
  const { currentGw, currentGwFinished, liveScores } = ctx.input;
  const gw = leg === 1 ? r.start_gameweek : r.end_gameweek;
  const stored = (side === 'a' ? (leg === 1 ? t.team_a_score_leg1 : t.team_a_score_leg2) : (leg === 1 ? t.team_b_score_leg1 : t.team_b_score_leg2));
  // A finished tie keeps its scores, whatever matchweek FPL is on now (a past season's cup).
  if (t.status === 'completed') return Number(stored);
  if (gw > currentGw || ctx.pastSeason) return null;
  const club = side === 'a' ? t.team_a_id : t.team_b_id;
  // The running score for the current matchweek lives on the club's league
  // matchup; tournament_matchups catches up only when the matchweek resolves.
  if (gw === currentGw && !currentGwFinished && club && liveScores[club] != null) return liveScores[club];
  return Number(stored);
}

/** What fills an empty place: the clubs of the tie that feeds it, or the round it comes from. */
function placeLabel(ctx: Ctx, r: RoundRow, t: TieRow, side: 'a' | 'b'): string {
  const prev = ctx.rounds.find((x) => x.round_number === r.round_number - 1);
  if (prev) {
    const feeder = (ctx.tiesByRound.get(prev.id) ?? []).find(
      (f) => f.next_matchup_id === t.id && (f.bracket_position % 2 === 0) === (side === 'a'),
    );
    const a = feeder?.team_a_id ? ctx.input.clubs[feeder.team_a_id]?.name : null;
    const b = feeder?.team_b_id ? ctx.input.clubs[feeder.team_b_id]?.name : null;
    if (a && b) return `${a} or ${b}`;
    return `${prev.name} Winner`;
  }
  if (ctx.cup.type === 'consolation_cup') return 'Champions Cup Loser';
  return 'To Be Drawn';
}

function tieModel(ctx: Ctx, r: RoundRow, t: TieRow): TieModel {
  const me = ctx.input.myTeamId;
  const bothIn = !!t.team_a_id && !!t.team_b_id;
  const bye = t.status === 'completed' && !!t.winner_id && !bothIn;
  const state: TieState = t.status === 'completed' && bothIn ? 'done'
    : bothIn && !ctx.pastSeason && roundLive(r, ctx.input.currentGw, ctx.input.currentGwFinished) ? 'live'
    : 'upcoming';

  const line = (side: 'a' | 'b'): TieLine => {
    const id = side === 'a' ? t.team_a_id : t.team_b_id;
    const club = id ? ctx.input.clubs[id] ?? null : null;
    const legs = bothIn ? (r.is_two_leg ? [legScore(ctx, r, t, side, 1), legScore(ctx, r, t, side, 2)] : [legScore(ctx, r, t, side, 1)]) : [];
    const played = legs.filter((v): v is number => v != null);
    const score = state === 'upcoming' || played.length === 0 ? null : played.reduce((x, y) => x + y, 0);
    return {
      club,
      label: club ? null : bye ? null : placeLabel(ctx, r, t, side),
      seed: ctx.seeded && id ? ctx.seeds.get(id) ?? null : null,
      score,
      legs,
      won: state === 'done' && !!id && t.winner_id === id,
      lost: state === 'done' && !!id && !!t.winner_id && t.winner_id !== id,
      mine: !!id && id === me,
      tag: bye && id ? 'Bye' : null,
    };
  };

  const a = line('a');
  const b = line('b');
  return {
    id: t.id,
    href: bothIn ? `/league/${ctx.input.leagueId}/tournaments/${t.id}` : null,
    state,
    a,
    b,
    mine: a.mine || b.mine,
    bye,
    decidedLabel: state === 'done' ? decidedLabel(t, r) : null,
  };
}

/**
 * A round still to be drawn has no ties to show yet: the clubs already
 * through, then one open place per club still to come, named for where it
 * comes from.
 */
function poolPage(ctx: Ctx, r: RoundRow, ties: TieRow[]): TieModel[] | null {
  const drawnRound = ctx.cup.type === 'secondary_cup' && r.round_number > 1 && !r.drawn_at;
  const consolationPool = ctx.cup.type === 'consolation_cup' && r.round_number === 1 && !r.drawn_at
    && (ctx.input.clubCount === 5 || ctx.input.clubCount === 6);
  if (!drawnRound && !consolationPool) return null;

  const me = ctx.input.myTeamId;
  const places = ties.length * 2;
  const inClubs: string[] = [];
  const open: string[] = [];

  if (drawnRound) {
    const prev = ctx.rounds.find((x) => x.round_number === r.round_number - 1);
    for (const f of prev ? ctx.tiesByRound.get(prev.id) ?? [] : []) {
      if (f.winner_id) inClubs.push(f.winner_id);
      else {
        const a = f.team_a_id ? ctx.input.clubs[f.team_a_id]?.name : null;
        const b = f.team_b_id ? ctx.input.clubs[f.team_b_id]?.name : null;
        open.push(a && b ? `${a} or ${b}` : prev ? `${prev.name} Winner` : 'To Be Drawn');
      }
    }
  } else {
    for (const t of ties) for (const id of [t.team_a_id, t.team_b_id]) if (id) inClubs.push(id);
    // 6 clubs: two quarter-final losers then two semi-final losers; 5 clubs: one then two.
    const fromQf = ctx.input.clubCount === 6 ? 2 : 1;
    const qfStillToCome = Math.max(0, fromQf - inClubs.length);
    for (let i = 0; i < places - inClubs.length; i++) open.push(i < qfStillToCome ? 'Champions Cup QF Loser' : 'Champions Cup SF Loser');
  }

  const lines: TieLine[] = [
    ...inClubs.map((id) => ({
      club: ctx.input.clubs[id] ?? null, label: null, seed: null, score: null, legs: [], won: false, lost: false, mine: id === me, tag: 'In' as const,
    })),
    ...open.slice(0, Math.max(0, places - inClubs.length)).map((label) => ({
      club: null, label, seed: null, score: null, legs: [], won: false, lost: false, mine: false, tag: null,
    })),
  ];
  // One card holds the whole pool; pairs of lines keep the TieModel shape.
  const out: TieModel[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const a = lines[i], b = lines[i + 1] ?? { ...lines[i], club: null, label: 'To Be Drawn', tag: null, mine: false };
    out.push({ id: `${r.id}-pool-${i}`, href: null, state: 'upcoming', a, b, mine: a.mine || b.mine, bye: false, decidedLabel: null });
  }
  return out;
}

function roundPages(ctx: Ctx): RoundPage[] {
  const last = Math.max(...ctx.rounds.map((r) => r.round_number));
  return ctx.rounds.map((r) => {
    const ties = (ctx.tiesByRound.get(r.id) ?? []).slice().sort((x, y) => x.bracket_position - y.bracket_position);
    const pool = poolPage(ctx, r, ties);
    const models = pool ?? ties.map((t) => tieModel(ctx, r, t));
    let note: string | null = null;
    if (pool) {
      const prev = ctx.rounds.find((x) => x.round_number === r.round_number - 1);
      note = ctx.cup.type === 'consolation_cup'
        ? 'Drawn at random once the Champions Cup semi-finals finish.'
        : `Drawn at random once the ${(prev?.name ?? 'previous round').toLowerCase()}s finish.`;
    }
    return {
      id: r.id,
      name: r.name,
      short: roundShort(r.name),
      mw: roundMw(r),
      when: ctx.pastSeason ? (r.is_two_leg ? 'Two Legs' : '') : roundWhen(r, ctx.input.deadlines),
      live: !ctx.pastSeason && roundLive(r, ctx.input.currentGw, ctx.input.currentGwFinished),
      ties: models,
      pool: !!pool,
      note,
      prize: r.round_number === last ? ctx.input.prizes[ctx.cup.type] ?? null : null,
    };
  });
}

// ─── The viewer in a cup ─────────────────────────────────────

interface Standing {
  round: RoundRow;
  tie: TieRow;
}

/** The viewer's latest tie in a cup, by round. */
function latestTie(input: CupsInput, rounds: RoundRow[], tiesByRound: Map<string, TieRow[]>): Standing | null {
  const me = input.myTeamId;
  if (!me) return null;
  let best: Standing | null = null;
  for (const r of rounds) {
    for (const t of tiesByRound.get(r.id) ?? []) {
      if ((t.team_a_id === me || t.team_b_id === me) && (!best || r.round_number > best.round.round_number)) best = { round: r, tie: t };
    }
  }
  return best;
}

function statusFor(input: CupsInput, cup: CupRow, rounds: RoundRow[], tiesByRound: Map<string, TieRow[]>): string {
  const me = input.myTeamId;
  const st = latestTie(input, rounds, tiesByRound);
  const lastNumber = Math.max(0, ...rounds.map((r) => r.round_number));
  if (st) {
    const { round, tie } = st;
    const both = !!tie.team_a_id && !!tie.team_b_id;
    if (tie.status === 'completed' && tie.winner_id) {
      if (tie.winner_id === me) {
        if (round.round_number === lastNumber) return 'Winner';
        const next = rounds.find((r) => r.round_number === round.round_number + 1);
        if (!both && next) return `Bye to ${roundShort(next.name)}`;
        return next ? `${roundShort(next.name)} · MW${next.start_gameweek}` : 'Winner';
      }
      return round.round_number === lastNumber ? 'Runner-Up' : `Out · ${roundShort(round.name)}`;
    }
    return `${roundShort(round.name)} · MW${round.start_gameweek}`;
  }
  const first = rounds.find((r) => r.round_number === 1);
  if (cup.type === 'consolation_cup' && cup.status !== 'completed' && first && input.clubCount <= 6) {
    // A small league's Consolation Cup is filled from Champions Cup losers.
    return `From MW${first.start_gameweek}`;
  }
  return 'Not Entered';
}

function nextTieFor(ctx: Ctx, pages: RoundPage[]): NextTie | null {
  const { input, cup, rounds, tiesByRound } = ctx;
  const me = input.myTeamId;
  const lastNumber = Math.max(0, ...rounds.map((r) => r.round_number));

  if (cup.status === 'completed' || rounds.every((r) => (tiesByRound.get(r.id) ?? []).every((t) => t.status === 'completed'))) {
    const final = rounds.find((r) => r.round_number === lastNumber);
    const winnerId = final ? (tiesByRound.get(final.id) ?? [])[0]?.winner_id : null;
    const club = winnerId ? input.clubs[winnerId] : null;
    if (club) return { kind: 'winner', cupName: cup.name, club, mine: club.id === me };
  }

  // A finished cup with no recorded winner has nothing to come.
  if (cup.status === 'completed') return null;
  const st = latestTie(input, rounds, tiesByRound);
  if (!st) return null;
  const { round, tie } = st;
  const page = pages.find((p) => p.id === round.id);
  const model = page?.ties.find((t) => t.id === tie.id) ?? tieModel(ctx, round, tie);
  const both = !!tie.team_a_id && !!tie.team_b_id;

  if (tie.status === 'completed' && tie.winner_id && tie.winner_id !== me) {
    return { kind: 'out', cupName: cup.name, round: round.name, tie: model };
  }
  if (tie.status === 'completed') {
    // Through, on a win or a bye, to a round you're not placed in yet.
    const next = rounds.find((r) => r.round_number === round.round_number + 1);
    if (!next) return null;
    return {
      kind: 'through',
      bye: !both,
      cupName: cup.name,
      round: round.name,
      next: next.name,
      note: cup.type === 'secondary_cup' ? `Drawn after MW${round.end_gameweek}` : `MW${next.start_gameweek} · ${dayLabel(input.deadlines[next.start_gameweek])}`,
    };
  }
  // The card has one line for this: the first leg's date, with two legs named on the left.
  return { kind: 'tie', cupName: cup.name, round: round.name, mw: roundMw(round), when: dayLabel(input.deadlines[round.start_gameweek]), tie: model, legs: round.is_two_leg };
}

/** Seeds by club, read off the first round's bracket positions (Champions Cup only). */
function seedsOf(rounds: RoundRow[], tiesByRound: Map<string, TieRow[]>): Map<string, number> {
  const seeds = new Map<string, number>();
  const first = rounds.find((r) => r.round_number === 1);
  if (!first) return seeds;
  const ties = tiesByRound.get(first.id) ?? [];
  const order = getSeeding(ties.length * 2);
  for (const t of ties) {
    if (t.team_a_id) seeds.set(t.team_a_id, order[t.bracket_position * 2]);
    if (t.team_b_id) seeds.set(t.team_b_id, order[t.bracket_position * 2 + 1]);
  }
  return seeds;
}

// ─── The page ────────────────────────────────────────────────

export function buildCupsModel(input: CupsInput): CupsModel {
  const tiesByRound = new Map<string, TieRow[]>();
  for (const t of input.ties) {
    const arr = tiesByRound.get(t.round_id) ?? [];
    arr.push(t);
    tiesByRound.set(t.round_id, arr);
  }
  const roundsOf = (cupId: string) => input.rounds.filter((r) => r.tournament_id === cupId).sort((a, b) => a.round_number - b.round_number);
  const byType = new Map(input.cups.map((c) => [c.type, c]));

  // Default cup: your soonest unfinished tie, then the first active cup, then the Champions Cup.
  let selected = input.cups.find((c) => c.id === input.selectedCupId) ?? null;
  if (!selected) {
    let soonest: { cup: CupRow; gw: number } | null = null;
    for (const c of input.cups) {
      if (c.status === 'completed') continue;
      const st = latestTie(input, roundsOf(c.id), tiesByRound);
      if (st && st.tie.status !== 'completed' && (!soonest || st.round.start_gameweek < soonest.gw)) soonest = { cup: c, gw: st.round.start_gameweek };
      // Through (a win or a bye) to a round you're not placed in yet: that round counts.
      if (st && st.tie.status === 'completed' && st.tie.winner_id === input.myTeamId) {
        const next = roundsOf(c.id).find((r) => r.round_number === st.round.round_number + 1);
        if (next && (!soonest || next.start_gameweek < soonest.gw)) soonest = { cup: c, gw: next.start_gameweek };
      }
    }
    selected = soonest?.cup
      ?? ORDER.map((t) => byType.get(t)).find((c) => c?.status === 'active')
      ?? byType.get('primary_cup')
      ?? input.cups[0]
      ?? null;
  }

  const shelf: ShelfItem[] = ORDER.map((type) => {
    const cup = byType.get(type);
    return {
      cupId: cup?.id ?? null,
      type,
      kind: KIND[type],
      name: cup?.name ?? NAME[type],
      short: SHORT_NAME[type],
      status: cup ? statusFor(input, cup, roundsOf(cup.id), tiesByRound) : 'Drawn at MW7',
      selected: !!cup && cup.id === selected?.id,
      href: cup ? `/league/${input.leagueId}/tournaments?cup=${cup.id}` : null,
    };
  });

  const crest = input.myCrest;
  const club = crest ? { primary: crest.primaryColor, secondary: crest.secondaryColor } : null;

  if (!selected) return { shelf, selected: null, next: null, rounds: [], initialRound: 0, club };

  const rounds = roundsOf(selected.id);
  const seeded = selected.type === 'primary_cup';
  const pastSeason = !!input.currentSeason && !!selected.season && selected.season !== input.currentSeason;
  const ctx: Ctx = { input, cup: selected, rounds, tiesByRound, seeds: seeded ? seedsOf(rounds, tiesByRound) : new Map(), seeded, pastSeason };
  const pages = roundPages(ctx);

  // Open on your round, else the live or next round, else the last.
  const st = latestTie(input, rounds, tiesByRound);
  const mineIdx = st && st.tie.status !== 'completed' ? rounds.findIndex((r) => r.id === st.round.id) : -1;
  const liveIdx = pages.findIndex((p) => p.live);
  const nextIdx = rounds.findIndex((r) => r.end_gameweek >= input.currentGw && (tiesByRound.get(r.id) ?? []).some((t) => t.status !== 'completed'));
  const initialRound = mineIdx >= 0 ? mineIdx : liveIdx >= 0 ? liveIdx : nextIdx >= 0 ? nextIdx : Math.max(0, pages.length - 1);

  return {
    shelf,
    selected: { id: selected.id, name: selected.name, type: selected.type, seeded },
    next: nextTieFor(ctx, pages),
    rounds: pages,
    initialRound,
    club,
  };
}
