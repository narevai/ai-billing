'use client';

import React, { useState, useEffect } from 'react';
import { UsageBar, cardBase, mutedText } from '@ai-billing/ui';
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
    return <UsageBar label="" value={0} loading className={className} style={style} ref={ref} {...props} />;
  }

  if (!data?.found) {
    return (
      <div ref={ref} className={className} style={{ ...cardBase, ...style }} {...props}>
        <p style={mutedText}>No usage data available.</p>
      </div>
    );
  }

  const meterName = label ?? data.meterName;
  const useBudget = budget !== undefined && budget > 0;
  const showBar = useBudget || data.creditedUnits > 0;
  const cap = showBar ? (useBudget ? budget! : data.creditedUnits) : undefined;

  return (
    <UsageBar
      label={meterName}
      value={data.consumedUnits}
      cap={cap}
      unit="$"
      className={className}
      style={style}
      ref={ref}
      {...props}
    />
  );
});
CreditUsagePolar.displayName = 'CreditUsagePolar';
