import { Suspense } from 'react';
import { UsageContent } from '@/components/usage/usage-content';
import { auth } from '@clerk/nextjs/server';

async function UsagePageContent() {
  const { userId } = await auth();
  return <UsageContent userId={userId ?? undefined} isAnonymous={false} />;
}

export default function UsagePage() {
  return (
    <Suspense>
      <UsagePageContent />
    </Suspense>
  );
}
