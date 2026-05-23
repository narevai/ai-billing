import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { generateUUID } from '@/lib/utils';

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  redirect(`/chat/${generateUUID()}`);
}
