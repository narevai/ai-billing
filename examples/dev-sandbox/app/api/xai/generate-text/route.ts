import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createXai } from '@ai-sdk/xai';
import { createXaiMiddleware } from '@ai-billing/xai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const xai = createXai({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.XAI_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'grok-3-mini': {
    promptTokens: 0.000003,
    completionTokens: 0.000015,
    inputCacheReadTokens: 0.0000003,
    inputCacheWriteTokens: 0.00000375,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createXaiMiddleware({
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

    const model = 'grok-3-mini';

    const wrappedModel = wrapLanguageModel({
      model: xai(model),
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
