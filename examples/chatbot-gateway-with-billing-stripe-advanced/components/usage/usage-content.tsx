'use client';

import { PanelLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { VercelIcon } from '@/components/chat/icons';
import { CreditUsageStripe } from '@ai-billing/nextjs';

export function UsageContent({ userId }: { userId?: string }) {
  const { state, toggleSidebar, isMobile } = useSidebar();

  return (
    <>
      {(state !== 'collapsed' || isMobile) && (
        <header className="sticky top-0 flex h-14 items-center gap-2 bg-sidebar px-3">
          <Button
            className="md:hidden"
            onClick={toggleSidebar}
            size="icon-sm"
            variant="ghost"
          >
            <PanelLeftIcon className="size-4" />
          </Button>

          <Link
            className="flex size-8 items-center justify-center rounded-lg md:hidden"
            href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-with-billing-stripe&env=AUTH_SECRET,AI_GATEWAY_API_KEY,POSTGRES_URL,STRIPE_SECRET_KEY"
            rel="noopener noreferrer"
            target="_blank"
          >
            <VercelIcon size={14} />
          </Link>

          <Button
            asChild
            className="hidden rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90 md:ml-auto md:flex"
          >
            <Link
              href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-with-billing-stripe&env=AUTH_SECRET,AI_GATEWAY_API_KEY,POSTGRES_URL,STRIPE_SECRET_KEY"
              rel="noopener noreferrer"
              target="_blank"
            >
              <VercelIcon size={16} />
              Deploy with Vercel
            </Link>
          </Button>
        </header>
      )}
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-8 pb-12 md:px-6 md:pt-12">
        <div>
          <h1 className="text-2xl font-bold">Usage & Billing</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Track your usage.
          </p>
        </div>
        {userId ? (
          <CreditUsageStripe userId={userId} budget={10} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Sign in to view your usage and billing information.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
