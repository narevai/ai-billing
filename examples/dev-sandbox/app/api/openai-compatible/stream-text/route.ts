import {
  UIMessage,
  convertToModelMessages,
  streamText,
  wrapLanguageModel,
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAICompatibleMiddleware } from '@ai-billing/openai-compatible';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';
import type { LanguageModelV3 } from '@ai-sdk/provider';

const xai = createOpenAICompatible({
  name: 'xai', // must match the providerId used in the middleware
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
  includeUsage: true,
});

const customPricingMap: Record<string, ModelPricing> = {
  'grok-4-1-fast-reasoning': {
    promptTokens: 0.2 / 1_000_000,
    completionTokens: 0.5 / 1_000_000,
    internalReasoningTokens: 0,
    inputCacheReadTokens: 0.15 / 1_000_000,
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createOpenAICompatibleMiddleware({
  destinations: [consoleDestination()],
  priceResolver: priceResolver,
  providerId: 'xai', // Must match the provider name used in createOpenAICompatible;
});

export async function POST() {
  const messages: UIMessage[] = [
    {
      id: 'test-gen-1',
      role: 'user',
      parts: [{ type: 'text', text: 'What is the capital of Sweden?' }],
    },
  ];

  const model = 'grok-4-1-fast-reasoning';

  const wrappedModel = wrapLanguageModel({
    model: xai(model) as unknown as LanguageModelV3,
    middleware: billingMiddleware,
  });

  const result = streamText({
    model: wrappedModel,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
