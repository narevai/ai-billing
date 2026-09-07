import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createAmazonBedrockV3Middleware } from '@ai-billing/amazon-bedrock';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

const amazonBedrock = createAmazonBedrock({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  region: process.env.AWS_REGION,
});

const customPricingMap: Record<string, ModelPricing> = {
  'us.amazon.nova-lite-v1:0': {
    promptTokens: 0.06 / 1_000_000, // $0.06 per 1M tokens
    completionTokens: 0.24 / 1_000_000, // $0.24 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createAmazonBedrockV3Middleware({
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

  const model = 'us.amazon.nova-lite-v1:0';

  const wrappedModel = wrapLanguageModel({
    model: amazonBedrock(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
