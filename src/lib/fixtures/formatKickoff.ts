/**
 * src/lib/fixtures/formatKickoff.ts
 *
 * Formats a fixture kickoff timestamp into the reader's local browser timezone.
 */

export function formatLocalKickoff(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString(undefined, { weekday: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}`;
}
