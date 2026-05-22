import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { ChatShell } from '@/components/chat/shell';
import { generateUUID } from '@/lib/utils';

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return <ChatShell userId={session.user.id} chatId={generateUUID()} />;
}
