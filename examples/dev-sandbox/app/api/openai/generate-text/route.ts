import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
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
    // Return pricing based on the model being used.
    // Note: You'll want to use the actual OpenAI pricing here.
    if (modelId === 'gpt-5') {
      return {
        prompt: 1.25 / 1_000_000, // Price per input token
        completion: 10.0 / 1_000_000, // Price per output token
        inputCacheRead: 0.125 / 1_000_000, // Price per input token read from cache
      };
    }
    return null;
  },
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

    const model = 'gpt-5';

    const wrappedModel = wrapLanguageModel({
      model: openai(model),
      middleware: billingMiddleware,
    });

    const result = await generateText({
      model: wrappedModel,
      messages: await convertToModelMessages(messages),
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
