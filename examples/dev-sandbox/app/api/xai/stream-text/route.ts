import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createXaiMiddleware } from '@ai-billing/xai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createXai } from '@ai-sdk/xai';

const xai = createXai({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.XAI_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'grok-3-mini': {
    promptTokens: 0.000003,
    completionTokens: 0.000015,
    inputCacheReadTokens: 0.0000003,
    inputCacheWriteTokens: 0.00000375,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createXaiMiddleware({
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

  const model = 'grok-3-mini';

  const wrappedModel = wrapLanguageModel({
    model: xai(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
