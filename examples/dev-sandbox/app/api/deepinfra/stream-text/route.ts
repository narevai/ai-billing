import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createDeepinfraV3Middleware } from '@ai-billing/deepinfra';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createDeepInfra } from '@ai-sdk/deepinfra';

const deepInfra = createDeepInfra({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.DEEPINFRA_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'meta-llama/Llama-3.3-70B-Instruct': {
    promptTokens: 0.13 / 1_000_000, // $0.13 per 1M tokens
    completionTokens: 0.4 / 1_000_000, // $0.40 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createDeepinfraV3Middleware({
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

  const model = 'meta-llama/Llama-3.3-70B-Instruct';

  const wrappedModel = wrapLanguageModel({
    model: deepInfra(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
