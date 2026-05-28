'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { CreditPackagePicker, EmptyCard } from '@ai-billing/ui';
import type { CreditPackage } from '@ai-billing/types';
import { createCheckout as checkoutAction } from './createCheckout.js';
import { fetchTopUpConfig } from './fetchTopUpConfig.js';

/** Props for the credit top-up component. */
export interface CreditTopUpPolarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** End-user ID for the top-up session. */
  userId: string;
  /** Optional title text for the picker. */
  title?: string;
  /** URL to redirect after successful purchase (defaults to current origin). */
  successUrl?: string;
  /** Show the Auto Top-up toggle. Defaults to false; will be driven by fetchTopUpConfig in the future. */
  showAutoTopUp?: boolean;
  /** Called when the Auto Top-up toggle is switched. */
  onAutoTopUpChange?: (enabled: boolean) => void;
}

export const CreditTopUpPolar = React.forwardRef<
  HTMLDivElement,
  CreditTopUpPolarProps
>(
  (
    {
      userId,
      title,
      successUrl,
      showAutoTopUp = false,
      onAutoTopUpChange,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [taxBehavior, setTaxBehavior] = useState<
      'inclusive' | 'exclusive' | 'location'
    >();
    const [loading, setLoading] = useState(!!userId);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (!userId) return;
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
    }, [userId]);

    function handlePurchase(packageId: string) {
      setError(null);
      startTransition(async () => {
        try {
          const url = await checkoutAction(
            packageId,
            userId,
            successUrl ?? `${window.location.origin}/`,
          );
          window.location.href = url;
        } catch (e) {
          setError(String(e));
        }
      });
    }

    if (!userId) {
      return (
        <EmptyCard
          message="No top-up packages available."
          className={className}
          style={style}
          ref={ref}
          {...props}
        />
      );
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
        showAutoTopUp={showAutoTopUp}
        onAutoTopUpChange={onAutoTopUpChange}
        className={className}
        style={style}
        ref={ref}
        {...props}
      />
    );
  },
);
CreditTopUpPolar.displayName = 'CreditTopUpPolar';
