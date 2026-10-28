import { formatMoney } from '@/lib/text/money';

export const money = formatMoney;

/**
 * Dates read in UK time, Gaffa's matchday clock. A fixed zone also keeps the
 * server render and the browser agreeing on which day and month a movement
 * landed in; the viewer's own zone would split a late-evening signing across
 * a month boundary and fail hydration.
 */
const ZONE = 'Europe/London';

/** +€12m / −€12m, with a true minus sign. */
export function signed(n: number): string {
  if (n === 0) return money(0);
  return `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: ZONE });
}

export function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: ZONE });
}

export function dayOfMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', timeZone: ZONE });
}

export function monthShort(iso: string | number): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', timeZone: ZONE });
}

export function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/** A bid clock: 2d 4h · 3h 12m · 12m 05s · Settling once it passes zero. */
export function clock(expiresAt: string | null, now: number): string {
  if (!expiresAt) return 'No clock';
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'Settling';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}
