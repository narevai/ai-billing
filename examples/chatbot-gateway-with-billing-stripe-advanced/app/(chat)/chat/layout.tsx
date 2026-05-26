import { Suspense } from 'react';
import { BillingCostProvider } from '@/components/chat/billing-cost-provider';
import { DataStreamProvider } from '@/components/chat/data-stream-provider';
import { ActiveChatProvider } from '@/hooks/use-active-chat';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataStreamProvider>
      <Suspense fallback={<div className="flex h-dvh" />}>
        <ActiveChatProvider>
          <BillingCostProvider>{children}</BillingCostProvider>
        </ActiveChatProvider>
      </Suspense>
    </DataStreamProvider>
  );
}
