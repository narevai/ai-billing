import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { consoleDestination } from '@ai-billing/core';
import { createLagoDestination } from '@ai-billing/lago';

type BillingTags = {
  userId?: string;
};

const lagoDestination = createLagoDestination<BillingTags>({
  apiKey: `${process.env.LAGO_API_KEY}`,
  apiUrl: process.env.LAGO_API_URL,
  meterCode: 'llm_cost',
});

const openrouter = createOpenRouter({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENROUTER_API_KEY,
});

const billingMiddleware = createOpenRouterV3Middleware<BillingTags>({
  destinations: [consoleDestination(), lagoDestination],
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
        userId: 'user_lago_test',
      } as BillingTags,
    },
  });

  return result.toUIMessageStreamResponse();
}
