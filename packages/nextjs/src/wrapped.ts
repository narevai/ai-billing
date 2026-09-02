import { wrapLanguageModel, createGateway } from 'ai';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAIV3Middleware } from '@ai-billing/openai';
import { createAnthropicV3Middleware } from '@ai-billing/anthropic';
import { createGoogleV3Middleware } from '@ai-billing/google';
import { createDeepSeekV3Middleware } from '@ai-billing/deepseek';
import { createGroqV3Middleware } from '@ai-billing/groq';
import { createXaiV3Middleware } from '@ai-billing/xai';
import { createChutesV3Middleware } from '@ai-billing/chutes';
import { createMinimaxV3Middleware } from '@ai-billing/minimax';
import { createOpenRouterV3Middleware } from '@ai-billing/openrouter';
import { createGatewayV3Middleware } from '@ai-billing/gateway';
import { createPolarDestination } from '@ai-billing/polar';
import { createNarevPriceResolver } from '@ai-billing/narev';
import type {
  PriceResolver,
  Destination,
  DefaultTags,
} from '@ai-billing/types';

function getPolarDestinations(): Destination<DefaultTags>[] {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) return [];
  return [
    createPolarDestination({
      accessToken,
      server:
        (process.env.POLAR_SERVER as 'sandbox' | 'production') ?? 'sandbox',
      eventName: 'llm_usage',
      externalCustomerIdKey: 'userId' as never,
    }),
  ];
}

function getNarevPriceResolver(): PriceResolver {
  return createNarevPriceResolver({ apiKey: process.env.NAREV_API_KEY ?? '' });
}

/**
 * Returns an OpenAI language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The OpenAI model ID (e.g. `"gpt-4o"`).
 */
export function createOpenAIWithBilling(modelId: string): LanguageModel {
  const p = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const m = createOpenAIV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns an Anthropic language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The Anthropic model ID (e.g. `"claude-sonnet-4-5"`).
 */
export function createAnthropicWithBilling(modelId: string): LanguageModel {
  const p = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const m = createAnthropicV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns a Google Generative AI language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The Google model ID (e.g. `"gemini-2.0-flash"`).
 */
export function createGoogleWithBilling(modelId: string): LanguageModel {
  const p = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_STUDIO_KEY,
  });
  const m = createGoogleV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns a DeepSeek language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The DeepSeek model ID (e.g. `"deepseek-chat"`).
 */
export function createDeepSeekWithBilling(modelId: string): LanguageModel {
  const p = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
  const m = createDeepSeekV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns a Groq language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The Groq model ID (e.g. `"llama-3.3-70b-versatile"`).
 */
export function createGroqWithBilling(modelId: string): LanguageModel {
  const p = createGroq({ apiKey: process.env.GROQ_API_KEY });
  const m = createGroqV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns an xAI language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The xAI model ID (e.g. `"grok-3"`).
 */
export function createXaiWithBilling(modelId: string): LanguageModel {
  const p = createXai({ apiKey: process.env.XAI_API_KEY });
  const m = createXaiV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns a Chutes language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The Chutes model ID.
 */
export function createChutesWithBilling(modelId: string): LanguageModel {
  const p = createOpenAICompatible({
    name: 'chutes',
    baseURL: 'https://llm.chutes.ai/v1',
    apiKey: process.env.CHUTES_API_KEY,
  });
  const m = createChutesV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns a MiniMax language model wrapped with Narev pricing and Polar billing.
 * @param modelId - The MiniMax model ID.
 */
export function createMinimaxWithBilling(modelId: string): LanguageModel {
  const p = createAnthropic({
    apiKey: process.env.MINIMAX_API_KEY,
    baseURL: 'https://api.minimax.io/anthropic/v1',
  });
  const m = createMinimaxV3Middleware({
    priceResolver: getNarevPriceResolver(),
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns an OpenRouter language model wrapped with Polar billing (pricing handled by OpenRouter).
 * @param modelId - The OpenRouter model ID (e.g. `"openai/gpt-4o"`).
 */
export function createOpenRouterWithBilling(modelId: string): LanguageModel {
  const p = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  const m = createOpenRouterV3Middleware({
    destinations: getPolarDestinations(),
  });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}

/**
 * Returns a Vercel AI Gateway language model wrapped with Polar billing.
 * @param modelId - The gateway model ID (e.g. `"openai/gpt-4o"`).
 */
export function createGatewayWithBilling(modelId: string): LanguageModel {
  const p = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY ?? '' });
  const m = createGatewayV3Middleware({ destinations: getPolarDestinations() });
  return wrapLanguageModel({ model: p(modelId), middleware: m });
}
