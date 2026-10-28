/** €12m, or €17.6m when the figure isn't whole (Match Revenue, compensation). */
export function money(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? `€${v}m` : `€${v.toFixed(1)}m`;
}

/** +€12m / −€12m, with a true minus sign. */
export function signed(n: number): string {
  if (n === 0) return money(0);
  return `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
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
