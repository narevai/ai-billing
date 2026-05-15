export function barColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

export function formatCents(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

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
