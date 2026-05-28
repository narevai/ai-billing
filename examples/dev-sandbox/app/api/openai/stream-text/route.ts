import { createOpenAI } from '@ai-sdk/openai';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createOpenAIMiddleware } from '@ai-billing/openai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const openai = createOpenAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENAI_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'gpt-5': {
    promptTokens: 1.25 / 1_000_000,
    completionTokens: 10.0 / 1_000_000,
    inputCacheReadTokens: 0.125 / 1_000_000,
  },
  'gpt-4o': {
    promptTokens: 5.0 / 1_000_000,
    completionTokens: 15.0 / 1_000_000,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createOpenAIMiddleware({
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

  const model = 'gpt-5';

  const wrappedModel = wrapLanguageModel({
    model: openai(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
