import React from 'react';
import { Polar } from '@polar-sh/sdk';
import { getPolarConfig } from './narev.js';

export interface CreditUsagePolarProps {
  /** Narev API key. Used to resolve meter ID and environment. */
  narevApiKey: string;
  /** Polar access token. Not needed if `client` is provided. */
  accessToken?: string;
  /** Pre-configured Polar SDK client. Takes precedence over `accessToken`. */
  client?: Polar;
  /** External customer ID (your app's user ID, passed as `userId` / `externalId` in billing tags). */
  userId: string;
  /** Optional budget cap — enables usage-billing mode with progress bar. */
  budget?: number;
  /** Card heading. Defaults to the meter's name. */
  label?: string;
  /** Unit display (e.g. "$" for dollars). Defaults to "units". */
  unit?: string;
  className?: string;
  style?: React.CSSProperties;
}

const cardBase: React.CSSProperties = {
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--card)',
  color: 'var(--card-foreground)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius, 0.75rem)',
  padding: '20px 24px',
};

const heading: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '13px',
  color: 'var(--muted-foreground)',
};

const valueRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
  margin: '0 0 14px',
};

const bigNumber: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: 'var(--foreground)',
  letterSpacing: '-0.5px',
};

const subLabel: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--muted-foreground)',
};

const barTrack: React.CSSProperties = {
  height: '6px',
  borderRadius: '3px',
  background: 'var(--muted)',
  overflow: 'hidden',
  marginBottom: '8px',
};

const barFill = (pct: number, color: string): React.CSSProperties => ({
  height: '100%',
  width: `${pct}%`,
  borderRadius: '3px',
  background: color,
  transition: 'width 0.3s ease',
});

const barLabels: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '12px',
  color: 'var(--muted-foreground)',
};

const footerText: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--muted-foreground)',
};

function barColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

function fmt(val: number, unit?: string): string {
  const s = val.toLocaleString(undefined, { maximumFractionDigits: 9 });
  if (unit === '$') return `$${s}`;
  if (unit) return `${s} ${unit}`;
  return s;
}

export async function CreditUsagePolar({
  narevApiKey,
  accessToken,
  client,
  userId,
  budget,
  label,
  unit,
  className,
  style,
}: CreditUsagePolarProps): Promise<React.ReactElement> {
  const config = await getPolarConfig(narevApiKey);
  const server = config?.environment ?? 'sandbox';
  const meterId = config?.meterId ?? '';

  if (!meterId) {
    return (
      <div className={className} style={{ ...cardBase, ...style }}>
        <p style={footerText}>No usage data available.</p>
      </div>
    );
  }

  const polar = client ?? new Polar({ accessToken, server });

  let consumedUnits = 0;
  let creditedUnits = 0;
  let balance = 0;
  let meterName = label ?? 'Usage';
  let found = false;

  try {
    const page = await polar.customerMeters.list({
      externalCustomerId: userId,
      meterId,
      limit: 1,
    });

    const item = page.result.items[0];
    if (item) {
      found = true;
      consumedUnits = item.consumedUnits;
      creditedUnits = item.creditedUnits;
      balance = item.balance;
      meterName = label ?? item.meter.name;
    }
  } catch (error) {
    const err = error as { status?: number; detail?: unknown };
    console.error(
      'CreditUsagePolar: Failed to fetch customer meter:',
      err.status !== undefined
        ? `HTTP ${err.status} - detail: ${JSON.stringify(err.detail)}`
        : String(error),
    );
  }

  const card: React.CSSProperties = { ...cardBase, ...style };

  if (!found) {
    return (
      <div className={className} style={card}>
        <p style={footerText}>No usage data found for this meter.</p>
      </div>
    );
  }

  const useBudget = budget !== undefined && budget > 0;
  const showBar = useBudget || creditedUnits > 0;
  const cap = showBar ? (useBudget ? budget! : creditedUnits) : 0;
  const pct = cap > 0 ? Math.min((consumedUnits / cap) * 100, 100) : 0;
  const remaining = cap - consumedUnits;
  const color = barColor(pct);

  return (
    <div className={className} style={card}>
      <p style={heading}>{meterName}</p>

      <div style={valueRow}>
        <span style={bigNumber}>{fmt(consumedUnits, unit)}</span>
        {showBar && (
          <span style={subLabel}>/ {fmt(cap, unit)}</span>
        )}
      </div>

      <div style={barTrack}>
        <div style={barFill(pct, showBar ? color : '#e5e7eb')} />
      </div>

      <div style={barLabels}>
        <span>
          {showBar
            ? `${pct.toFixed(0)}% ${useBudget ? 'used' : 'consumed'}`
            : '0 credits'}
        </span>
        <span>
          {showBar
            ? `${fmt(Math.max(0, remaining), unit)} remaining`
            : `${fmt(consumedUnits, unit)} consumed`}
        </span>
      </div>
    </div>
  );
}
