'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface Indicator {
  x: number;
  width: number;
  /** The container's own width, for clipping a layer to the active item. */
  containerWidth: number;
  /** False until the first measurement lands, so the indicator never slides in from 0. */
  ready: boolean;
}

/**
 * Measures the active item inside a container so one shared indicator (a
 * segmented thumb, a tab underline) can travel between items instead of each
 * item fading its own background in and out.
 *
 * Items mark themselves with `data-indicator-key`. The first measurement is
 * applied without a transition; every later one animates.
 */
export function useSlidingIndicator<T extends HTMLElement>(activeKey: string) {
  const containerRef = useRef<T>(null);
  const [indicator, setIndicator] = useState<Indicator>({ x: 0, width: 0, containerWidth: 0, ready: false });
  const measuredOnce = useRef(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const item = container.querySelector<HTMLElement>(
      `[data-indicator-key="${CSS.escape(activeKey)}"]`,
    );
    if (!item) return;
    setIndicator({
      x: item.offsetLeft,
      width: item.offsetWidth,
      containerWidth: container.clientWidth,
      ready: measuredOnce.current,
    });
    if (!measuredOnce.current) {
      measuredOnce.current = true;
      // Enable the transition after the unanimated first placement has painted.
      requestAnimationFrame(() => setIndicator((prev) => ({ ...prev, ready: true })));
    }
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    // Fonts swapping in or a container resizing moves every item.
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, indicator };
}
