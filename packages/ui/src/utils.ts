/** Returns a CSS color string based on usage percentage. */
export function barColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

/** Formats a price in cents as a dollar string, e.g. 500 → "$5". */
export function formatCents(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

/** Formats a numeric value with an optional unit prefix or suffix. */
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
