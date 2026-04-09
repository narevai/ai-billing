import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { consoleDestination } from '@ai-billing/core';
import { createPolarDestination } from '@ai-billing/polar';

type BillingTags = {
  customer_id?: string;
  org_name?: string;
};

const polarDestination = createPolarDestination<BillingTags>({
  accessToken: process.env.POLAR_ACCESS_TOKEN, // Make sure this is in your .env
  eventName: 'llm_usage', // The slug from your Polar dashboard
  server: 'sandbox', // Good for testing!
});

const openrouter = createOpenRouter({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENROUTER_API_KEY,
});

//const consoleLogger = new ConsoleDestination();
const billingMiddleware = createOpenRouterV3Middleware<BillingTags>({
  destinations: [consoleDestination(), polarDestination],
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

  const model = 'google/gemini-2.0-flash-001';

  const wrappedModel = wrapLanguageModel({
    model: openrouter(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      'ai-billing-tags': {
        customer_id: '4a874ea3-53ec-432d-9d55-c55bf957e18f', // This triggers internalCustomerId in Polar
        org_name: 'Acme Corp', // This will end up in Polar metadata
      } as BillingTags,
    },
  });

  return result.toUIMessageStreamResponse();
}
