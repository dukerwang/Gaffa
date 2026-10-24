'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './parts';

/**
 * The pager behind a pair of cards you swipe between on a phone (Team Sheets,
 * Lineups). The scrolling itself is native scroll-snap in CSS; this only tracks
 * which of the two cards is showing, from how much of each is on screen, and
 * scrolls to one when its crest is tapped.
 */
export function useSwipePager() {
  const scroller = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const ratios = [0, 0];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = cards.current.indexOf(e.target as HTMLDivElement);
        if (i >= 0) ratios[i] = e.intersectionRatio;
      }
      setActive(ratios[1] > ratios[0] ? 1 : 0);
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    cards.current.forEach((c) => c && io.observe(c));
    return () => io.disconnect();
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
