import { calculateZaiCost } from '../../../cost/index.js';
import { createV3BillingMiddleware, toUsage } from '@ai-billing/core';
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
import { JSONObject } from '@ai-sdk/provider';

export interface ZaiV3UsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    cached_tokens?: number | null;
  } | null;
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
  } | null;
}

/**
 * Configuration for {@link createZaiV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface ZaiV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the Z.ai provider (`@ai-sdk/zai`).
 * Deducts cache-read tokens from prompt tokens and reasoning tokens from completion tokens before
 * billing — reasoning tokens are a subset of `completion_tokens` (GLM has no separate reasoning rate), and
 * cached tokens are billed separately at the cache-read rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link ZaiV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for Z.ai.
 *
 * @example
 * ```ts
 * import { createZai } from '@ai-sdk/zai';
 * import { wrapLanguageModel } from 'ai';
 * import { createZaiV3Middleware } from '@ai-billing/zai';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const zai = createZai({ apiKey: process.env.ZAI_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'glm-5.3': {
 *     promptTokens: 1.4 / 1_000_000,
 *     completionTokens: 4.4 / 1_000_000,
 *     inputCacheReadTokens: 0.26 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createZaiV3Middleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: zai('glm-5.3'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createZaiV3Middleware<TTags extends DefaultTags>(
  options: ZaiV3MiddlewareOptions<TTags>,
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
      const zaiRawUsage = usage?.raw as ZaiV3UsageAccounting | undefined;

      const inputTokensTotal = zaiRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = zaiRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        zaiRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        zaiRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const zaiUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'zai',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateZaiCost({
        pricing,
        usage: zaiUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'zai',
        tags,
        usage: toUsage(zaiUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
