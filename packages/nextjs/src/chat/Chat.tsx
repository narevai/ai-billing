'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';
import type { UIMessage } from 'ai';
import {
  ChatMessages,
  ChatMessage,
  ChatInput,
  ChatEmptyState,
  ModelSelector,
  chatContainer,
  costLabel,
  errorLabel,
  type ModelOption,
} from '@ai-billing/ui';
import { streamChat, stopChat } from './server-actions.js';
import { useModels } from './useModels.js';

function generateId() {
  return `msg_${Math.random().toString(36).slice(2, 11)}`;
}

function createMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: generateId(),
    role,
    parts: [{ type: 'text', text }],
    metadata: undefined,
  } as unknown as UIMessage;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(
      (p): p is { type: 'text'; text: string } & typeof p => p.type === 'text',
    )
    .map(p => p.text)
    .join('');
}

type MessageCost = { amount: number; currency: string };

function formatCost(cost: MessageCost) {
  return cost.amount.toFixed(6);
}

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
  const { models: availableModels, error: fetchError } = useModels(modelsProp);
  const [selectedModel, setSelectedModel] = useState<string>(
    defaultModel ?? '',
  );
  const selectedModelRef = useRef(selectedModel);
  const tagsRef = useRef(tags);

  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  useEffect(() => {
    if (availableModels.length > 0 && !selectedModelRef.current) {
      const first = defaultModel ?? availableModels[0]!.id;
      selectedModelRef.current = first;
      setSelectedModel(first);
    }
  }, [availableModels, defaultModel]);

  const [messages, setMessages] = useState<UIMessage[]>(initialMessages ?? []);
  const [status, setStatus] = useState<'idle' | 'streaming'>('idle');
  const [messageCosts, setMessageCosts] = useState<Map<string, MessageCost>>(
    new Map(),
  );
  const [messageErrors, setMessageErrors] = useState<Map<string, string>>(
    new Map(),
  );
  const activeStreamRef = useRef<string | null>(null);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  const handleSubmit = useCallback(
    async (text: string) => {
      const model = selectedModelRef.current;
      if (!model || status === 'streaming') return;

      const userMsg = createMessage('user', text);
      const assistantMsg = createMessage('assistant', '');
      const streamId = generateId();

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setStatus('streaming');
      activeStreamRef.current = streamId;

      const mergedTags = { ...tagsRef.current, userId };

      try {
        const allMessages = [...messages, userMsg];
        const { value } = await streamChat(
          allMessages,
          model,
          mergedTags,
          streamId,
        );
        let fullText = '';

        for await (const chunk of readStreamableValue(value)) {
          if (!chunk) continue;

          if (chunk.error) {
            setMessageErrors(prev => {
              const next = new Map(prev);
              next.set(assistantMsg.id, chunk.error!);
              return next;
            });
            break;
          }

          fullText = chunk.text;

          if (chunk.cost) {
            setMessageCosts(prev => {
              const next = new Map(prev);
              next.set(assistantMsg.id, chunk.cost!);
              return next;
            });
          }

          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? ({
                    ...m,
                    parts: [{ type: 'text', text: fullText }],
                    metadata: undefined,
                  } as unknown as UIMessage)
                : m,
            ),
          );
        }
      } catch (err) {
        setMessageErrors(prev => {
          const next = new Map(prev);
          next.set(
            assistantMsg.id,
            err instanceof Error ? err.message : 'Stream failed',
          );
          return next;
        });
      } finally {
        setStatus('idle');
        activeStreamRef.current = null;
      }
    },
    [messages, status, userId],
  );

  const handleStop = useCallback(() => {
    const streamId = activeStreamRef.current;
    if (streamId) stopChat(streamId);
    setStatus('idle');
    activeStreamRef.current = null;
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    selectedModelRef.current = modelId;
    setSelectedModel(modelId);
    setModelSelectorOpen(false);
  }, []);

  const isLoading = status === 'streaming';
  const isEmpty =
    messages.filter(m => m.role === 'user' || m.role === 'assistant').length ===
      0 && !isLoading;

  const selectedModelName =
    availableModels.find(m => m.id === selectedModel)?.name ??
    (selectedModel ? selectedModel.split('/').pop() : undefined);

  const visibleMessages = messages.filter(
    m => m.role === 'user' || m.role === 'assistant',
  );

  return (
    <div style={chatContainer}>
      {fetchError && (
        <div
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            color: '#ef4444',
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {fetchError}
        </div>
      )}

      {isEmpty ? (
        <ChatEmptyState
          title={title}
          subtitle={subtitle}
          emptyMessage={emptyMessage}
          prompts={examplePrompts}
          onPromptClick={handleSubmit}
        />
      ) : (
        <ChatMessages isLoading={isLoading}>
          {visibleMessages.map(m => {
            const cost = messageCosts.get(m.id);
            const error = messageErrors.get(m.id);
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
                      ${formatCost(cost)}
                    </span>
                  </div>
                )}
                {error && <div style={errorLabel}>{error}</div>}
              </React.Fragment>
            );
          })}
        </ChatMessages>
      )}

      <div style={{ flexShrink: 0, position: 'relative' }}>
        {modelSelectorOpen && availableModels.length > 0 && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0 }}>
            <ModelSelector
              models={availableModels}
              selectedModelId={selectedModel}
              onSelect={handleSelectModel}
            />
          </div>
        )}
        <ChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={handleStop}
          placeholder={placeholder}
          disabled={!selectedModel}
          modelLabel={selectedModelName}
          onModelClick={() => setModelSelectorOpen(prev => !prev)}
        />
      </div>
    </div>
  );
}
