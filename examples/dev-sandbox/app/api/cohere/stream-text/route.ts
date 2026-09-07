import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createCohereV3Middleware } from '@ai-billing/cohere';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createCohere } from '@ai-sdk/cohere';

const cohere = createCohere({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.COHERE_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'command-r-08-2024': {
    promptTokens: 0.15 / 1_000_000, // $0.15 per 1M tokens
    completionTokens: 0.6 / 1_000_000, // $0.60 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createCohereV3Middleware({
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

  const model = 'command-r-08-2024';

  const wrappedModel = wrapLanguageModel({
    model: cohere(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
