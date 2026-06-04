import { UsageContent } from '@/components/usage/usage-content';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const { userId } = await auth();
  return <UsageContent userId={userId ?? undefined} isAnonymous={false} />;
}
