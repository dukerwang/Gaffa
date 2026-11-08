/**
 * Which walkthroughs this browser has finished, by chapter version.
 *
 * Browser storage on purpose: a walkthrough makes no requests, so a manager on
 * a second device sees each chapter once more. Every access is guarded because
 * storage throws in some private windows.
 */

const KEY = 'gaffa-walkthroughs';

interface SeenState {
  seen: Record<string, number>;
  off?: boolean;
}

function read(): SeenState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    return parsed && typeof parsed.seen === 'object' && parsed.seen ? parsed : { seen: {} };
  } catch {
    return { seen: {} };
  }
}

function write(state: SeenState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Without storage the chapter shows again next time, which is harmless.
  }
}

export function shouldAutoStart(chapter: { id: string; version: number }): boolean {
  const state = read();
  return !state.off && (state.seen[chapter.id] ?? 0) < chapter.version;
}

export function markSeen(chapter: { id: string; version: number }) {
  const state = read();
  state.seen[chapter.id] = chapter.version;
  write(state);
}

/** Skip All: no chapter starts on its own again. Help still opens them. */
export function turnOffAutoStart() {
  write({ ...read(), off: true });
}

/** Back to a fresh start: every chapter shows once more, even after Skip All. */
export function resetWalkthroughs() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored means nothing to reset.
  }
}
