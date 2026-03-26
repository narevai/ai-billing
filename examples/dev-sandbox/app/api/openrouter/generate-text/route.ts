import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { OpenRouterBillingMiddleware } from '@ai-billing/openrouter';
import { ConsoleDestination } from '@ai-billing/core';

const openrouter = createOpenRouter({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENROUTER_API_KEY,
});

const consoleLogger = new ConsoleDestination();
const billingMiddleware = new OpenRouterBillingMiddleware({
  destinations: [consoleLogger.handle],
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
    });

    return Response.json(result);
  } catch (error) {
    console.error('Generate Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
