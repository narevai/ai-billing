import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createGoogleMiddleware } from '@ai-billing/google';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GOOGLE_AI_STUDIO_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'models/gemini-3.1-flash-lite-preview': {
    promptTokens: 0.15 / 1_000_000, // $0.15 per 1M tokens
    completionTokens: 0.6 / 1_000_000, // $0.60 per 1M tokens
    inputCacheReadTokens: 0.075 / 1_000_000, // 50% discount for cache reads
    inputCacheWriteTokens: 0, // Free cache writes
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createGoogleMiddleware({
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

  const model = 'models/gemini-3.1-flash-lite-preview';

  const wrappedModel = wrapLanguageModel({
    model: google(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
