import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createMoonshotAI } from '@ai-sdk/moonshotai';
import { createMoonshotaiV3Middleware } from '@ai-billing/moonshotai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const moonshotai = createMoonshotAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.MOONSHOT_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'kimi-k3': {
    promptTokens: 3.0 / 1_000_000, // $3.00 per 1M tokens
    completionTokens: 15.0 / 1_000_000, // $15.00 per 1M tokens
    inputCacheReadTokens: 0.3 / 1_000_000, // $0.30 per 1M tokens
    internalReasoningTokens: 15.0 / 1_000_000, // billed at the same flat rate as completion tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createMoonshotaiV3Middleware({
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

    const model = 'kimi-k3';

    const wrappedModel = wrapLanguageModel({
      model: moonshotai(model),
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
