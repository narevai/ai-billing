import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createTogetheraiV3Middleware } from '@ai-billing/togetherai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createTogetherAI } from '@ai-sdk/togetherai';

const togetherai = createTogetherAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.TOGETHER_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'openai/gpt-oss-20b': {
    promptTokens: 0.05 / 1_000_000, // $0.05 per 1M tokens
    completionTokens: 0.2 / 1_000_000, // $0.20 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createTogetheraiV3Middleware({
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

  const model = 'openai/gpt-oss-20b';

  const wrappedModel = wrapLanguageModel({
    model: togetherai(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
