import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createCerebrasV3Middleware } from '@ai-billing/cerebras';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createCerebras } from '@ai-sdk/cerebras';

const cerebras = createCerebras({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.CEREBRAS_API_KEY,
});

// Pricing per Cerebras's own docs at the time of writing:
// https://inference-docs.cerebras.ai/models/openai-oss ($0.35 / $0.75 per 1M tokens).
// Cerebras pricing can change — verify against the link above before relying on this in
// production.
const customPricingMap: Record<string, ModelPricing> = {
  'gpt-oss-120b': {
    promptTokens: 0.35 / 1_000_000, // $0.35 per 1M tokens
    completionTokens: 0.75 / 1_000_000, // $0.75 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createCerebrasV3Middleware({
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

  const model = 'gpt-oss-120b';

  const wrappedModel = wrapLanguageModel({
    model: cerebras(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
