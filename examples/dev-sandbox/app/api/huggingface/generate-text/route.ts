import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createHuggingFace } from '@ai-sdk/huggingface';
import { createHuggingfaceV3Middleware } from '@ai-billing/huggingface';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const huggingFace = createHuggingFace({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.HUGGINGFACE_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'meta-llama/Llama-3.1-8B-Instruct': {
    promptTokens: 0.05 / 1_000_000, // $0.05 per 1M tokens
    completionTokens: 0.15 / 1_000_000, // $0.15 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createHuggingfaceV3Middleware({
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

    const model = 'meta-llama/Llama-3.1-8B-Instruct';

    const wrappedModel = wrapLanguageModel({
      model: huggingFace(model),
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
