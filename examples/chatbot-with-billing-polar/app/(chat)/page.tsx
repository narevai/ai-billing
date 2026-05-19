import { UsageContent } from '@/components/usage/usage-content';
import { auth } from '../(auth)/auth';

export default async function UsagePage() {
  const session = await auth();
  const isAnonymous = session?.user?.type === 'guest';
  return <UsageContent userId={session?.user?.id} isAnonymous={isAnonymous} />;
}
