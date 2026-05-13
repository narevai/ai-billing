'use client';

import React, { useState, useEffect } from 'react';
import {
  cardBase,
  heading,
  mutedText,
  bigNumber,
  subLabel,
  barTrack,
  barLabels,
} from '../styles.js';
import { barColor, fmt } from '../utils.js';
import { fetchPolarUsage } from './fetchPolarUsage.js';
import type { PolarUsageData } from './types.js';

export interface CreditUsagePolarProps extends React.HTMLAttributes<HTMLDivElement> {
  userId: string;
  budget?: number;
  label?: string;
}

export const CreditUsagePolar = React.forwardRef<
  HTMLDivElement,
  CreditUsagePolarProps
>(({ userId, budget, label, className, style, ...props }, ref) => {
  const cls = (className ?? '').trim();
  const [data, setData] = useState<PolarUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await fetchPolarUsage(userId);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...cardBase, height: 120, opacity: 0.5, ...style }}
        {...props}
      />
    );
  }

  if (!data?.found) {
    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...cardBase, ...style }}
        {...props}
      >
        <p style={mutedText}>No usage data available.</p>
      </div>
    );
  }

  const meterName = label ?? data.meterName;
  const useBudget = budget !== undefined && budget > 0;
  const showBar = useBudget || data.creditedUnits > 0;
  const cap = showBar ? (useBudget ? budget! : data.creditedUnits) : 0;
  const pct = cap > 0 ? Math.min((data.consumedUnits / cap) * 100, 100) : 0;
  const color = barColor(pct);

  return (
    <div ref={ref} className={cls} style={{ ...cardBase, ...style }} {...props}>
      <p style={heading}>{meterName}</p>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          margin: '0 0 14px',
        }}
      >
        <span style={bigNumber}>{fmt(data.consumedUnits, '$')}</span>
        {showBar && <span style={subLabel}>/ {fmt(cap, '$')}</span>}
      </div>
      <div style={barTrack}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 3,
            background: showBar ? color : '#e5e7eb',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={barLabels}>
        <span>
          {showBar
            ? `${pct.toFixed(0)}% ${useBudget ? 'used' : 'consumed'}`
            : '0 credits'}
        </span>
        <span>
          {showBar
            ? `${fmt(Math.max(0, cap - data.consumedUnits), '$')} remaining`
            : `${fmt(data.consumedUnits, '$')} consumed`}
        </span>
      </div>
    </div>
  );
});
CreditUsagePolar.displayName = 'CreditUsagePolar';
