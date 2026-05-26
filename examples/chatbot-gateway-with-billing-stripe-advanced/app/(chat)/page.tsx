import { UsageContent } from '@/components/usage/usage-content';
import { auth } from '../(auth)/auth';

export default async function UsagePage() {
  const session = await auth();
  const isAnonymous = session?.user?.type === 'guest';
  const userId = isAnonymous ? 'anonymous_user' : session?.user?.id;

  return <UsageContent userId={userId} />;
}
