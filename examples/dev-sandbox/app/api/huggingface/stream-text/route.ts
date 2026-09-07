import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createHuggingfaceV3Middleware } from '@ai-billing/huggingface';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createHuggingFace } from '@ai-sdk/huggingface';

const huggingFace = createHuggingFace({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.HUGGINGFACE_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'meta-llama/Llama-3.1-8B-Instruct': {
    promptTokens: 0.05 / 1_000_000, // $0.05 per 1M tokens
    completionTokens: 0.15 / 1_000_000, // $0.15 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createHuggingfaceV3Middleware({
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

  const model = 'meta-llama/Llama-3.1-8B-Instruct';

  const wrappedModel = wrapLanguageModel({
    model: huggingFace(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
