import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { consoleDestination } from '@ai-billing/core';
import { createStripeDestination } from '@ai-billing/stripe';

type BillingTags = {
  org_name?: string;
  stripe_customer_id?: string;
};

const stripeDestination = createStripeDestination<BillingTags>({
  apiKey: `${process.env.STRIPE_SECRET_KEY}`, // Make sure this is in your .env
  meterName: 'ai-billing-test', // The slug from your Stripe dashboard
});

const openrouter = createOpenRouter({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENROUTER_API_KEY,
});

//const consoleLogger = new ConsoleDestination();
const billingMiddleware = createOpenRouterV3Middleware<BillingTags>({
  destinations: [consoleDestination(), stripeDestination],
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
        stripe_customer_id: 'cus_UIMLD4AuBpC8Ux', // This has to be defined as customer_mapping in your Stripe meter
        org_name: 'acme corp', // This will end up in Stripe metadata
      } as BillingTags,
    },
  });

  return result.toUIMessageStreamResponse();
}
