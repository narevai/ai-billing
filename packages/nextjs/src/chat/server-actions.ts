'use server';

import { createStreamableValue } from '@ai-sdk/rsc';
import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { costToNumber, type Cost } from '@ai-billing/core';
import { createChatGateway } from './gateway.js';
import type { ChatGatewayOptions } from './gateway.js';
import type { ModelOption } from '@ai-billing/ui';

let _gatewayPromise: ReturnType<typeof createChatGateway> | null = null;
let _gatewayOptions: ChatGatewayOptions = {};

const _abortControllers = new Map<string, AbortController>();

function optionsEqual(
  a: ChatGatewayOptions | null,
  b: ChatGatewayOptions,
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

async function getGateway(options: ChatGatewayOptions = {}) {
  const mergedOptions = { ..._gatewayOptions, ...options };
  if (!_gatewayPromise || !optionsEqual(_gatewayOptions, mergedOptions)) {
    _gatewayOptions = mergedOptions;
    _gatewayPromise = createChatGateway(mergedOptions);
  }
  return _gatewayPromise;
}

/** Returns available models for the configured providers. */
export async function getModels(
  options: ChatGatewayOptions = {},
): Promise<ModelOption[]> {
  const gateway = await getGateway(options);
  return gateway.getModels();
}

/** Streams a chat response for the given messages and model. */
export async function streamChat(
  messages: UIMessage[],
  modelId: string,
  tags?: Record<string, string>,
  streamId?: string,
) {
  const gateway = await getGateway({});
  const model = gateway.getModel(modelId);
  const modelMessages = await convertToModelMessages(messages);

  const abortController = new AbortController();
  if (streamId) {
    _abortControllers.set(streamId, abortController);
  }

  const result = streamText({
    model,
    messages: modelMessages,
    providerOptions: tags ? { 'ai-billing-tags': tags } : undefined,
    abortSignal: abortController.signal,
  });

  const stream = createStreamableValue<{
    text: string;
    cost?: { amount: number; currency: string };
    error?: string;
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
        } else if (part.type === 'finish-step') {
          const billing = (part.providerMetadata as Record<string, unknown>)?.['ai-billing'] as { cost?: Cost } | undefined;
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
