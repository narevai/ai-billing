import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { generateUUID } from '@/lib/utils';

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect(`/api/auth/guest?redirectUrl=/chat`);
  redirect(`/chat/${generateUUID()}`);
}
