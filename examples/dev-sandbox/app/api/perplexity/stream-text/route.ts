import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createPerplexityV3Middleware } from '@ai-billing/perplexity';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createPerplexity } from '@ai-sdk/perplexity';

const perplexity = createPerplexity({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.PERPLEXITY_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'sonar-pro': {
    promptTokens: 3.0 / 1_000_000, // $3.00 per 1M input tokens
    completionTokens: 15.0 / 1_000_000, // $15.00 per 1M output tokens
    request: 6.0 / 1_000, // flat per-request search fee (low search_context_size rate)
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createPerplexityV3Middleware({
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

  const model = 'sonar-pro';

  const wrappedModel = wrapLanguageModel({
    model: perplexity(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
