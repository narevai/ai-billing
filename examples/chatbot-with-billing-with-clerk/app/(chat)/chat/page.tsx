import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { generateUUID } from '@/lib/utils';

async function ChatRedirect() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  redirect(`/chat/${generateUUID()}`);
  return null;
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatRedirect />
    </Suspense>
  );
}
