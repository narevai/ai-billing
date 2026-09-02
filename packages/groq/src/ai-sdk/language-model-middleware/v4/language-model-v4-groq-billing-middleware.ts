import { calculateGroqCost } from '../../../cost/index.js';
import { createV4BillingMiddleware, toUsage } from '@ai-billing/core';
import type {
  CostInputs,
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/types';

interface GroqRawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;

  prompt_tokens_details?: {
    cached_tokens?: number;
  };

  completion_tokens_details?: {
    reasoning_tokens?: number;
  };

  // Groq-specific timing metrics
  queue_time?: number;
  prompt_time?: number;
  completion_time?: number;
  total_time?: number;
}

/**
 * Configuration for {@link createGroqV4Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the Groq response; cost is computed from that usage
 * and the resolved {@link ModelPricing} using the same rules as the package's cost helper.
 *
 */
export interface GroqV4MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V4 billing middleware for the Groq provider (`@ai-sdk/groq`).
 * Derives token usage from Groq's raw usage payload and resolves cost from pricing plus usage.
 *
 * @param options - Billing options; see {@link GroqV4MiddlewareOptions}. A `priceResolver` is required
 * because Groq does not supply billed amounts in provider metadata the way the AI Gateway does.
 * @returns A V4 billing middleware instance for Groq.
 *
 * @example
 * Targets AI SDK v7 (`LanguageModelV4Middleware`).
 *
 * ```ts
 * import { createGroq } from '@ai-sdk/groq';
 * import { wrapLanguageModel } from 'ai';
 * import { createGroqV4Middleware } from '@ai-billing/groq';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'openai/gpt-oss-120b': {
 *     promptTokens: 0.15 / 1_000_000,
 *     completionTokens: 0.6 / 1_000_000,
 *     inputCacheReadTokens: 0.075 / 1_000_000,
 *     inputCacheWriteTokens: 0,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createGroqV4Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: groq('openai/gpt-oss-120b'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createGroqV4Middleware<TTags extends DefaultTags>(
  options: GroqV4MiddlewareOptions<TTags>,
) {
  return createV4BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const rawUsage = usage?.raw as GroqRawUsage | undefined;

      const groqUsage: CostInputs = {
        promptTokens: rawUsage?.prompt_tokens ?? 0,
        completionTokens: rawUsage?.completion_tokens ?? 0,
        cacheReadTokens: rawUsage?.prompt_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: 0,
        reasoningTokens:
          rawUsage?.completion_tokens_details?.reasoning_tokens ?? 0,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'groq',
      } as PriceResolverContext);

      let calculatedCost: Cost | undefined = calculateGroqCost({
        pricing,
        usage: groqUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'groq',
        tags: tags,
        usage: toUsage(groqUsage),
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
