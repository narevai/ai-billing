import { calculateXaiCost } from '../../../cost/index.js';
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
import { JSONObject } from '@ai-sdk/provider';

export interface XaiUsageAccounting extends JSONObject {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: {
    text_tokens?: number | null;
    audio_tokens?: number | null;
    image_tokens?: number | null;
    cached_tokens?: number | null;
  } | null;
  completion_tokens_details?: {
    reasoning_tokens?: number | null;
    audio_tokens?: number | null;
    accepted_prediction_tokens?: number | null;
    rejected_prediction_tokens?: number | null;
  } | null;
}

/**
 * Configuration for {@link createXaiV3Middleware}.
 *
 * Extends {@link BaseBillingMiddlewareOptions} (`destinations`, `defaultTags`, `waitUntil`, `onError`) and
 * requires a {@link PriceResolver}. Usage is taken from the AI SDK's normalized usage fields; cost is
 * computed from that usage and the resolved {@link ModelPricing} using the same rules as the package's cost
 * helper.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 */
export interface XaiV3MiddlewareOptions<
  TTags extends DefaultTags,
> extends BaseBillingMiddlewareOptions<TTags> {
  priceResolver: PriceResolver;
}

/**
 * Creates a V3 billing middleware for the xAI provider (`@ai-sdk/xai`).
 * Deducts cache-read tokens from prompt tokens before billing — xAI charges only non-cached input at the
 * prompt rate, and cached tokens separately at the cache-read rate.
 *
 * @typeParam TTags - The shape of the tags object, extending {@link DefaultTags}.
 * @param options - Billing options; see {@link XaiV3MiddlewareOptions}. A `priceResolver` is required.
 * @returns A V3 billing middleware instance for xAI.
 *
 * @example
 * ```ts
 * import { createXai } from '@ai-sdk/xai';
 * import { wrapLanguageModel } from 'ai';
 * import { createXAIMiddleware } from '@ai-billing/xai';
 * import {
 *   consoleDestination,
 *   createObjectPriceResolver,
 *   type ModelPricing,
 * } from '@ai-billing/core';
 *
 * const xai = createXai({ apiKey: process.env.XAI_API_KEY });
 *
 * const customPricingMap: Record<string, ModelPricing> = {
 *   'grok-3': {
 *     promptTokens: 3.0 / 1_000_000,
 *     completionTokens: 15.0 / 1_000_000,
 *     inputCacheReadTokens: 0.75 / 1_000_000,
 *   },
 *   'grok-3-mini': {
 *     promptTokens: 0.3 / 1_000_000,
 *     completionTokens: 0.5 / 1_000_000,
 *     internalReasoningTokens: 0.5 / 1_000_000,
 *     inputCacheReadTokens: 0.075 / 1_000_000,
 *   },
 * };
 *
 * const priceResolver = createObjectPriceResolver(customPricingMap);
 *
 * const billingMiddleware = createXAIMiddleware({
 *   destinations: [consoleDestination()],
 *   priceResolver,
 * });
 *
 * const wrappedModel = wrapLanguageModel({
 *   model: xai('grok-3'),
 *   middleware: billingMiddleware,
 * });
 * ```
 */
export function createXaiV3Middleware<TTags extends DefaultTags>(
  options: XaiV3MiddlewareOptions<TTags>,
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
      const xaiRawUsage = usage?.raw as XaiUsageAccounting | undefined;

      const inputTokensTotal = xaiRawUsage?.prompt_tokens ?? 0;
      const outputTokensTotal = xaiRawUsage?.completion_tokens ?? 0;
      const inputTokensCacheRead =
        xaiRawUsage?.prompt_tokens_details?.cached_tokens ?? 0;
      const inputTokensCacheWrite = 0;
      const outputTokensReasoning =
        xaiRawUsage?.completion_tokens_details?.reasoning_tokens ?? 0;

      const xaiUsage: CostInputs = {
        promptTokens: inputTokensTotal,
        completionTokens: outputTokensTotal,
        cacheReadTokens: inputTokensCacheRead,
        cacheWriteTokens: inputTokensCacheWrite,
        reasoningTokens: outputTokensReasoning,
        webSearchCount: webSearchCount,
      };

      const pricing: ModelPricing | undefined = await options.priceResolver({
        modelId: model.modelId,
        providerId: 'xai',
      } as PriceResolverContext);

      const calculatedCost: Cost | undefined = calculateXaiCost({
        pricing,
        usage: xaiUsage,
      });

      return {
        generationId: responseId ?? crypto.randomUUID(),
        modelId: model.modelId,
        provider: 'xai',
        tags,
        usage: toUsage(xaiUsage),
        ...(calculatedCost !== undefined && { cost: calculatedCost }),
      } satisfies BillingEvent<TTags>;
    },
  });
}
