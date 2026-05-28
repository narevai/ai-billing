import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createChutesMiddleware } from '@ai-billing/chutes';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
const chutes = createOpenAICompatible({
  name: 'chutes',
  baseURL: 'https://llm.chutes.ai/v1',
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.CHUTES_API_KEY,
});

const customPricingMap: Record<string, ModelPricing> = {
  'deepseek-ai/DeepSeek-V3-0324': {
    promptTokens: 0.27 / 1_000_000,
    completionTokens: 1.1 / 1_000_000,
    inputCacheReadTokens: 0.07 / 1_000_000,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createChutesMiddleware({
  destinations: [consoleDestination()],
  priceResolver,
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

    const model = 'deepseek-ai/DeepSeek-V3-0324';

    const wrappedModel = wrapLanguageModel({
      model: chutes(model),
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
