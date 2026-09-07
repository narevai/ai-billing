import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createTogetheraiV3Middleware } from '@ai-billing/togetherai';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const togetherai = createTogetherAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.TOGETHER_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'openai/gpt-oss-20b': {
    promptTokens: 0.05 / 1_000_000, // $0.05 per 1M tokens
    completionTokens: 0.2 / 1_000_000, // $0.20 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createTogetheraiV3Middleware({
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

    const model = 'openai/gpt-oss-20b';

    const wrappedModel = wrapLanguageModel({
      model: togetherai(model),
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
