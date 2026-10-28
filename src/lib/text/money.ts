/** €12m, or €17.6m when the figure isn't whole (Match Revenue, compensation, bid steps). */
export function formatMoney(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? `€${v}m` : `€${v.toFixed(1)}m`;
}
