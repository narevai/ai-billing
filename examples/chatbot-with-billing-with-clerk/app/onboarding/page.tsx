import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createPolarCustomer } from '@/lib/polar-client';

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-up');

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (email) {
    await createPolarCustomer(email, userId);
  }

  redirect('/');
}
