'use client';

import { useIsClient } from '@/lib/fixtures/formatKickoff';

/**
 * A kickoff or deadline in the reader's own timezone. Renders nothing on the
 * server, so UTC never gets baked into the first paint (see a7e7f6e7).
 */
export default function LocalTime({
  iso,
  endIso,
  variant,
  prefix = '',
  className,
}: {
  iso: string | null;
  endIso?: string | null;
  variant: 'time' | 'dayTime' | 'range';
  prefix?: string;
  className?: string;
}) {
  const isClient = useIsClient();
  if (!isClient || !iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  let text: string;
  if (variant === 'time') {
    text = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } else if (variant === 'dayTime') {
    const day = d.toLocaleDateString(undefined, { weekday: 'short' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    text = `${day} ${time}`;
  } else {
    const end = endIso ? new Date(endIso) : d;
    // Weekday and day number are joined by hand: some locales put the number
    // first ("12 Sat") when the two are formatted together.
    const dayLabel = (x: Date) =>
      `${x.toLocaleDateString(undefined, { weekday: 'short' })} ${x.getDate()}`;
    const startDay = dayLabel(d);
    const endDay = dayLabel(end);
    const month = end.toLocaleDateString(undefined, { month: 'long' });
    text = startDay === endDay ? `${startDay} ${month}` : `${startDay} – ${endDay} ${month}`;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {prefix}
      {text.replace(/ /g, ' ')}
    </span>
  );
}
