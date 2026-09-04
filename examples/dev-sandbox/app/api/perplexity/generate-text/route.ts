import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { createPerplexityV3Middleware } from '@ai-billing/perplexity';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const perplexity = createPerplexity({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.PERPLEXITY_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'sonar-pro': {
    promptTokens: 3.0 / 1_000_000, // $3.00 per 1M input tokens
    completionTokens: 15.0 / 1_000_000, // $15.00 per 1M output tokens
    request: 6.0 / 1_000, // flat per-request search fee (low search_context_size rate)
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createPerplexityV3Middleware({
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

    const model = 'sonar-pro';

    const wrappedModel = wrapLanguageModel({
      model: perplexity(model),
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
