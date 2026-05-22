'use client';

import type { UIMessage } from 'ai';
import { chatContainer, type ModelOption } from '@ai-billing/ui';
import { ChatInput } from './ChatInput.js';
import { ChatMessages } from './ChatMessages.js';
import { useChat } from './useChat.js';

export interface ChatProps {
  userId: string;
  models?: ModelOption[];
  defaultModel?: string;
  messages?: UIMessage[];
  tags?: Record<string, string>;
  placeholder?: string;
  emptyMessage?: string;
  title?: string;
  subtitle?: string;
  examplePrompts?: string[];
}

export function Chat({
  userId,
  models: modelsProp,
  defaultModel,
  messages: initialMessages,
  tags,
  placeholder = 'Ask anything...',
  emptyMessage,
  title,
  subtitle,
  examplePrompts,
}: ChatProps) {
  const { messages, isLoading, submit, stop, selectedModel, onModelSelect, costs, errors } =
    useChat({ userId, defaultModel, initialMessages, tags });

  return (
    <div style={chatContainer}>
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        costs={costs}
        errors={errors}
        title={title}
        subtitle={subtitle}
        emptyMessage={emptyMessage}
        prompts={examplePrompts}
        onPromptClick={submit}
      />

      <ChatInput
        staticModels={modelsProp}
        defaultModel={defaultModel}
        selectedModel={selectedModel}
        onModelSelect={onModelSelect}
        onSubmit={submit}
        isLoading={isLoading}
        onStop={stop}
        placeholder={placeholder}
      />
    </div>
  );
}
