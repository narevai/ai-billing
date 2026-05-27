'use server';

import { createStreamableValue } from '@ai-sdk/rsc';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import type { UIMessage } from 'ai';
import { costToNumber, type Cost } from '@ai-billing/core';
import { createChatRouter } from './router.js';
import type { ChatRouterOptions } from './router.js';
import { getChatToolsConfig } from './chatTools.js';
import type { ModelOption } from '@ai-billing/ui';

let _routerPromise: ReturnType<typeof createChatRouter> | null = null;
let _routerOptions: ChatRouterOptions = {};

const _abortControllers = new Map<string, AbortController>();

function optionsEqual(
  a: ChatRouterOptions | null,
  b: ChatRouterOptions,
): boolean {
  if (!a) return false;
  return (
    a.polarAccessToken === b.polarAccessToken &&
    a.polarServer === b.polarServer &&
    a.narevApiKey === b.narevApiKey &&
    JSON.stringify(a.models) === JSON.stringify(b.models) &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    JSON.stringify(a.env) === JSON.stringify(b.env)
  );
}

async function getRouter(options: ChatRouterOptions = {}) {
  const mergedOptions = { ..._routerOptions, ...options };
  if (!_routerPromise || !optionsEqual(_routerOptions, mergedOptions)) {
    _routerOptions = mergedOptions;
    _routerPromise = createChatRouter(mergedOptions);
  }
  return _routerPromise;
}

/** Returns available models for the configured providers. */
export async function getModels(
  options: ChatRouterOptions = {},
): Promise<ModelOption[]> {
  const router = await getRouter(options);
  return router.getModels();
}

/** Streams a chat response for the given messages and model. */
export async function streamChat(
  messages: UIMessage[],
  modelId: string,
  tags?: Record<string, string>,
  streamId?: string,
) {
  const router = await getRouter({});
  const model = router.getModel(modelId);
  const modelMessages = await convertToModelMessages(messages);

  const abortController = new AbortController();
  if (streamId) {
    _abortControllers.set(streamId, abortController);
  }

  const toolsConfig = getChatToolsConfig();

  const result = streamText({
    model,
    messages: modelMessages,
    tools: toolsConfig?.tools,
    stopWhen: toolsConfig ? stepCountIs(toolsConfig.maxSteps ?? 5) : undefined,
    providerOptions: tags ? { 'ai-billing-tags': tags } : undefined,
    abortSignal: abortController.signal,
  });

  const stream = createStreamableValue<{
    text: string;
    cost?: { amount: number; currency: string };
    error?: string;
    data?: unknown[];
    toolCall?: { toolCallId: string; toolName: string; input: unknown };
    toolResult?: { toolCallId: string; toolName: string; result: unknown };
  }>({ text: '' });

  (async () => {
    try {
      let fullText = '';
      let thinkingText = '';
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          thinkingText = '';
          fullText += part.text;
          stream.update({ text: fullText });
        } else if (part.type === 'reasoning-delta') {
          thinkingText += part.text;
          stream.update({ text: thinkingText });
        } else if (part.type === 'tool-call') {
          const toolPart = part as unknown as {
            toolCallId: string;
            toolName: string;
            input: unknown;
          };
          stream.update({
            text: fullText,
            toolCall: {
              toolCallId: toolPart.toolCallId,
              toolName: toolPart.toolName,
              input: toolPart.input,
            },
          });
        } else if (part.type === 'tool-result') {
          const resultPart = part as unknown as {
            toolCallId: string;
            toolName: string;
            output: unknown;
          };
          stream.update({
            text: fullText,
            toolResult: {
              toolCallId: resultPart.toolCallId,
              toolName: resultPart.toolName,
              result: resultPart.output,
            },
          });
        } else if (part.type === 'finish-step') {
          const billing = (part.providerMetadata as Record<string, unknown>)?.[
            'ai-billing'
          ] as { cost?: Cost } | undefined;
          if (billing?.cost) {
            stream.update({
              text: fullText,
              cost: {
                amount: costToNumber(billing.cost, 'base'),
                currency: billing.cost.currency,
              },
            });
          }
        }
      }

      stream.done();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        stream.done();
      } else {
        stream.update({
          text: '',
          error: err instanceof Error ? err.message : 'Stream failed',
        });
        stream.done();
      }
    } finally {
      if (streamId) _abortControllers.delete(streamId);
    }
  })();

  return { value: stream.value };
}

/** Aborts an in-progress stream by its ID. */
export async function stopChat(streamId: string) {
  const controller = _abortControllers.get(streamId);
  if (controller) {
    controller.abort();
    _abortControllers.delete(streamId);
  }
}
