'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './parts';

/**
 * The pager behind cards you swipe between on a phone (Team Sheets and Lineups
 * have two; the Cups draw has one per round). The scrolling itself is native
 * scroll-snap in CSS; this only tracks which card is showing, from how much of
 * each is on screen, and scrolls to one when its tab or crest is tapped.
 * `initial` opens on a card other than the first, without animating.
 */
export function useSwipePager(initial = 0) {
  const scroller = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(initial);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const start = cards.current[initial];
    if (initial > 0 && start) {
      const pad = parseFloat(getComputedStyle(root).scrollPaddingInlineStart || '0') || 0;
      root.scrollLeft = start.offsetLeft - pad;
    }
    const ratios = cards.current.map(() => 0);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = cards.current.indexOf(e.target as HTMLDivElement);
        if (i >= 0) ratios[i] = e.intersectionRatio;
      }
      // The most visible card; on a tie the earlier one, as with two cards.
      let best = 0;
      for (let i = 1; i < ratios.length; i++) if (ratios[i] > ratios[best]) best = i;
      setActive(best);
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    cards.current.forEach((c) => c && io.observe(c));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `initial` is a mount-time position only
  }, []);

  const go = (i: number) => {
    const root = scroller.current, card = cards.current[i];
    if (!root || !card) return;
    const pad = parseFloat(getComputedStyle(root).scrollPaddingInlineStart || '0') || 0;
    root.scrollTo({ left: card.offsetLeft - pad, behavior: reduced ? 'auto' : 'smooth' });
    setActive(i);
  };

  return { scroller, cards, active, go };
}
