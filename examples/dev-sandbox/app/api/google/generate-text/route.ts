import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGoogleMiddleware } from '@ai-billing/google';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const google = createGoogleGenerativeAI({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.GOOGLE_AI_STUDIO_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'models/gemini-3.1-flash-lite-preview': {
    promptTokens: 0.00000025, // $0.25 per 1M tokens
    completionTokens: 0.0000015, // $1.50 per 1M tokens
    inputCacheReadTokens: 0.000000025, // $0.025 per 1M tokens
    internalReasoningTokens: 0.0000015, // $1.50 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createGoogleMiddleware({
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

    const model = 'models/gemini-3.1-flash-lite-preview';

    const wrappedModel = wrapLanguageModel({
      model: google(model),
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
