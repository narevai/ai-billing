'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';
import type { UIMessage } from 'ai';
import type { ModelOption } from '@ai-billing/ui';
import { streamChat, stopChat } from './server-actions.js';

export interface UseChatOptions {
  userId: string;
  defaultModel?: string;
  initialMessages?: UIMessage[];
  tags?: Record<string, string>;
  onFinish?: (messages: UIMessage[]) => void | Promise<void>;
}

export interface MessageCost {
  amount: number;
  currency: string;
}

export interface UseChatReturn {
  messages: UIMessage[];
  isLoading: boolean;
  submit: (text: string) => void;
  stop: () => void;
  selectedModel: string;
  onModelSelect: (model: ModelOption) => void;
  costs: Map<string, MessageCost>;
  errors: Map<string, string>;
}

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

export function useChat({
  userId,
  defaultModel,
  initialMessages,
  tags,
  onFinish,
}: UseChatOptions): UseChatReturn {
  const [selectedModel, setSelectedModel] = useState(defaultModel ?? '');
  const selectedModelRef = useRef(selectedModel);
  const tagsRef = useRef(tags);
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages ?? []);
  const messagesRef = useRef(messages);
  const onFinishRef = useRef(onFinish);

  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  const onModelSelect = useCallback((model: ModelOption) => {
    selectedModelRef.current = model.id;
    setSelectedModel(model.id);
  }, []);
  const [status, setStatus] = useState<'idle' | 'streaming'>('idle');
  const [costs, setCosts] = useState<Map<string, MessageCost>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const activeStreamRef = useRef<string | null>(null);

  const submit = useCallback(
    (text: string) => {
      const model = selectedModelRef.current;
      if (!model || status === 'streaming') return;

      const userMsg = createMessage('user', text);
      const assistantMsg = createMessage('assistant', '');
      const streamId = generateId();

      setMessages(prev => [...prev, userMsg, assistantMsg]);
      setStatus('streaming');
      activeStreamRef.current = streamId;

      const mergedTags = { ...tagsRef.current, userId };

      (async () => {
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
              setErrors(prev => {
                const next = new Map(prev);
                next.set(assistantMsg.id, chunk.error!);
                return next;
              });
              break;
            }

            fullText = chunk.text;

            if (chunk.cost) {
              setCosts(prev => {
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
          setErrors(prev => {
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
          void onFinishRef.current?.(messagesRef.current);
        }
      })();
    },
    [messages, status, userId],
  );

  const stop = useCallback(() => {
    const streamId = activeStreamRef.current;
    if (streamId) stopChat(streamId);
    setStatus('idle');
    activeStreamRef.current = null;
  }, []);

  return {
    messages,
    isLoading: status === 'streaming',
    submit,
    stop,
    selectedModel,
    onModelSelect,
    costs,
    errors,
  };
}
