import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createGmicloudV3Middleware } from '@ai-billing/gmicloud';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createGmicloud } from '@ai-sdk/gmicloud';

const gmicloud = createGmicloud({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GMI_CLOUD_APIKEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'deepseek-ai/DeepSeek-V4-Flash-0731': {
    promptTokens: 0.1 / 1_000_000, // $0.10 per 1M tokens
    completionTokens: 0.3 / 1_000_000, // $0.30 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createGmicloudV3Middleware({
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

  const model = 'deepseek-ai/DeepSeek-V4-Flash-0731';

  const wrappedModel = wrapLanguageModel({
    model: gmicloud(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
