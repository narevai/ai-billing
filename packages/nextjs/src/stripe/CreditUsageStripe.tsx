'use client';

import React, { useState, useEffect } from 'react';
import { cardBase, heading, mutedText, bigNumber, subLabel, barTrack, barLabels, barColor, fmt } from '../primitives.js';
import { fetchStripeUsage } from './fetchStripeUsage.js';
import type { StripeUsageData } from './types.js';

export interface CreditUsageStripeProps extends React.HTMLAttributes<HTMLDivElement> {
  stripeCustomerId: string;
  budget?: number;
  label?: string;
  unit?: string;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export const CreditUsageStripe = React.forwardRef<HTMLDivElement, CreditUsageStripeProps>(
  ({ stripeCustomerId, budget, label, unit = '$', className, style, ...props }, ref) => {
    const cls = (className ?? '').trim();
    const [data, setData] = useState<StripeUsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const result = await fetchStripeUsage(stripeCustomerId);
          if (!cancelled) setData(result);
        } catch { if (!cancelled) setData(null); }
        finally { if (!cancelled) setLoading(false); }
      })();
      return () => { cancelled = true; };
    }, [stripeCustomerId]);

    if (loading) {
      return <div ref={ref} className={cls} style={{ ...cardBase, height: 120, opacity: 0.5, ...style }} {...props} />;
    }

    if (!data?.found) {
      return (
        <div ref={ref} className={cls} style={{ ...cardBase, ...style }} {...props}>
          <p style={mutedText}>No usage data available.</p>
        </div>
      );
    }

    const cardLabel = label ?? `${monthLabel(new Date())} usage`;
    const showBar = budget !== undefined;
    const pct = budget && budget > 0 ? (data.aggregatedValue / budget) * 100 : 0;
    const barPct = Math.min(pct, 100);
    const color = barColor(barPct);
    const remaining = budget! - data.aggregatedValue;
    const over = remaining < 0;

    return (
      <div ref={ref} className={cls} style={{ ...cardBase, ...style }} {...props}>
        <p style={heading}>{cardLabel}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 0 14px' }}>
          <span style={bigNumber}>{fmt(data.aggregatedValue, unit)}</span>
          {showBar && <span style={subLabel}>/ {fmt(budget!, unit)}</span>}
        </div>
        {showBar && (
          <>
            <div style={barTrack}>
              <div style={{ height: '100%', width: `${barPct}%`, borderRadius: 3, background: color, transition: 'width 0.3s ease' }} />
            </div>
            <div style={barLabels}>
              <span>{pct.toFixed(0)}% used{over ? ' (over)' : ''}</span>
              <span>{over ? `${fmt(Math.abs(remaining), unit)} over` : `${fmt(remaining, unit)} remaining`}</span>
            </div>
          </>
        )}
      </div>
    );
  },
);
CreditUsageStripe.displayName = 'CreditUsageStripe';
