'use client';

import { CreditUsageStripe } from '@ai-billing/nextjs';

export function UsageContent({
  userId,
  stripeCustomerId,
}: {
  userId?: string;
  stripeCustomerId?: string | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-8 pb-12 md:px-6 md:pt-12">
      <div>
        <h1 className="text-2xl font-bold">Usage & Billing</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Track your usage.
        </p>
      </div>
      {stripeCustomerId ? (
        <CreditUsageStripe stripeCustomerId={stripeCustomerId} budget={10} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {userId
              ? 'No usage data available. Set up your Stripe billing to get started.'
              : 'Sign in to view your usage and billing information.'}
          </p>
        </div>
      )}
    </div>
  );
}
