import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createAlibaba } from '@ai-sdk/alibaba';
import { createAlibabaV3Middleware } from '@ai-billing/alibaba';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const alibaba = createAlibaba({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ALIBABA_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'qwen-plus': {
    promptTokens: 0.8 / 1_000_000, // $0.80 per 1M tokens
    completionTokens: 2.0 / 1_000_000, // $2.00 per 1M tokens
    inputCacheReadTokens: 0.4 / 1_000_000, // 50% discount for cache reads
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createAlibabaV3Middleware({
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

    const model = 'qwen-plus';

    const wrappedModel = wrapLanguageModel({
      model: alibaba(model),
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
