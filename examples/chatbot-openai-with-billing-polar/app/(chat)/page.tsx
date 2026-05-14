import { UsageContent } from '@/components/usage/usage-content';
import { auth } from '../(auth)/auth';

export default async function UsagePage() {
  const session = await auth();
  return <UsageContent userId={session?.user?.id} />;
}
