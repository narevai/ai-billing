import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createMoonshotaiV3Middleware } from '@ai-billing/moonshotai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createMoonshotAI } from '@ai-sdk/moonshotai';

const moonshotai = createMoonshotAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MOONSHOT_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'kimi-k3': {
    promptTokens: 3.0 / 1_000_000, // $3.00 per 1M tokens
    completionTokens: 15.0 / 1_000_000, // $15.00 per 1M tokens
    inputCacheReadTokens: 0.3 / 1_000_000, // $0.30 per 1M tokens
    internalReasoningTokens: 15.0 / 1_000_000, // billed at the same flat rate as completion tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createMoonshotaiV3Middleware({
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

  const model = 'kimi-k3';

  const wrappedModel = wrapLanguageModel({
    model: moonshotai(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
