import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { consoleDestination } from '@ai-billing/core';
import { createOpenMeterDestination } from '@ai-billing/openmeter';

type BillingTags = {
  userId?: string;
  org_name?: string;
};

const openMeterDestination = createOpenMeterDestination<BillingTags>({
  apiKey: `${process.env.OPENMETER_API_KEY}`,
});

const openrouter = createOpenRouter({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENROUTER_API_KEY,
});

const billingMiddleware = createOpenRouterV3Middleware<BillingTags>({
  destinations: [consoleDestination(), openMeterDestination],
});

export async function POST() {
  const messages: UIMessage[] = [
    {
      id: 'test-message-123',
      role: 'user',
      parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
    },
  ];

  const model = 'openai/gpt-4o';

  const wrappedModel = wrapLanguageModel({
    model: openrouter(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      'ai-billing-tags': {
        userId: 'user_openmeter_test',
        org_name: 'Acme Corp',
      } as BillingTags,
    },
  });

  return result.toUIMessageStreamResponse();
}
