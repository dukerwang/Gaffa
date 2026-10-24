'use client';

import { useEffect, useState } from 'react';

export type PresenceState = 'open' | 'closed';

/**
 * Keeps an overlay mounted long enough to play its exit.
 *
 * `mounted` turns true as soon as `open` does and stays true for `exitMs` after
 * it turns false. `state` starts at 'closed' on the first painted frame and
 * flips to 'open' on the next one, so a plain CSS transition keyed on
 * `[data-state]` animates the entrance. Transitions rather than keyframes,
 * because an overlay opened and closed in quick succession has to reverse from
 * wherever it is, not restart from zero.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<PresenceState>('closed');

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames: one to commit the 'closed' styles, one to transition away.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setState('open'));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setState('closed');
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted, state };
}
