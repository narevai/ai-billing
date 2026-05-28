import {
  UIMessage,
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAIMiddleware } from '@ai-billing/openai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const openai = createOpenAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.OPENAI_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'gpt-4o-search-preview': {
    promptTokens: 2.5 / 1_000_000,
    completionTokens: 10.0 / 1_000_000,
    webSearch: 0.03,
  },
  'gpt-4o-mini-search-preview': {
    promptTokens: 0.15 / 1_000_000,
    completionTokens: 0.6 / 1_000_000,
    webSearch: 0.025,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createOpenAIMiddleware({
  destinations: [consoleDestination()],
  priceResolver,
});

export async function POST() {
  try {
    const messages: UIMessage[] = [
      {
        id: 'test-ws-2',
        role: 'user',
        parts: [
          { type: 'text', text: 'What are the latest AI news from this week?' },
        ],
      },
    ];

    const model = 'gpt-4o-search-preview';

    const wrappedModel = wrapLanguageModel({
      model: openai.chat(model),
      middleware: billingMiddleware,
    });

    const result = streamText({
      model: wrappedModel,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Web Search Stream Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
