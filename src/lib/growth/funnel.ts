/**
 * The growth funnel, computed from rows the app already writes. No tracking
 * code, no extra requests: a signup is `users.created_at`, a join is
 * `league_members.joined_at`, a full league is a member count at `max_teams`,
 * a finished draft is a league past setup. See docs/GROWTH_PLAN.md.
 *
 * Pure on purpose (no imports) so the stage definitions are tested and
 * scripts/funnel.mjs can load it directly.
 */

export interface FunnelUser {
  id: string;
  createdAt: string;
  /** Set by the caller from the email address. Never stored here. */
  looksLikeTest: boolean;
}

export interface FunnelLeague {
  id: string;
  name: string;
  maxTeams: number;
  status: string;
  createdAt: string;
}

export interface FunnelMember {
  leagueId: string;
  userId: string;
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface FunnelPick {
  leagueId: string;
  pickedAt: string;
}

export interface FunnelInput {
  users: FunnelUser[];
  leagues: FunnelLeague[];
  members: FunnelMember[];
  picks: FunnelPick[];
}

export interface FunnelOptions {
  now: Date;
  /** Only users and leagues created on or after this date count. */
  since: Date;
}

export interface Stage {
  label: string;
  count: number;
  /** Share of the first stage. */
  ofStart: number;
  /** Share of the stage before. */
  ofPrevious: number;
}

export interface FunnelResult {
  window: { since: string; now: string };
  excluded: { testLeagues: number; testUsers: number };
  accounts: Stage[];
  leagues: Stage[];
  timing: {
    daysToFullMedian: number | null;
    daysFullToDraftMedian: number | null;
    leaguesTimed: number;
  };
  /** Real accounts in the window that never joined or created a league. */
  neverJoined: number;
  /** Signups per week (weeks start on Monday, UTC) and how many of them never joined a league. */
  weekly: { week: string; signups: number; neverJoined: number }[];
}

const TEST_LEAGUE_NAME = /^(test|e2e)\b/i;
const DRAFTED_STATUSES = new Set(['active', 'offseason']);
const DAY = 24 * 60 * 60 * 1000;

export function isTestLeagueName(name: string): boolean {
  return TEST_LEAGUE_NAME.test(name.trim());
}

/** An email that belongs to a test account. Plus-addressing alone isn't one: real people use it. */
export function emailLooksLikeTest(email: string | null | undefined): boolean {
  return !!email && /(test|e2e|example\.com|mailinator)/i.test(email);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The Monday (UTC) on or before a date, as YYYY-MM-DD. */
export function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function stages(steps: { label: string; count: number }[]): Stage[] {
  const start = steps[0]?.count ?? 0;
  return steps.map((s, i) => ({
    label: s.label,
    count: s.count,
    ofStart: start === 0 ? 0 : s.count / start,
    ofPrevious: i === 0 ? 1 : steps[i - 1].count === 0 ? 0 : s.count / steps[i - 1].count,
  }));
}

export function computeFunnel(input: FunnelInput, options: FunnelOptions): FunnelResult {
  const since = options.since.getTime();
  const now = options.now.getTime();

  const leaguesAll = input.leagues;
  const testLeagueIds = new Set(leaguesAll.filter((l) => isTestLeagueName(l.name)).map((l) => l.id));
  const realLeagues = leaguesAll.filter((l) => !testLeagueIds.has(l.id));
  const leagueById = new Map(realLeagues.map((l) => [l.id, l]));

  const membersByLeague = new Map<string, FunnelMember[]>();
  const leaguesByUser = new Map<string, Set<string>>();
  const allLeaguesByUser = new Map<string, Set<string>>();
  for (const m of input.members) {
    if (!allLeaguesByUser.has(m.userId)) allLeaguesByUser.set(m.userId, new Set());
    allLeaguesByUser.get(m.userId)!.add(m.leagueId);
    if (!leagueById.has(m.leagueId)) continue;
    if (!membersByLeague.has(m.leagueId)) membersByLeague.set(m.leagueId, []);
    membersByLeague.get(m.leagueId)!.push(m);
    if (!leaguesByUser.has(m.userId)) leaguesByUser.set(m.userId, new Set());
    leaguesByUser.get(m.userId)!.add(m.leagueId);
  }

  // A user is a test account if the email says so, or if every league they're in is a test league.
  const isTestUser = (u: FunnelUser) => {
    if (u.looksLikeTest) return true;
    const all = allLeaguesByUser.get(u.id);
    return !!all && all.size > 0 && [...all].every((id) => testLeagueIds.has(id));
  };
  const realUsers = input.users.filter((u) => !isTestUser(u));
  const usersInWindow = realUsers.filter((u) => new Date(u.createdAt).getTime() >= since);

  const isFull = (leagueId: string) => {
    const league = leagueById.get(leagueId);
    return !!league && (membersByLeague.get(leagueId)?.length ?? 0) >= league.maxTeams;
  };
  const isDrafted = (leagueId: string) => DRAFTED_STATUSES.has(leagueById.get(leagueId)?.status ?? '');
  const visitedWithin = (m: FunnelMember, days: number) =>
    !!m.lastActiveAt && now - new Date(m.lastActiveAt).getTime() <= days * DAY;

  // --- Accounts ---------------------------------------------------------------
  const inAnyLeague = usersInWindow.filter((u) => leaguesByUser.has(u.id));
  const inFull = inAnyLeague.filter((u) => [...leaguesByUser.get(u.id)!].some(isFull));
  const inDrafted = inAnyLeague.filter((u) => [...leaguesByUser.get(u.id)!].some(isDrafted));
  const visitedRecently = inDrafted.filter((u) =>
    input.members.some((m) => m.userId === u.id && leagueById.has(m.leagueId) && visitedWithin(m, 14)),
  );

  // --- Leagues ----------------------------------------------------------------
  const leaguesInWindow = realLeagues.filter((l) => new Date(l.createdAt).getTime() >= since);
  const withMembers = (min: number) => (l: FunnelLeague) => (membersByLeague.get(l.id)?.length ?? 0) >= min;
  const twoPlus = leaguesInWindow.filter(withMembers(2));
  const full = leaguesInWindow.filter((l) => isFull(l.id));
  const drafted = full.filter((l) => isDrafted(l.id));
  const activeNow = drafted.filter((l) => (membersByLeague.get(l.id) ?? []).some((m) => visitedWithin(m, 7)));

  // --- Timing -----------------------------------------------------------------
  const lastPick = new Map<string, number>();
  for (const p of input.picks) {
    const t = new Date(p.pickedAt).getTime();
    if (!lastPick.has(p.leagueId) || t > lastPick.get(p.leagueId)!) lastPick.set(p.leagueId, t);
  }
  const toFull: number[] = [];
  const fullToDraft: number[] = [];
  for (const l of full) {
    const joined = (membersByLeague.get(l.id) ?? []).map((m) => new Date(m.joinedAt).getTime()).sort((a, b) => a - b);
    const filledAt = joined[l.maxTeams - 1];
    if (filledAt == null) continue;
    toFull.push(Math.max(0, filledAt - new Date(l.createdAt).getTime()) / DAY);
    const pickedAt = lastPick.get(l.id);
    if (pickedAt != null && pickedAt >= filledAt) fullToDraft.push((pickedAt - filledAt) / DAY);
  }

  const byWeek = new Map<string, { signups: number; neverJoined: number }>();
  for (const u of usersInWindow) {
    const week = weekStart(u.createdAt);
    const row = byWeek.get(week) ?? { signups: 0, neverJoined: 0 };
    row.signups++;
    if (!leaguesByUser.has(u.id)) row.neverJoined++;
    byWeek.set(week, row);
  }

  return {
    window: { since: options.since.toISOString().slice(0, 10), now: options.now.toISOString().slice(0, 10) },
    excluded: {
      testLeagues: testLeagueIds.size,
      testUsers: input.users.length - realUsers.length,
    },
    accounts: stages([
      { label: 'Signed up', count: usersInWindow.length },
      { label: 'Joined or created a league', count: inAnyLeague.length },
      { label: 'In a league that filled', count: inFull.length },
      { label: 'In a league that finished its draft', count: inDrafted.length },
      { label: 'Visited in the last 14 days', count: visitedRecently.length },
    ]),
    leagues: stages([
      { label: 'Created', count: leaguesInWindow.length },
      { label: 'A second member joined', count: twoPlus.length },
      { label: 'Filled', count: full.length },
      { label: 'Finished the draft', count: drafted.length },
      { label: 'Someone visited in the last 7 days', count: activeNow.length },
    ]),
    timing: {
      daysToFullMedian: median(toFull),
      daysFullToDraftMedian: median(fullToDraft),
      leaguesTimed: toFull.length,
    },
    neverJoined: usersInWindow.length - inAnyLeague.length,
    weekly: [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({ week, ...v })),
  };
}
