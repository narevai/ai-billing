import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createAzureV3Middleware } from '@ai-billing/azure';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createAzure } from '@ai-sdk/azure';

const azure = createAzure({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AZURE_API_KEY,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  baseURL: process.env.AZURE_URL
    ? `${process.env.AZURE_URL.replace(/\/+$/, '')}/openai/v1`
    : undefined,
  apiVersion: 'preview',
});

// eslint-disable-next-line turbo/no-undeclared-env-vars
const model = process.env.AZURE_DEPLOYMENT ?? 'DeepSeek-V4-Pro';

const customPricingMap: Record<string, ModelPricing> = {
  [model]: {
    promptTokens: 0.14 / 1_000_000, // $0.14 per 1M tokens
    completionTokens: 0.28 / 1_000_000, // $0.28 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createAzureV3Middleware({
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

  const wrappedModel = wrapLanguageModel({
    model: azure(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
