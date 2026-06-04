import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { generateUUID } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  redirect(`/chat/${generateUUID()}`);
}
