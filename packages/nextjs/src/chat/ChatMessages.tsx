'use client';

import React from 'react';
import type { UIMessage } from 'ai';
import {
  ChatMessagesPanel,
  ChatMessage,
  ChatEmptyState,
  costLabel,
  errorLabel,
} from '@ai-billing/ui';
import type { MessageCost } from './useChat.js';

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(
      (p): p is { type: 'text'; text: string } & typeof p => p.type === 'text',
    )
    .map(p => p.text)
    .join('');
}

export interface ChatMessagesProps extends React.HTMLAttributes<HTMLDivElement> {
  messages: UIMessage[];
  isLoading?: boolean;
  costs?: Map<string, MessageCost>;
  errors?: Map<string, string>;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  prompts?: string[];
  onPromptClick?: (prompt: string) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  costs,
  errors,
  title,
  subtitle,
  emptyMessage,
  prompts,
  onPromptClick,
  ...props
}: ChatMessagesProps) {
  const visible = messages.filter(
    m => m.role === 'user' || m.role === 'assistant',
  );

  const isEmpty = visible.length === 0 && !isLoading;

  if (isEmpty) {
    return (
      <ChatEmptyState
        title={title}
        subtitle={subtitle}
        emptyMessage={emptyMessage}
        prompts={prompts}
        onPromptClick={onPromptClick}
      />
    );
  }

  return (
    <ChatMessagesPanel isLoading={isLoading} {...props}>
      {visible.map(m => {
        const cost = costs?.get(m.id);
        const error = errors?.get(m.id);
        return (
          <React.Fragment key={m.id}>
            <ChatMessage
              role={m.role as 'user' | 'assistant'}
              content={getMessageText(m)}
            />
            {cost && m.role === 'assistant' && (
              <div style={costLabel}>
                Generation cost:{' '}
                <span style={{ color: '#4ade80' }}>
                  ${cost.amount.toFixed(6)}
                </span>
              </div>
            )}
            {error && <div style={errorLabel}>{error}</div>}
          </React.Fragment>
        );
      })}
    </ChatMessagesPanel>
  );
}
