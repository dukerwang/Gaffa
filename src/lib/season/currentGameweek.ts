/**
 * Latest kicked-off FPL gameweek (deadline passed). 0 if unavailable.
 *
 * Deliberately NOT `getFplStatus().currentGw` from `@/lib/fpl/api`: that one
 * floors at 1 and reports 1 during the offseason, which is right for "which
 * gameweek are we playing" but wrong here. Callers use this to bound a
 * `player_stats` form window — a 1 where the truth is "no gameweek has kicked
 * off yet" makes preseason read as a GW1 in which everyone scored zero.
 *
 * Lifted verbatim out of the club page when the club view became shared
 * between your own squad and a rival's.
 */
export async function resolveCurrentGw(): Promise<number> {
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: { 'User-Agent': 'FantasyFutbol/1.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const now = new Date();
    let gw = 0;
    for (const ev of data.events as any[]) {
      if (ev.deadline_time && new Date(ev.deadline_time) <= now) gw = Math.max(gw, ev.id);
    }
    return gw;
  } catch {
    return 0;
  }
}

/**
 * The gameweek currently being PLAYED OR PICKED — the round a manager is
 * setting a lineup for, which is what a projection is about.
 *
 * `resolveCurrentGw()` above answers a different question: the latest round
 * whose deadline has passed. Between rounds those diverge, and that gap is
 * most of the week — on 2026-09-09, GW3's last match was three days earlier
 * and GW4 had not kicked off, so `resolveCurrentGw()` said 3 while every
 * lineup on the site was being set for 4. A projections run defaulting to the
 * former stamps a round nothing on screen asks for, and the freshness check in
 * `currentProjection()` then correctly discards all of it.
 *
 * The rule is the first unfinished event, which tracks the app's own lineup
 * edit target: during a live round it stays on that round, and it moves on
 * once FPL marks it finished.
 */
export function pickUpcomingGw(
  events: Array<{ id: number; finished?: boolean }>,
): number {
  const unfinished = events
    .filter((e) => !e.finished)
    .map((e) => e.id)
    .sort((a, b) => a - b);
  return unfinished[0] ?? 0;
}

export async function resolveUpcomingGw(): Promise<number> {
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: { 'User-Agent': 'FantasyFutbol/1.0' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return pickUpcomingGw((data.events ?? []) as Array<{ id: number; finished?: boolean }>);
  } catch {
    return 0;
  }
}
