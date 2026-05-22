import { notFound, redirect } from 'next/navigation';
import type { UIMessage } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { ChatShell } from '@/components/chat/shell';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const chat = await getChatById({ id });
  if (!chat) notFound();
  if (chat.userId !== session.user.id) redirect('/');

  const dbMessages = await getMessagesByChatId({ id });
  const messages = convertToUIMessages(dbMessages) as UIMessage[];

  return (
    <ChatShell
      userId={session.user.id}
      chatId={id}
      initialMessages={messages}
    />
  );
}
