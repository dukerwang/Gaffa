/**
 * src/lib/fixtures/formatKickoff.ts
 *
 * Formats a fixture kickoff timestamp into the reader's local browser timezone.
 */

import { useSyncExternalStore } from 'react';

export function formatLocalKickoff(
  iso: string | null | undefined,
  timeZone?: string
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { weekday: 'short' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (timeZone) {
    options.timeZone = timeZone;
    timeOptions.timeZone = timeZone;
  }
  const day = d.toLocaleDateString(undefined, options);
  const time = d.toLocaleTimeString(undefined, timeOptions).replace(/\u202f/g, ' ');
  return `${day} ${time}`;
}

const emptySubscribe = () => () => {};

/**
 * Returns true only after mounting on the client, preventing SSR timezone hydration mismatches.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Hook to get the kickoff time formatted in the reader's local timezone.
 * Returns empty string on server render to prevent baking UTC into the initial HTML.
 */
export function useLocalKickoff(
  iso: string | null | undefined,
  timeZone?: string
): string {
  const isClient = useIsClient();
  if (!isClient || !iso) return '';
  return formatLocalKickoff(iso, timeZone);
}
