import React from 'react';
import { Polar } from '@polar-sh/sdk';

export interface PolarUsageCardProps {
  /** Polar access token. Not needed if `client` is provided. */
  accessToken?: string;
  /** Pre-configured Polar SDK client. Takes precedence over `accessToken`. */
  client?: Polar;
  /** Polar environment. Defaults to 'production'. */
  server?: 'sandbox' | 'production';
  /** External customer ID (your app's user ID, passed as `userId` / `externalId` in billing tags). */
  userId: string;
  /** Polar meter ID to display. */
  meterId: string;
  /** Card heading. Defaults to the meter's name. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export async function PolarUsageCard({
  accessToken,
  client,
  server = 'production',
  userId,
  meterId,
  label,
  className,
  style,
}: PolarUsageCardProps): Promise<React.ReactElement> {
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
  } catch {
    // render empty state on error
  }

  const pct = creditedUnits > 0 ? Math.min((consumedUnits / creditedUnits) * 100, 100) : 0;
  const fillColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';

  const card: React.CSSProperties = {
    fontFamily: 'inherit',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px 24px',
    maxWidth: '420px',
    ...style,
  };

  if (!found) {
    return (
      <div className={className} style={card}>
        <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
          No usage data found for this meter.
        </p>
      </div>
    );
  }

  return (
    <div className={className} style={card}>
      <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6b7280' }}>{meterName}</p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '0 0 14px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>
          {consumedUnits.toLocaleString()}
        </span>
        {creditedUnits > 0 && (
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>
            / {creditedUnits.toLocaleString()} units
          </span>
        )}
      </div>

      {creditedUnits > 0 && (
        <>
          <div
            style={{
              height: '6px',
              borderRadius: '3px',
              background: '#f3f4f6',
              overflow: 'hidden',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: '3px',
                background: fillColor,
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#6b7280' }}>{pct.toFixed(0)}% consumed</span>
            <span style={{ color: '#6b7280' }}>{balance.toLocaleString()} remaining</span>
          </div>
        </>
      )}
    </div>
  );
}
