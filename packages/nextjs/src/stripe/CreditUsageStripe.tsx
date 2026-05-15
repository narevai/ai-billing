'use client';

import React, { useState, useEffect } from 'react';
import { UsageBar, cardBase, mutedText } from '@ai-billing/ui';
import { fetchStripeUsage } from './fetchStripeUsage.js';
import type { StripeUsageData } from './types.js';

export interface CreditUsageStripeProps extends React.HTMLAttributes<HTMLDivElement> {
  stripeCustomerId: string;
  budget?: number;
  label?: string;
  unit?: string;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const CreditUsageStripe = React.forwardRef<
  HTMLDivElement,
  CreditUsageStripeProps
>(
  (
    { stripeCustomerId, budget, label, unit = '$', className, style, ...props },
    ref,
  ) => {
    const [data, setData] = useState<StripeUsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const result = await fetchStripeUsage(stripeCustomerId);
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
    }, [stripeCustomerId]);

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

    const cardLabel = label ?? `${monthLabel(new Date())} usage`;
    const cap = budget !== undefined ? budget : undefined;

    return (
      <UsageBar
        label={cardLabel}
        value={data.aggregatedValue}
        cap={cap}
        unit={unit}
        className={className}
        style={style}
        ref={ref}
        {...props}
      />
    );
  },
);
CreditUsageStripe.displayName = 'CreditUsageStripe';
