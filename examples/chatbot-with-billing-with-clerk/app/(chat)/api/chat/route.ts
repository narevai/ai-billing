import { auth } from '@clerk/nextjs/server';
import { deleteChatById, getChatById, getUserId } from '@/lib/db/queries';
import { ChatbotError } from '@/lib/errors';

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatbotError('bad_request:api').toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatbotError('unauthorized:chat').toResponse();
  }

  const dbUserId = await getUserId();
  if (!dbUserId) {
    return new ChatbotError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== dbUserId) {
    return new ChatbotError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
