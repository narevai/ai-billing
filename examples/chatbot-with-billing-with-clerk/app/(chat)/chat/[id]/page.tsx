import { redirect } from 'next/navigation';
import type { UIMessage } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { ChatShell } from '@/components/chat/shell';
import { getChatById, getMessagesByChatId, getUserId } from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const dbUserId = await getUserId();
  if (!dbUserId) redirect('/sign-in');

  const chat = await getChatById({ id });
  if (chat && chat.userId !== dbUserId) redirect('/');

  const dbMessages = chat ? await getMessagesByChatId({ id }) : [];
  const messages = convertToUIMessages(dbMessages) as UIMessage[];

  return <ChatShell userId={dbUserId} chatId={id} initialMessages={messages} />;
}
