import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { consoleDestination } from '@ai-billing/core';
import { createStripeDestination } from '@ai-billing/stripe';

type BillingTags = {
  userId?: string;
  stripe_customer_id?: string;
  org_name?: string;
};

const stripeDestination = createStripeDestination<BillingTags>({
  apiKey: process.env.STRIPE_SECRET_KEY || '',
  meterName: 'ai-billing-test',
});

const openrouter = createOpenRouter({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENROUTER_API_KEY,
});

const billingMiddleware = createOpenRouterV3Middleware<BillingTags>({
  destinations: [consoleDestination(), stripeDestination],
});

export async function POST() {
  try {
    const messages: UIMessage[] = [
      {
        id: 'test-gen-1',
        role: 'user',
        parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
      },
    ];

    const model = 'google/gemini-2.0-flash-001';

    const wrappedModel = wrapLanguageModel({
      model: openrouter(model),
      middleware: billingMiddleware,
    });

    const result = await generateText({
      model: wrappedModel,
      messages: await convertToModelMessages(messages),
      providerOptions: {
        'ai-billing-tags': {
          stripe_customer_id: 'cus_UIMLD4AuBpC8Ux', // This triggers stripeCustomerId
          org_name: 'Acme Corp', // This will end up in Stripe metadata
        } as BillingTags,
      },
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
