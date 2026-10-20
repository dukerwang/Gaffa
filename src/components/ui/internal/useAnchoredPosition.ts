'use client';

import { useCallback, useLayoutEffect, useState } from 'react';

export type Placement = 'bottom-start' | 'bottom' | 'bottom-end' | 'top-start' | 'top' | 'top-end';

interface Position {
  top: number;
  left: number;
  side: 'top' | 'bottom';
  /** Where the trigger sits relative to the floating box, for transform-origin. */
  origin: string;
  /** The trigger's width, for a listbox that should be at least as wide. */
  anchorWidth: number;
}

const GUTTER = 8;

/**
 * Places a fixed-position element against its trigger and keeps it there.
 *
 * Flips to the other side when the preferred one lacks room, clamps to the
 * viewport with an 8px gutter, and reports the trigger's position as a
 * transform-origin so the element grows out of the thing that opened it
 * rather than out of its own centre.
 */
export function useAnchoredPosition(
  anchor: HTMLElement | null,
  floating: HTMLElement | null,
  open: boolean,
  placement: Placement = 'bottom-start',
  offset = 6,
) {
  const [position, setPosition] = useState<Position | null>(null);

  const update = useCallback(() => {
    if (!anchor || !floating) return;
    const a = anchor.getBoundingClientRect();
    // offsetWidth/Height ignore the entrance scale, so the box measures true.
    const fw = floating.offsetWidth;
    const fh = floating.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const [preferred, align = 'center'] = placement.split('-') as ['top' | 'bottom', string?];
    const roomBelow = vh - a.bottom - offset - GUTTER;
    const roomAbove = a.top - offset - GUTTER;
    let side = preferred;
    if (side === 'bottom' && fh > roomBelow && roomAbove > roomBelow) side = 'top';
    if (side === 'top' && fh > roomAbove && roomBelow > roomAbove) side = 'bottom';

    const top = side === 'bottom' ? a.bottom + offset : a.top - offset - fh;

    let left =
      align === 'start' ? a.left : align === 'end' ? a.right - fw : a.left + a.width / 2 - fw / 2;
    left = Math.min(Math.max(left, GUTTER), Math.max(GUTTER, vw - fw - GUTTER));

    const originX = Math.min(Math.max(a.left + a.width / 2 - left, 0), fw);
    setPosition({
      top: Math.round(top),
      left: Math.round(left),
      side,
      origin: `${Math.round(originX)}px ${side === 'bottom' ? '0px' : `${fh}px`}`,
      anchorWidth: a.width,
    });
  }, [anchor, floating, placement, offset]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener('resize', schedule);
    // Capture, so scrolling any ancestor (a modal body, a table) repositions too.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (floating) observer?.observe(floating);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true });
      observer?.disconnect();
    };
  }, [open, update, floating]);

  return position;
}
