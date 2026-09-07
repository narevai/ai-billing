import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createAlibabaV3Middleware } from '@ai-billing/alibaba';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createAlibaba } from '@ai-sdk/alibaba';

const alibaba = createAlibaba({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ALIBABA_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'qwen-plus': {
    promptTokens: 0.8 / 1_000_000, // $0.80 per 1M tokens
    completionTokens: 2.0 / 1_000_000, // $2.00 per 1M tokens
    inputCacheReadTokens: 0.4 / 1_000_000, // 50% discount for cache reads
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createAlibabaV3Middleware({
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

  const model = 'qwen-plus';

  const wrappedModel = wrapLanguageModel({
    model: alibaba(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
