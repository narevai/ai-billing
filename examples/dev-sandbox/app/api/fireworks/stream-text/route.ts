import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createFireworksV3Middleware } from '@ai-billing/fireworks';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createFireworks } from '@ai-sdk/fireworks';

const fireworks = createFireworks({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.FIREWORKS_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'accounts/fireworks/models/glm-5p3-flash': {
    promptTokens: 0.2 / 1_000_000, // $0.20 per 1M tokens
    completionTokens: 0.8 / 1_000_000, // $0.80 per 1M tokens
    inputCacheReadTokens: 0.1 / 1_000_000, // 50% discount for cache reads
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createFireworksV3Middleware({
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

  // The raw route's default model, `accounts/fireworks/models/deepseek-v3`, is not available on
  // the account this package was built against — `glm-5p3-flash` is the working model id.
  const model = 'accounts/fireworks/models/glm-5p3-flash';

  const wrappedModel = wrapLanguageModel({
    model: fireworks(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
