'use server';

import {
  saveChat as _saveChat,
  saveMessages as _saveMessages,
  updateChatTitleById as _updateChatTitleById,
} from '@/lib/db/queries';
import type { DBMessage } from '@/lib/db/schema';
import type { VisibilityType } from '@/components/chat/visibility-selector';

export async function saveChat(args: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  return _saveChat(args);
}

export async function saveMessages(args: { messages: DBMessage[] }) {
  return _saveMessages(args);
}

export async function updateChatTitleById(args: {
  chatId: string;
  title: string;
}) {
  return _updateChatTitleById(args);
}
