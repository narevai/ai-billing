import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createMistral } from '@ai-sdk/mistral';
import { createMistralV3Middleware } from '@ai-billing/mistral';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const mistral = createMistral({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MISTRAL_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'mistral-small-latest': {
    promptTokens: 0.1 / 1_000_000, // $0.10 per 1M tokens
    completionTokens: 0.3 / 1_000_000, // $0.30 per 1M tokens
    inputCacheReadTokens: 0.05 / 1_000_000, // 50% discount for cache reads
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createMistralV3Middleware({
  destinations: [consoleDestination()],
  priceResolver: priceResolver,
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

    const model = 'mistral-small-latest';

    const wrappedModel = wrapLanguageModel({
      model: mistral(model),
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
