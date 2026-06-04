import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  deleteAllChatsByUserId,
  getChatsByUserId,
  getUserId,
} from '@/lib/db/queries';
import { ChatbotError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get('limit') || '10', 10), 1),
    50,
  );
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return new ChatbotError(
      'bad_request:api',
      'Only one of starting_after or ending_before can be provided.',
    ).toResponse();
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatbotError('unauthorized:chat').toResponse();
  }

  const dbUserId = await getUserId();
  if (!dbUserId) {
    return new ChatbotError('unauthorized:chat').toResponse();
  }

  const chats = await getChatsByUserId({
    id: dbUserId,
    limit,
    startingAfter,
    endingBefore,
  });

  return Response.json(chats);
}

export async function DELETE() {
  const dbUserId = await getUserId();

  if (!dbUserId) {
    return new ChatbotError('unauthorized:chat').toResponse();
  }

  const result = await deleteAllChatsByUserId({ userId: dbUserId });

  return Response.json(result, { status: 200 });
}
