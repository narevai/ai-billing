'use server';

import { generateText, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { auth } from '@clerk/nextjs/server';
import type { VisibilityType } from '@/components/chat/visibility-selector';
import { titlePrompt } from '@/lib/ai/prompts';
import {
  getChatById,
  getUserId,
  updateChatVisibilityById,
} from '@/lib/db/queries';
import { getTextFromMessage } from '@/lib/utils';

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
  });
  return text
    .replace(/^[#*"\s]+/, '')
    .replace(/["]+$/, '')
    .trim();
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const dbUserId = await getUserId();
  if (!dbUserId) {
    throw new Error('Unauthorized');
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== dbUserId) {
    throw new Error('Unauthorized');
  }

  await updateChatVisibilityById({ chatId, visibility });
}
