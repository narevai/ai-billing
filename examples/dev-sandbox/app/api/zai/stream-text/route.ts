import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createZaiV3Middleware } from '@ai-billing/zai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createZai } from '@ai-sdk/zai';

const zai = createZai({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ZAI_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'glm-5.3': {
    promptTokens: 1.4 / 1_000_000, // $1.40 per 1M tokens
    completionTokens: 4.4 / 1_000_000, // $4.40 per 1M tokens
    inputCacheReadTokens: 0.26 / 1_000_000, // $0.26 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createZaiV3Middleware({
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

  const model = 'glm-5.3';

  const wrappedModel = wrapLanguageModel({
    model: zai(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
