import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createGoogleVertexV3Middleware } from '@ai-billing/google-vertex';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createVertex } from '@ai-sdk/google-vertex';

const vertex = createVertex({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  project: process.env.GOOGLE_VERTEX_PROJECT,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  location: process.env.GOOGLE_VERTEX_LOCATION,
});

const customPricingMap: Record<string, ModelPricing> = {
  'gemini-2.5-flash': {
    promptTokens: 0.3 / 1_000_000, // $0.30 per 1M tokens
    completionTokens: 2.5 / 1_000_000, // $2.50 per 1M tokens
    internalReasoningTokens: 2.5 / 1_000_000, // $2.50 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createGoogleVertexV3Middleware({
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

  const model = 'gemini-2.5-flash';

  const wrappedModel = wrapLanguageModel({
    model: vertex(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
