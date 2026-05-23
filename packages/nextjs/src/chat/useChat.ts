'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';
import type { UIMessage } from 'ai';
import type { ModelOption } from '@ai-billing/ui';
import { streamChat, stopChat } from './server-actions.js';

export type ChatStatus = 'idle' | 'submitted' | 'streaming';

export interface UseChatOptions {
  userId: string;
  defaultModel?: string;
  initialMessages?: UIMessage[];
  tags?: Record<string, string>;
  onSubmit?: (message: UIMessage) => void | Promise<void>;
  onFinish?: (messages: UIMessage[]) => void | Promise<void>;
  onData?: (data: unknown) => void;
}

export interface MessageCost {
  amount: number;
  currency: string;
}

export interface UseChatReturn {
  messages: UIMessage[];
  status: ChatStatus;
  isLoading: boolean;
  submit: (text: string) => void;
  stop: () => void;
  selectedModel: string;
  onModelSelect: (model: ModelOption) => void;
  costs: Map<string, MessageCost>;
  errors: Map<string, string>;
  addToolApprovalResponse: (toolCallId: string, approved: boolean) => void;
}

type PendingToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  assistantMsgId: string;
};

function generateId() {
  return crypto.randomUUID();
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
  onSubmit,
  onFinish,
  onData,
}: UseChatOptions): UseChatReturn {
  const [selectedModel, setSelectedModel] = useState(defaultModel ?? '');
  const selectedModelRef = useRef(selectedModel);
  const tagsRef = useRef(tags);
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages ?? []);
  const onSubmitRef = useRef(onSubmit);
  const onFinishRef = useRef(onFinish);
  const onDataRef = useRef(onData);

  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  const onModelSelect = useCallback((model: ModelOption) => {
    selectedModelRef.current = model.id;
    setSelectedModel(model.id);
  }, []);

  const [status, setStatus] = useState<ChatStatus>('idle');
  const [costs, setCosts] = useState<Map<string, MessageCost>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [pendingToolCalls, setPendingToolCalls] = useState<
    Map<string, PendingToolCall>
  >(new Map());
  const pendingToolCallsRef = useRef(pendingToolCalls);
  const activeStreamRef = useRef<string | null>(null);

  useEffect(() => {
    pendingToolCallsRef.current = pendingToolCalls;
  }, [pendingToolCalls]);

  const runStream = useCallback(
    async (
      allMessages: UIMessage[],
      assistantMsg: UIMessage,
      streamId: string,
    ) => {
      const model = selectedModelRef.current;
      const mergedTags = { ...tagsRef.current, userId };

      // Track parts locally so onFinish always gets the correct final state,
      // independent of React's async state commit timing.
      let currentParts: UIMessage['parts'] = [];
      const localPending = new Map<string, PendingToolCall>();

      const updateAssistantParts = (parts: UIMessage['parts']) => {
        currentParts = parts;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? ({ ...m, parts } as unknown as UIMessage)
              : m,
          ),
        );
      };

      try {
        const { value } = await streamChat(
          allMessages,
          model,
          mergedTags,
          streamId,
        );
        let fullText = '';
        let firstText = true;

        for await (const chunk of readStreamableValue(value)) {
          if (!chunk || activeStreamRef.current !== streamId) break;

          if (chunk.error) {
            setErrors(prev => {
              const n = new Map(prev);
              n.set(assistantMsg.id, chunk.error!);
              return n;
            });
            break;
          }

          if (chunk.data) {
            for (const item of chunk.data) onDataRef.current?.(item);
          }

          if (chunk.toolCall) {
            const { toolCallId, toolName, input } = chunk.toolCall;
            const pending: PendingToolCall = {
              toolCallId,
              toolName,
              input,
              assistantMsgId: assistantMsg.id,
            };
            localPending.set(toolCallId, pending);
            setPendingToolCalls(prev => {
              const n = new Map(prev);
              n.set(toolCallId, pending);
              return n;
            });
            updateAssistantParts([
              ...currentParts,
              {
                type: `tool-${toolName}`,
                toolCallId,
                state: 'input',
                input,
              } as unknown as UIMessage['parts'][number],
            ]);
          }

          if (chunk.toolResult) {
            const { toolCallId, result } = chunk.toolResult;
            const pending = localPending.get(toolCallId);
            if (pending) {
              localPending.delete(toolCallId);
              setPendingToolCalls(prev => {
                const n = new Map(prev);
                n.delete(toolCallId);
                return n;
              });
              updateAssistantParts(
                currentParts.map(p => {
                  const tp = p as unknown as {
                    type: string;
                    toolCallId?: string;
                  };
                  if (
                    tp.type.startsWith('tool-') &&
                    tp.toolCallId === toolCallId
                  ) {
                    return {
                      type: `tool-${pending.toolName}`,
                      toolCallId,
                      state: 'output',
                      input: pending.input,
                      output: result,
                    } as unknown as UIMessage['parts'][number];
                  }
                  return p;
                }),
              );
              onDataRef.current?.(chunk.toolResult);
            }
          }

          if (chunk.text !== undefined) {
            fullText = chunk.text;
            if (firstText && fullText) {
              firstText = false;
              setStatus('streaming');
            }

            if (chunk.cost) {
              setCosts(prev => {
                const n = new Map(prev);
                n.set(assistantMsg.id, chunk.cost!);
                return n;
              });
            }

            const nonTextParts = currentParts.filter(p => p.type !== 'text');
            updateAssistantParts(
              fullText
                ? [
                    ...nonTextParts,
                    {
                      type: 'text',
                      text: fullText,
                    } as unknown as UIMessage['parts'][number],
                  ]
                : nonTextParts,
            );
          }
        }
      } catch (err) {
        setErrors(prev => {
          const n = new Map(prev);
          n.set(
            assistantMsg.id,
            err instanceof Error ? err.message : 'Stream failed',
          );
          return n;
        });
      } finally {
        if (activeStreamRef.current === streamId) {
          setStatus('idle');
          activeStreamRef.current = null;
          const finalMsg = {
            ...assistantMsg,
            parts: currentParts,
          } as unknown as UIMessage;
          void onFinishRef.current?.([...allMessages, finalMsg]);
        }
      }
    },
    [userId],
  );

  const submit = useCallback(
    (text: string) => {
      const model = selectedModelRef.current;
      if (!model || status !== 'idle') return;

      const userMsg = createMessage('user', text);
      const assistantMsg = createMessage('assistant', '');
      const streamId = generateId();

      let prevMessages: UIMessage[] = [];
      setMessages(prev => {
        prevMessages = prev;
        return [...prev, userMsg, assistantMsg];
      });
      setStatus('submitted');
      activeStreamRef.current = streamId;

      void onSubmitRef.current?.(userMsg);

      void runStream([...prevMessages, userMsg], assistantMsg, streamId);
    },
    [status, runStream],
  );

  const addToolApprovalResponse = useCallback(
    (toolCallId: string, approved: boolean) => {
      const pendingCall = pendingToolCalls.get(toolCallId);
      if (!pendingCall) return;

      setPendingToolCalls(prev => {
        const n = new Map(prev);
        n.delete(toolCallId);
        return n;
      });

      setMessages(prev => {
        const updatedMessages = prev.map(m => {
          if (m.id !== pendingCall.assistantMsgId) return m;
          return {
            ...m,
            parts: m.parts.map(p => {
              const tp = p as unknown as { type: string; toolCallId?: string };
              if (tp.type.startsWith('tool-') && tp.toolCallId === toolCallId) {
                return {
                  type: `tool-${pendingCall.toolName}`,
                  toolCallId,
                  state: approved ? 'output' : 'output-denied',
                  input: pendingCall.input,
                  output: approved ? undefined : { denied: true },
                };
              }
              return p;
            }),
          } as unknown as UIMessage;
        });

        if (!approved) return updatedMessages;

        const newAssistantMsg = createMessage('assistant', '');
        setStatus('submitted');
        const streamId = generateId();
        activeStreamRef.current = streamId;
        void runStream(updatedMessages, newAssistantMsg, streamId);
        return [...updatedMessages, newAssistantMsg];
      });

      if (!approved) setStatus('idle');
    },
    [pendingToolCalls, runStream],
  );

  const stop = useCallback(() => {
    const streamId = activeStreamRef.current;
    if (streamId) stopChat(streamId);
    setStatus('idle');
    activeStreamRef.current = null;
  }, []);

  return {
    messages,
    status,
    isLoading: status !== 'idle',
    submit,
    stop,
    selectedModel,
    onModelSelect,
    costs,
    errors,
    addToolApprovalResponse,
  };
}
