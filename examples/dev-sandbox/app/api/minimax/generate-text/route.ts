import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createMinimaxMiddleware } from '@ai-billing/minimax';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const minimax = createAnthropic({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: 'https://api.minimax.io/anthropic/v1',
});

const customPricingMap: Record<string, ModelPricing> = {
  'minimax-m1': {
    promptTokens: 0.4 / 1_000_000,
    completionTokens: 1.6 / 1_000_000,
    internalReasoningTokens: 1.6 / 1_000_000,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createMinimaxMiddleware({
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

    const model = 'minimax-m1';

    const wrappedModel = wrapLanguageModel({
      model: minimax(model),
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
