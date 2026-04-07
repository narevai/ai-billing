import { createGroq } from '@ai-sdk/groq';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createGroqMiddleware } from '@ai-billing/groq';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const groq = createGroq({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GROQ_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'openai/gpt-oss-120b': {
    promptTokens: 0.15 / 1_000_000, // $0.15 per 1M tokens
    completionTokens: 0.6 / 1_000_000, // $0.60 per 1M tokens
    inputCacheReadTokens: 0.075 / 1_000_000, // 50% discount for cache reads
    inputCacheWriteTokens: 0, // Free cache writes
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createGroqMiddleware({
  destinations: [consoleDestination()],
  priceResolver: priceResolver,
});

export async function POST() {
  const messages: UIMessage[] = [
    {
      id: 'test-message-123',
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'What is the capital of Sweden?',
        },
      ],
    },
  ];

  const model = 'openai/gpt-oss-120b';

  const wrappedModel = wrapLanguageModel({
    model: groq(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
