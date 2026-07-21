import {
  UIMessage,
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
} from 'ai';
import { createBaseten } from '@ai-sdk/baseten';
import { createBasetenMiddleware } from '@ai-billing/baseten';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import type { LanguageModelV3 } from '@ai-sdk/provider';

const baseten = createBaseten({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.BASETEN_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'openai/gpt-oss-120b': {
    promptTokens: 0.1 / 1_000_000,
    completionTokens: 0.5 / 1_000_000,
    inputCacheReadTokens: 0.1 / 1_000_000,
    inputCacheWriteTokens: 0,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createBasetenMiddleware({
  destinations: [consoleDestination()],
  priceResolver,
});

export async function POST() {
  const messages: UIMessage[] = [
    {
      id: 'test-message-123',
      role: 'user',
      parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
    },
  ];

  const model = 'openai/gpt-oss-120b';

  const wrappedModel = wrapLanguageModel({
    model: baseten(model) as unknown as LanguageModelV3,
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
