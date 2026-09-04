import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createFireworks } from '@ai-sdk/fireworks';
import { createFireworksV3Middleware } from '@ai-billing/fireworks';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const fireworks = createFireworks({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.FIREWORKS_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'accounts/fireworks/models/glm-5p3-flash': {
    promptTokens: 0.2 / 1_000_000, // $0.20 per 1M tokens
    completionTokens: 0.8 / 1_000_000, // $0.80 per 1M tokens
    inputCacheReadTokens: 0.1 / 1_000_000, // 50% discount for cache reads
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createFireworksV3Middleware({
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

    // The raw route's default model, `accounts/fireworks/models/deepseek-v3`, is not available on
    // the account this package was built against — `glm-5p3-flash` is the working model id.
    const model = 'accounts/fireworks/models/glm-5p3-flash';

    const wrappedModel = wrapLanguageModel({
      model: fireworks(model),
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
