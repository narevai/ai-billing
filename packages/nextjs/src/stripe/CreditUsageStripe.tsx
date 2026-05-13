'use client';

import React, { useState, useEffect } from 'react';
import { cardBase, heading, mutedText, bigNumber, subLabel, barTrack, barLabels, barColor, fmt } from '../primitives.js';
import { fetchStripeUsage } from './fetchStripeUsage.js';
import type { StripeUsageData } from './types.js';

export interface CreditUsageStripeProps {
  customerId: string;
  budget?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function CreditUsageStripe({
  customerId, budget, label, className, style,
}: CreditUsageStripeProps) {
  const cn = (className ?? '').trim();
  const [data, setData] = useState<StripeUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await fetchStripeUsage(customerId);
        if (!cancelled) setData(result);
      } catch { if (!cancelled) setData(null); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return <div className={cn} style={{ ...cardBase, height: 120, opacity: 0.5, ...style }} />;
  }

  if (!data?.found) {
    return (
      <div className={cn} style={{ ...cardBase, ...style }}>
        <p style={mutedText}>No usage data available.</p>
      </div>
    );
  }

  const cardLabel = label ?? `${monthLabel(new Date())} usage`;
  const showBar = budget !== undefined;
  const pct = budget && budget > 0 ? Math.min((data.aggregatedValue / budget) * 100, 100) : 0;
  const color = barColor(pct);

  return (
    <div className={cn} style={{ ...cardBase, ...style }}>
      <p style={heading}>{cardLabel}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 0 14px' }}>
        <span style={bigNumber}>{fmt(data.aggregatedValue)}</span>
        {showBar && <span style={subLabel}>/ {fmt(budget!)}</span>}
      </div>
      {showBar && (
        <>
          <div style={barTrack}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: color, transition: 'width 0.3s ease' }} />
          </div>
          <div style={barLabels}>
            <span>{pct.toFixed(0)}% used</span>
            <span>{fmt(Math.max(0, budget! - data.aggregatedValue))} remaining</span>
          </div>
        </>
      )}
    </div>
  );
}
