import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createGroqMiddleware } from '@ai-billing/groq';
import { consoleDestination, createNarevPriceResolver } from '@ai-billing/core';

const groq = createGroq({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GROQ_API_KEY,
});

const priceResolver = createNarevPriceResolver({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.NAREV_API_KEY ?? '',
});

const billingMiddleware = createGroqMiddleware({
  destinations: [consoleDestination()],
  priceResolver,
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

    const model = 'llama-3.3-70b-versatile';

    const wrappedModel = wrapLanguageModel({
      model: groq(model),
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
