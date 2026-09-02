import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
  createGateway,
} from 'ai';

import { createGatewayV3Middleware } from '@ai-billing/gateway';
import { consoleDestination } from '@ai-billing/core';

const gateway = createGateway({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const billingMiddleware = createGatewayV3Middleware({
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

  const model = 'deepseek/deepseek-v4-pro';

  const wrappedModel = wrapLanguageModel({
    model: gateway(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
