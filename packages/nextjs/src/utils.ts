/**
 * Returns a color based on usage percentage.
 * green: below 70%, amber: 70%–89%, red: 90% and above
 * @param pct - usage percentage (0–100+)
 */
export function barColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

/**
 * Converts cents to a dollar string, rounding to the nearest dollar.
 * @param cents - amount in cents
 */
export function formatCents(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

/**
 * Formats a number with locale separators and an optional unit string.
 * @param val - the number to format
 * @param unit - optional unit string ('$' adds prefix, any other string adds suffix)
 */
export function fmt(val: number, unit?: string): string {
  const s = val.toLocaleString(undefined, { maximumFractionDigits: 9 });
  if (unit === '$') return `$${s}`;
  if (unit) return `${s} ${unit}`;
  return s;
}

export const taxMessages: Record<string, string> = {
  inclusive: 'Prices include tax',
  exclusive: 'Prices do not include tax. Tax will be added at checkout.',
  location: 'Tax calculated at checkout based on your location.',
};
