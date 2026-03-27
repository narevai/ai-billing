import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { consoleDestination } from '@ai-billing/core';

const openrouter = createOpenRouter({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENROUTER_API_KEY,
});

//const consoleLogger = new ConsoleDestination();
const billingMiddleware = createOpenRouterV3Middleware({
  destinations: [consoleDestination()],
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
  });

  return result.toUIMessageStreamResponse();
}
