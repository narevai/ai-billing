import { createOpenAI } from '@ai-sdk/openai';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  wrapLanguageModel,
} from 'ai';

import { createOpenAIMiddleware } from '@ai-billing/openai';
import { consoleDestination } from '@ai-billing/core';

const openai = createOpenAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENAI_API_KEY,
});

//const consoleLogger = new ConsoleDestination();
const billingMiddleware = createOpenAIMiddleware({
  destinations: [consoleDestination()],
  prices: async ({ modelId }) => {
    if (modelId === 'gpt-5') {
      return {
        // Change 'prompt' to 'promptTokens'
        promptTokens: 1.25 / 1_000_000,

        // Change 'completion' to 'completionTokens'
        completionTokens: 10.0 / 1_000_000,

        // Assuming this key is correct based on the library's types,
        // if it still errors, check if it should be something like 'inputCacheReadTokens'
        inputCacheRead: 0.125 / 1_000_000,
      };
    }
    return;
  },
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

  const model = 'gpt-5';

  const wrappedModel = wrapLanguageModel({
    model: openai(model),
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
