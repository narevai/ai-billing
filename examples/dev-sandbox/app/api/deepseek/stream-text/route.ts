import { createDeepSeek } from '@ai-sdk/deepseek';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createDeepSeekMiddleware } from '@ai-billing/deepseek';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const deepSeek = createDeepSeek({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  // from: https://api-docs.deepseek.com/quick_start/pricing
  'deepseek-v4-pro': {
    promptTokens: 0.14 / 1_000_000,
    completionTokens: 0.28 / 1_000_000,
    inputCacheReadTokens: 0.028 / 1_000_000,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createDeepSeekMiddleware({
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

  const model = 'deepseek-v4-pro';

  const wrappedModel = wrapLanguageModel({
    model: deepSeek(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
