import React from 'react';
import Stripe from 'stripe';

export interface StripeUsageCardProps {
  /** Stripe secret key. Not needed if `client` is provided. */
  apiKey?: string;
  /** Pre-configured Stripe SDK client. Takes precedence over `apiKey`. */
  client?: Stripe;
  /** Stripe customer ID (cus_xxx). */
  customerId: string;
  /** Stripe billing meter ID. */
  meterId: string;
  /** Start of aggregation window. Defaults to the start of the current month (UTC). */
  startTime?: Date;
  /** End of aggregation window. Defaults to now. */
  endTime?: Date;
  /** Optional budget cap — enables the progress bar. */
  budget?: number;
  /** Card heading. Defaults to "Month YYYY usage". */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

function defaultStartOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export async function StripeUsageCard({
  apiKey,
  client,
  customerId,
  meterId,
  startTime,
  endTime,
  budget,
  label,
  className,
  style,
}: StripeUsageCardProps): Promise<React.ReactElement> {
  const stripe = client ?? new Stripe(apiKey!);

  const start = startTime ?? defaultStartOfMonth();
  const end = endTime ?? new Date();
  const cardLabel = label ?? `${monthLabel(start)} usage`;

  let aggregatedValue = 0;
  let found = false;

  try {
    const summaries = await stripe.billing.meters.listEventSummaries(meterId, {
      customer: customerId,
      start_time: Math.floor(start.getTime() / 1000),
      end_time: Math.floor(end.getTime() / 1000),
    });

    for (const s of summaries.data) {
      aggregatedValue += s.aggregated_value;
    }
    found = true;
  } catch {
    // render empty state on error
  }

  const pct = budget && budget > 0 ? Math.min((aggregatedValue / budget) * 100, 100) : 0;
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
      <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6b7280' }}>{cardLabel}</p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '0 0 14px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>
          {aggregatedValue.toLocaleString()}
        </span>
        {budget !== undefined && (
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>
            / {budget.toLocaleString()} units
          </span>
        )}
      </div>

      {budget !== undefined ? (
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
            <span style={{ color: '#6b7280' }}>{pct.toFixed(0)}% used</span>
            <span style={{ color: '#6b7280' }}>
              {(budget - aggregatedValue).toLocaleString()} remaining
            </span>
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>units consumed this period</p>
      )}
    </div>
  );
}
