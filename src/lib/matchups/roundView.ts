/**
 * The league's season as the Gameweeks page reads it: the table after any
 * gameweek, each club's form, your result in every gameweek, and the round's
 * records. Pure functions over the matchups rows, so the table here and the
 * standings page can't disagree about a draw (isDrawMargin is the one rule).
 */
import { isDrawMargin } from '@/lib/scoring/drawBand';

export type ResultLetter = 'W' | 'D' | 'L';

export interface MatchupRowLite {
  id: string;
  gameweek: number;
  team_a_id: string;
  team_b_id: string | null;
  score_a: number;
  score_b: number;
  status: 'scheduled' | 'live' | 'completed';
}

export const resultOf = (mine: number, theirs: number): ResultLetter =>
  isDrawMargin(mine, theirs) ? 'D' : mine > theirs ? 'W' : 'L';

export interface FormEntry { gw: number; r: ResultLetter; my: number; opp: number; vs: string }

/** A club's completed results up to and including `upto`, oldest first. */
export function formOf(rows: MatchupRowLite[], teamId: string, upto: number): FormEntry[] {
  const out: FormEntry[] = [];
  for (const m of rows) {
    if (m.status !== 'completed' || m.gameweek > upto || !m.team_b_id) continue;
    const a = Number(m.score_a), b = Number(m.score_b);
    if (m.team_a_id === teamId) out.push({ gw: m.gameweek, r: resultOf(a, b), my: a, opp: b, vs: m.team_b_id });
    else if (m.team_b_id === teamId) out.push({ gw: m.gameweek, r: resultOf(b, a), my: b, opp: a, vs: m.team_a_id });
  }
  return out.sort((x, y) => x.gw - y.gw);
}

export interface TableRow {
  teamId: string;
  rank: number;
  P: number; W: number; D: number; L: number;
  pts: number;
  pf: number;
  gd: number;
}

/** Wins 3, draws 1; then goal difference, points for, name. */
export function tableAfter(rows: MatchupRowLite[], teamIds: string[], names: Record<string, string>, upto: number): TableRow[] {
  const out = teamIds.map((id) => {
    const f = formOf(rows, id, upto);
    const W = f.filter((x) => x.r === 'W').length;
    const D = f.filter((x) => x.r === 'D').length;
    const L = f.filter((x) => x.r === 'L').length;
    const pf = f.reduce((s, x) => s + x.my, 0);
    const pa = f.reduce((s, x) => s + x.opp, 0);
    return { teamId: id, rank: 0, P: f.length, W, D, L, pts: W * 3 + D, pf, gd: pf - pa };
  });
  out.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.pf - x.pf || (names[x.teamId] ?? '').localeCompare(names[y.teamId] ?? ''));
  out.forEach((r, i) => { r.rank = i + 1; });
  return out;
}

export interface TeamMeta {
  rank: number;
  pts: number;
  W: number; D: number; L: number;
  line: string;
  /** Last five results, oldest first. */
  form: ResultLetter[];
}

export function metaFor(table: TableRow[], rows: MatchupRowLite[], upto: number): Record<string, TeamMeta> {
  const out: Record<string, TeamMeta> = {};
  for (const r of table) {
    out[r.teamId] = {
      rank: r.rank, pts: r.pts, W: r.W, D: r.D, L: r.L,
      line: `W${r.W} D${r.D} L${r.L}`,
      form: formOf(rows, r.teamId, upto).slice(-5).map((x) => x.r),
    };
  }
  return out;
}

export interface RibbonCell {
  gw: number;
  r: ResultLetter | null;
  margin: number;
  live: boolean;
  exists: boolean;
}

/** Your result in each of the 38 gameweeks. */
export function ribbonFor(rows: MatchupRowLite[], teamId: string | undefined, gameweeks: number[], liveGw: number | null): RibbonCell[] {
  const mine = new Map<number, FormEntry>();
  if (teamId) for (const f of formOf(rows, teamId, 99)) mine.set(f.gw, f);
  const have = new Set(gameweeks);
  return Array.from({ length: 38 }, (_, i) => {
    const gw = i + 1;
    const f = mine.get(gw);
    return { gw, r: f?.r ?? null, margin: f ? Math.abs(f.my - f.opp) : 0, live: gw === liveGw, exists: have.has(gw) };
  });
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export const fmt = (v: number | null | undefined) => Number(v ?? 0).toFixed(2);
