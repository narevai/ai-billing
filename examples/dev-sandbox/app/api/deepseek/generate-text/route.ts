import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createDeepSeekMiddleware } from '@ai-billing/deepseek';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const deepSeek = createDeepSeek({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'deepseek-v4-pro': {
    promptTokens: 0.14 / 1_000_000,
    completionTokens: 0.28 / 1_000_000,
    inputCacheReadTokens: 0.028 / 1_000_000,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createDeepSeekMiddleware({
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

    const model = 'deepseek-v4-pro';

    const wrappedModel = wrapLanguageModel({
      model: deepSeek(model),
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
