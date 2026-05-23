'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import type { UIMessage } from 'ai';
import { useChat } from '@ai-billing/nextjs';
import { ChatInput, ChatMessages } from '@ai-billing/nextjs';
import {
  saveChat,
  saveMessages,
  updateChatTitleById,
} from '@/app/(chat)/db-actions';
import { generateTitleFromUserMessage } from '@/app/(chat)/actions';
import { ChatHeader } from './chat-header';

interface ChatShellProps {
  userId: string;
  chatId: string;
  initialMessages?: UIMessage[];
  isReadonly?: boolean;
}

export function ChatShell({
  userId,
  chatId,
  initialMessages,
  isReadonly,
}: ChatShellProps) {
  const router = useRouter();
  const isNewChat = useRef(!initialMessages?.length);

  const {
    messages,
    status,
    submit,
    stop,
    selectedModel,
    onModelSelect,
    costs,
    errors,
  } = useChat({
    userId,
    initialMessages,
    tags: { chatId, userId },
    onSubmit: async userMsg => {
      if (!isNewChat.current) return;
      isNewChat.current = false;

      await saveChat({
        id: chatId,
        userId,
        title: 'New chat',
        visibility: 'private',
      });
      await saveMessages({
        messages: [
          {
            id: userMsg.id,
            chatId,
            role: userMsg.role,
            parts: userMsg.parts as never,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });

      generateTitleFromUserMessage({ message: userMsg })
        .then(title => updateChatTitleById({ chatId, title }))
        .catch(() => {});
    },
    onFinish: async allMessages => {
      const lastMsg = allMessages.findLast(m => m.role === 'assistant');
      if (!lastMsg) return;

      await saveMessages({
        messages: [
          {
            id: lastMsg.id,
            chatId,
            role: lastMsg.role,
            parts: lastMsg.parts as never,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });

      router.refresh();
    },
  });

  return (
    <div className="flex h-dvh w-full flex-col">
      <ChatHeader
        chatId={chatId}
        isReadonly={isReadonly ?? false}
        selectedVisibilityType="private"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:rounded-tl-[12px] md:border-t md:border-l md:border-border/40">
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
          <ChatMessages
            messages={messages}
            isLoading={status === 'submitted'}
            costs={costs}
            errors={errors}
            onPromptClick={submit}
          />
        </div>
      </div>

      {!isReadonly && (
        <div className="sticky bottom-0 px-4 pb-4">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              onSubmit={submit}
              isLoading={status !== 'idle'}
              onStop={stop}
              selectedModel={selectedModel}
              onModelSelect={onModelSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}
