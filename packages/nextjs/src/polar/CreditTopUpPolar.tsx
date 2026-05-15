'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { CreditPackagePicker, cardBase, mutedText } from '@ai-billing/ui';
import type { CreditPackage } from '@ai-billing/ui';
import { createCheckout as checkoutAction } from './createCheckout.js';
import { fetchTopUpConfig } from './fetchTopUpConfig.js';

export interface CreditTopUpPolarProps extends React.HTMLAttributes<HTMLDivElement> {
  userId: string;
  title?: string;
}

export const CreditTopUpPolar = React.forwardRef<
  HTMLDivElement,
  CreditTopUpPolarProps
>(
  (
    {
      userId,
      title = 'Choose a credit bundle to top up your workspace balance.',
      className,
      style,
      ...props
    },
    ref,
  ) => {
    if (!userId) {
      return (
        <div
          ref={ref}
          className={className}
          style={{ ...cardBase, ...style }}
          {...props}
        >
          <p style={mutedText}>No top-up packages available.</p>
        </div>
      );
    }

    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [taxBehavior, setTaxBehavior] = useState<
      'inclusive' | 'exclusive' | 'location'
    >();
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (!userId) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const config = await fetchTopUpConfig();
          if (cancelled) return;
          setPackages(config.packages);
          if (config.taxBehavior) setTaxBehavior(config.taxBehavior);
        } catch {
          /* no data */
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    function handlePurchase(packageId: string) {
      setError(null);
      startTransition(async () => {
        try {
          const url = await checkoutAction(
            packageId,
            userId,
            window.location.origin,
          );
          window.location.href = url;
        } catch (e) {
          setError(String(e));
        }
      });
    }

    return (
      <CreditPackagePicker
        title={title}
        packages={packages}
        taxBehavior={taxBehavior}
        onPurchase={handlePurchase}
        isPending={isPending}
        error={error}
        loading={loading}
        className={className}
        style={style}
        ref={ref}
        {...props}
      />
    );
  },
);
CreditTopUpPolar.displayName = 'CreditTopUpPolar';
