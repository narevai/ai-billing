'use client';

import React, { useState, useEffect } from 'react';
import { UsageBar, EmptyCard } from '@ai-billing/ui';
import { fetchStripeUsage } from './fetchStripeUsage.js';
import type { StripeUsageData } from './types.js';

type LookupProps =
  | { stripeCustomerId: string; userId?: never }
  | { userId: string; stripeCustomerId?: never };

export type CreditUsageStripeProps = React.HTMLAttributes<HTMLDivElement> &
  LookupProps & {
    budget?: number;
    label?: string;
    unit?: string;
  };

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const CreditUsageStripe = React.forwardRef(
  (
    {
      stripeCustomerId,
      userId,
      budget,
      label,
      unit = '$',
      className,
      style,
      ...props
    }: CreditUsageStripeProps,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) => {
    const [data, setData] = useState<StripeUsageData | null>(null);
    const [loading, setLoading] = useState(true);

    const lookup =
      stripeCustomerId != null ? { stripeCustomerId } : { userId: userId! };

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const result = await fetchStripeUsage(lookup);
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
    }, [stripeCustomerId, userId]);

    if (loading) {
      return (
        <UsageBar
          label=""
          value={0}
          loading
          className={className}
          style={style}
          ref={ref}
          {...props}
        />
      );
    }

    if (!data?.found) {
      return (
        <EmptyCard
          message="No usage data available."
          className={className}
          style={style}
          ref={ref}
          {...props}
        />
      );
    }

    const cardLabel = label ?? `${monthLabel(new Date())} usage`;

    return (
      <UsageBar
        label={cardLabel}
        value={data.aggregatedValue}
        cap={budget}
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
