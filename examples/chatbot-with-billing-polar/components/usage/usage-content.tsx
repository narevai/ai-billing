'use client';

import { CreditUsagePolar, CreditTopUpPolar } from '@ai-billing/nextjs';

export function UsageContent({ userId }: { userId?: string }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-8 pb-12 md:px-6 md:pt-12">
      <div>
        <h1 className="text-2xl font-bold">Usage & Billing</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Track your usage and top up your credits.
        </p>
      </div>
      {userId ? (
        <>
          <CreditUsagePolar userId={userId} />
          <CreditTopUpPolar userId={userId} />
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to view your usage and billing information.
          </p>
        </div>
      )}
    </div>
  );
}
