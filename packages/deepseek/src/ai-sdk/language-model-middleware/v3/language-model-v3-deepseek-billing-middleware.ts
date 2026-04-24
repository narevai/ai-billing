import { calculateDeepSeekCost } from '../../../cost/index.js';
import { createV3BillingMiddleware, toUsage } from '@ai-billing/core';
import type { CostInputs } from '@ai-billing/core';
import type {
  BaseBillingMiddlewareOptions,
  PriceResolver,
  Cost,
  DefaultTags,
  PriceResolverContext,
  ModelPricing,
  BillingEvent,
} from '@ai-billing/core';

interface DeepSeekRawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;

  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;

  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

/**
 * Configuration for {@link createDeepSeekV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the DeepSeek response; cost is computed from that
 * usage and the resolved {@link ModelPricing} using the same rules as the package's cost helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface DeepSeekV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the DeepSeek provider (`@ai-sdk/deepseek`).
 * Derives token usage from DeepSeek's raw usage payload and resolves cost from pricing plus usage.
 *
 * DeepSeek uses `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` for cache accounting, and
 * `completion_tokens_details.reasoning_tokens` for deepseek-reasoner models.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link DeepSeekV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for DeepSeek.
 *
 * @example
 * ```ts
 * import { createDeepSeek } from '@ai-sdk/deepseek';
 * import { wrapLanguageModel } from 'ai';
 * import { createDeepSeekMiddleware } from '@ai-billing/deepseek';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'deepseek-chat': {
 *     promptTokens: 0.27 / 1_000_000,
 *     completionTokens: 1.10 / 1_000_000,
 *     inputCacheReadTokens: 0.07 / 1_000_000,
 *     inputCacheWriteTokens: 0,
 *   },
 *   'deepseek-reasoner': {
 *     promptTokens: 0.55 / 1_000_000,
 *     completionTokens: 2.19 / 1_000_000,
 *     inputCacheReadTokens: 0.14 / 1_000_000,
 *     inputCacheWriteTokens: 0,
 *     internalReasoningTokens: 2.19 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createDeepSeekMiddleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: deepseek('deepseek-chat'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createDeepSeekV3Middleware<TTags extends DefaultTags>(
  options: DeepSeekV3MiddlewareOptions<TTags>,
) {
  return createV3BillingMiddleware<TTags>({
    ...options,

    buildEvent: async ({
      model,
      usage,
      providerMetadata: _empty,
      responseId,
      tags,
      webSearchCount,
    }) => {
      const rawUsage = usage?.raw as DeepSeekRawUsage | undefined;

      const deepSeekUsage: CostInputs = {
        promptTokens: rawUsage?.prompt_tokens ?? 0,
        completionTokens: rawUsage?.completion_tokens ?? 0,
        cacheReadTokens: rawUsage?.prompt_cache_hit_tokens ?? 0,
        cacheWriteTokens: 0,
        reasoningTokens: rawUsage?.completion_tokens_details?.reasoning_tokens ?? 0,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'deepseek',
      } as PriceResolverContext);

      let calculatedCost: Cost | undefined = calculateDeepSeekCost({
        pricing,
        usage: deepSeekUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'deepseek',
        tags: tags,
        usage: toUsage(deepSeekUsage),
        ...(calculatedCost !== undefined && {
          cost: calculatedCost,
        }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
