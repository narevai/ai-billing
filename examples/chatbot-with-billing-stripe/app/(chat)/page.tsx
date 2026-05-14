import { UsageContent } from '@/components/usage/usage-content';
import { auth } from '../(auth)/auth';
import { findStripeCustomerIdByUserId } from '@/lib/stripe-client';

export default async function UsagePage() {
  const session = await auth();
  const userId = session?.user?.id;
  const stripeCustomerId = userId
    ? await findStripeCustomerIdByUserId(userId)
    : null;

  return <UsageContent userId={userId} stripeCustomerId={stripeCustomerId} />;
}
