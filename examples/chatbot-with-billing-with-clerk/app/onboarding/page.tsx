import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createPolarCustomer } from '@/lib/polar-client';

async function OnboardingContent() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-up');

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (email) {
    await createPolarCustomer(email, userId);
  }

  redirect('/');
  return null;
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}
