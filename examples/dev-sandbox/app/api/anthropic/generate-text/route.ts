import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAnthropicMiddleware } from '@ai-billing/anthropic';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const anthropic = createAnthropic({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': {
    promptTokens: 0.000003,
    completionTokens: 0.000015,
    inputCacheReadTokens: 0.0000003,
    inputCacheWriteTokens: 0.00000375,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createAnthropicMiddleware({
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

    const model = 'claude-sonnet-4-6';

    const wrappedModel = wrapLanguageModel({
      model: anthropic(model),
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
