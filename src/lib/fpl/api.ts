import { getBootstrapSlim } from '@/lib/fpl/bootstrapSlim';

export interface FplStatus {
  currentGw: number;
  isFinished: boolean;
  /** Whether the current gameweek has kicked off and is actively in progress (not finished). */
  isLive: boolean;
  nextGwIsClose: boolean;
  nextDeadline: string | null;
  /** The gameweek `nextDeadline` belongs to — not always `currentGw` + 1 (blank/double weeks). Null when there's no upcoming deadline. */
  nextGw: number | null;
  /** The gameweek to feature in dashboard/strips: currentGw when isLive, otherwise nextGw ?? currentGw. */
  displayGw: number;
}

/**
 * Fetches the current FPL gameweek and its finished status, from the slim
 * bootstrap cache (refreshed every 5 minutes).
 */
export async function getFplStatus(): Promise<FplStatus> {
  try {
    const { events } = await getBootstrapSlim();

    // If the last event in the list is finished, the entire season is complete (offseason)
    const lastEvent = events[events.length - 1];
    if (lastEvent?.finished) {
      return { currentGw: 1, isFinished: false, isLive: false, nextGwIsClose: false, nextDeadline: null, nextGw: null, displayGw: 1 };
    }

    const now = new Date();
    let currentGw = 1;
    let hasKickedOff = false;

    // Find latest gameweek that has passed the deadline
    for (const ev of events) {
      if (ev.deadline_time && new Date(ev.deadline_time) <= now) {
        currentGw = Math.max(currentGw, ev.id);
        hasKickedOff = true;
      }
    }

    const currentEvent = events.find((e) => e.id === currentGw);
    const isFinished = currentEvent?.finished ?? false;
    const isLive = hasKickedOff && !isFinished;

    let nextGwIsClose = false;
    const nextGW = events.find((e) => !e.finished && e.is_next);
    if (nextGW) {
      const daysUntil = (new Date(nextGW.deadline_time).getTime() - Date.now()) / 86400000;
      if (daysUntil <= 3) nextGwIsClose = true;
    }

    const nextGw = nextGW?.id ?? null;
    const displayGw = isLive ? currentGw : (nextGw ?? currentGw);

    return {
      currentGw,
      isFinished,
      isLive,
      nextGwIsClose,
      nextDeadline: nextGW?.deadline_time ?? null,
      nextGw,
      displayGw,
    };
  } catch (error) {
    console.error('Error fetching FPL status:', error);
    return { currentGw: 1, isFinished: false, isLive: false, nextGwIsClose: false, nextDeadline: null, nextGw: null, displayGw: 1 };
  }
}
