import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createGmicloud } from '@ai-sdk/gmicloud';
import { createGmicloudV3Middleware } from '@ai-billing/gmicloud';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const gmicloud = createGmicloud({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GMI_CLOUD_APIKEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'deepseek-ai/DeepSeek-V4-Flash-0731': {
    promptTokens: 0.1 / 1_000_000, // $0.10 per 1M tokens
    completionTokens: 0.3 / 1_000_000, // $0.30 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createGmicloudV3Middleware({
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

    const model = 'deepseek-ai/DeepSeek-V4-Flash-0731';

    const wrappedModel = wrapLanguageModel({
      model: gmicloud(model),
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
