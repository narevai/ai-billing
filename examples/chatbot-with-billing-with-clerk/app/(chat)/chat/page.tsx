import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { generateUUID } from '@/lib/utils';

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  redirect(`/chat/${generateUUID()}`);
}
