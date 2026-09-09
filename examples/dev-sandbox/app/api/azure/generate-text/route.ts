import {
  UIMessage,
  convertToModelMessages,
  generateText,
  wrapLanguageModel,
} from 'ai';
import { createAzure } from '@ai-sdk/azure';
import { createAzureV3Middleware } from '@ai-billing/azure';
import {
  consoleDestination,
  createObjectPriceResolver,
  ModelPricing,
} from '@ai-billing/core';

const azure = createAzure({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  apiKey: process.env.AZURE_API_KEY,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  baseURL: process.env.AZURE_URL
    ? `${process.env.AZURE_URL.replace(/\/+$/, '')}/openai/v1`
    : undefined,
  apiVersion: 'preview',
});

// eslint-disable-next-line turbo/no-undeclared-env-vars
const model = process.env.AZURE_DEPLOYMENT ?? 'DeepSeek-V4-Pro';

const customPricingMap: Record<string, ModelPricing> = {
  [model]: {
    promptTokens: 0.14 / 1_000_000, // $0.14 per 1M tokens
    completionTokens: 0.28 / 1_000_000, // $0.28 per 1M tokens
  },
};

const priceResolver = createObjectPriceResolver(customPricingMap);

const billingMiddleware = createAzureV3Middleware({
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

    const wrappedModel = wrapLanguageModel({
      model: azure(model),
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
